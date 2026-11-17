// Keeps lead_dm_drafts in step with Marc's Instagram inbox in the CRM. Reads only: it never sends.
import type { SupabaseClient } from "@supabase/supabase-js";
import { DM_DEBOUNCE_MS, REPLY_WINDOW_MS, leadDmsEnabled } from "./config";
import { conversationMessages, recentInstagramConversations, type CrmDeps } from "./crm";
import { OPEN_STATUSES, preview, threadState } from "./rules";

type OpenRow = { id: string; conversation_id: string; inbound_message_id: string; inbound_at: string; status: string; for_marc: boolean };

const RETIRE_REASON: Record<string, string> = {
  replied: "Answered in Instagram or the CRM",
  ai_setter: "The AI setter is handling this lead",
  window_closed: "Reply window closed",
  no_messages: "No Instagram messages",
  newer_message: "A newer message arrived",
};

async function retire(admin: SupabaseClient, row: OpenRow, status: "superseded" | "expired", reason: string) {
  const { error } = await admin
    .from("lead_dm_drafts")
    .update({ status, error_message: RETIRE_REASON[reason] ?? reason, decided_at: new Date().toISOString(), claimed_at: null })
    .eq("id", row.id)
    .in("status", [...OPEN_STATUSES]);
  if (error) console.error("lead_dms_retire_failed", error.message);
}

export async function syncLeadDms(admin: SupabaseClient, deps: { crm?: CrmDeps; now?: Date } = {}) {
  if (!leadDmsEnabled()) return { enabled: false as const };
  const now = deps.now ?? new Date();
  const conversations = await recentInstagramConversations(now.getTime() - REPLY_WINDOW_MS, deps.crm);
  const byId = new Map(conversations.map((c) => [c.id, c]));

  const { data, error } = await admin
    .from("lead_dm_drafts")
    .select("id, conversation_id, inbound_message_id, inbound_at, status, for_marc")
    .in("status", [...OPEN_STATUSES]);
  if (error) throw new Error(`lead_dms_open_read_failed: ${error.message}`);
  const open = new Map(((data || []) as OpenRow[]).map((r) => [r.conversation_id, r]));

  let created = 0;
  let retired = 0;
  for (const c of conversations) {
    if (c.lastMessageDirection !== "inbound" || !c.contactId) continue;
    const existing = open.get(c.id);
    // Already drafted for this exact latest message: no need to re-read the thread.
    if (existing && c.lastMessageDate && Math.abs(Date.parse(existing.inbound_at) - c.lastMessageDate) < 2000) continue;

    let messages;
    try {
      messages = await conversationMessages(c.id, deps.crm, 30);
    } catch (e) {
      console.error("lead_dms_thread_read_failed", { conversation: c.id, error: e instanceof Error ? e.message : e });
      continue;
    }
    const state = threadState(messages, now);
    if (!state.waiting) {
      if (existing) {
        await retire(admin, existing, state.reason === "window_closed" ? "expired" : "superseded", state.reason);
        retired += 1;
      }
      continue;
    }
    if (existing?.inbound_message_id === state.latest.id) continue;
    if (existing) {
      await retire(admin, existing, "superseded", "newer_message");
      retired += 1;
    }

    const due = new Date(Date.parse(state.latest.at) + DM_DEBOUNCE_MS).toISOString();
    const { error: insertError } = await admin.from("lead_dm_drafts").upsert(
      {
        conversation_id: c.id,
        contact_id: c.contactId,
        contact_name: (c.contactName || c.fullName || "Instagram user").slice(0, 120),
        profile_photo: c.profilePhoto && /^https:\/\//.test(c.profilePhoto) ? c.profilePhoto : null,
        inbound_message_id: state.latest.id,
        inbound_at: state.latest.at,
        inbound_text: state.burst.map(preview).join("\n").slice(0, 1000),
        for_marc: existing?.for_marc ?? false,
        due_at: due,
        // Nothing to answer in words (a reel, photo or voice note): no suggestion, no model call.
        status: state.textless ? "skipped" : "pending",
        needs_reason: state.textless ? "They sent a reel, photo or voice note. Open Instagram to see it and reply yourself." : null,
      },
      { onConflict: "conversation_id,inbound_message_id", ignoreDuplicates: true },
    );
    if (insertError) console.error("lead_dms_insert_failed", { conversation: c.id, error: insertError.message });
    else created += 1;
  }

  // Open drafts whose thread has moved on without passing through the loop above.
  for (const row of open.values()) {
    const c = byId.get(row.conversation_id);
    if (now.getTime() - Date.parse(row.inbound_at) >= REPLY_WINDOW_MS) {
      await retire(admin, row, "expired", "window_closed");
      retired += 1;
    } else if (c && c.lastMessageDirection === "outbound") {
      await retire(admin, row, "superseded", "replied");
      retired += 1;
    }
  }
  return { enabled: true as const, conversations: conversations.length, created, retired };
}
