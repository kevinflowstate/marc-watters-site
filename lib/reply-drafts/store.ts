// Queue bookkeeping for reply drafts. This module never sends anything to a client.
import type { SupabaseClient } from "@supabase/supabase-js";
import { replyDraftsEnabled, INBOX_DEBOUNCE_MS } from "./config";
import {
  OPEN_STATUSES,
  DECIDABLE_STATUSES,
  checkinKey,
  inboxDraftDecision,
  inboxKey,
  planForNewClientMessage,
  sentStatus,
  type OpenDraft,
  type ThreadMessage,
} from "./rules";
import { staffReactedMessageIds } from "@/lib/inbox-reactions";

/** Columns safe to return to the admin UI. Token and money columns are deliberately absent. */
export const DRAFT_PUBLIC_COLUMNS =
  "id, kind, client_id, conversation_key, ref_id, checkin_id, source_message_ids, status, draft_text, final_text, needs_reason, due_at, generated_at, created_at, decided_at, decided_by";

export type PublicDraft = {
  id: string;
  kind: "inbox" | "checkin" | "checkin_followup";
  client_id: string;
  conversation_key: string;
  ref_id: string;
  checkin_id: string | null;
  source_message_ids: string[];
  status: string;
  draft_text: string | null;
  final_text: string | null;
  needs_reason: string | null;
  due_at: string;
  generated_at: string | null;
  created_at: string;
  decided_at: string | null;
  decided_by: string | null;
};

/** Drafting needs a style guide that a person has reviewed and saved. */
export async function styleGuideApproved(admin: SupabaseClient): Promise<boolean> {
  const { data } = await admin.from("reply_style_guides").select("approved_at").eq("id", "marc").maybeSingle();
  return Boolean(data?.approved_at);
}

async function openDraft(admin: SupabaseClient, key: string): Promise<OpenDraft | null> {
  const { data } = await admin
    .from("reply_drafts")
    .select("id, status, source_message_ids, claimed_at")
    .eq("conversation_key", key)
    .in("status", OPEN_STATUSES)
    .maybeSingle();
  return (data as OpenDraft | null) ?? null;
}

async function isArchived(admin: SupabaseClient, clientId: string) {
  const { data } = await admin.from("client_profiles").select("archived_at").eq("id", clientId).maybeSingle();
  return !data || Boolean(data.archived_at);
}

export async function loadThread(admin: SupabaseClient, clientId: string, limit = 40): Promise<ThreadMessage[]> {
  const { data, error } = await admin
    .from("inbox_messages")
    .select("id, sender_role, message, created_at, reply_context")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(limit);
  // A failed read must not look like an empty thread.
  if (error) throw new Error(`inbox_read_failed: ${error.message}`);
  return ((data || []) as ThreadMessage[]).reverse();
}

/**
 * A client message was stored. Queue (or re-time) the conversation's draft.
 * Called after the response via next/server after(); every failure is swallowed and logged.
 */
export async function onClientInboxMessage(admin: SupabaseClient, clientId: string, messageId: string, at = new Date()) {
  if (!replyDraftsEnabled()) return { queued: false, reason: "disabled" };
  try {
    if (!(await styleGuideApproved(admin))) return { queued: false, reason: "no_style_guide" };
    const thread = await loadThread(admin, clientId);
    const latest = thread[thread.length - 1];
    const reacted = latest ? await staffReactedMessageIds(admin, [latest.id]) : new Set<string>();
    const decision = inboxDraftDecision(thread, reacted, { archived: await isArchived(admin, clientId) });
    if (!decision.draft) return { queued: false, reason: decision.reason };

    const key = inboxKey(clientId);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const plan = planForNewClientMessage(await openDraft(admin, key), messageId, at, INBOX_DEBOUNCE_MS);
      const sourceIds = Array.from(new Set([...decision.burst.map((m) => m.id), ...plan.sourceIds]));
      if (plan.action === "extend") {
        const { data } = await admin
          .from("reply_drafts")
          .update({ due_at: plan.dueAt, source_message_ids: sourceIds, ref_id: messageId, kind: decision.kind, checkin_id: decision.checkinId, claimed_at: null })
          .eq("id", plan.draftId)
          .eq("status", "pending")
          .select("id");
        if (data?.length) return { queued: true, draftId: plan.draftId, action: plan.action };
        continue; // It was written in the meantime; go round again and supersede it.
      }
      if (plan.action === "supersede_and_create") {
        await admin
          .from("reply_drafts")
          .update({ status: "superseded", decided_at: new Date().toISOString() })
          .eq("id", plan.supersedeId)
          .in("status", OPEN_STATUSES);
      }
      const { data, error } = await admin
        .from("reply_drafts")
        .insert({
          kind: decision.kind,
          client_id: clientId,
          conversation_key: key,
          ref_id: messageId,
          checkin_id: decision.checkinId,
          source_message_ids: sourceIds,
          status: "pending",
          due_at: plan.dueAt,
        })
        .select("id")
        .single();
      if (!error && data) return { queued: true, draftId: data.id as string, action: plan.action };
      if (error?.code !== "23505") throw new Error(error?.message || "insert_failed");
      // Another request created the open draft at the same moment: retry once as an extend.
    }
    return { queued: false, reason: "conflict" };
  } catch (error) {
    console.error("reply_drafts_enqueue_failed", { clientId, error: error instanceof Error ? error.message : String(error) });
    return { queued: false, reason: "error" };
  }
}

/** A check-in was submitted. Draft the reply straight away (no debounce). */
export async function onCheckinSubmitted(admin: SupabaseClient, checkinId: string) {
  if (!replyDraftsEnabled()) return { queued: false, reason: "disabled" };
  try {
    if (!(await styleGuideApproved(admin))) return { queued: false, reason: "no_style_guide" };
    const { data: checkin } = await admin.from("checkins").select("id, client_id, admin_reply").eq("id", checkinId).maybeSingle();
    if (!checkin) return { queued: false, reason: "not_found" };
    if (checkin.admin_reply) return { queued: false, reason: "admin_replied" };
    if (await isArchived(admin, checkin.client_id)) return { queued: false, reason: "client_archived" };
    const { data, error } = await admin
      .from("reply_drafts")
      .insert({
        kind: "checkin",
        client_id: checkin.client_id,
        conversation_key: checkinKey(checkinId),
        ref_id: checkinId,
        checkin_id: checkinId,
        status: "pending",
        due_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error?.code === "23505") return { queued: false, reason: "already_queued" };
    if (error) throw new Error(error.message);
    return { queued: true, draftId: data.id as string };
  } catch (error) {
    console.error("reply_drafts_checkin_enqueue_failed", { checkinId, error: error instanceof Error ? error.message : String(error) });
    return { queued: false, reason: "error" };
  }
}

/** An admin answered (typed a reply, reacted, or replied to the check-in): retire any open draft. */
export async function markConversationAnswered(admin: SupabaseClient, key: string) {
  if (!replyDraftsEnabled()) return;
  try {
    await admin
      .from("reply_drafts")
      .update({ status: "superseded", decided_at: new Date().toISOString() })
      .eq("conversation_key", key)
      .in("status", OPEN_STATUSES);
  } catch (error) {
    console.error("reply_drafts_mark_answered_failed", { key, error: error instanceof Error ? error.message : String(error) });
  }
}

/**
 * Record that an admin sent a reply that started from this draft (unchanged or edited).
 * Only an admin pressing Send reaches this: the caller has already sent the message.
 */
export async function recordDraftSent(admin: SupabaseClient, draftId: string, finalText: string, adminUserId: string, expectedKey?: string) {
  const { data: row } = await admin
    .from("reply_drafts")
    .select("id, status, draft_text, conversation_key")
    .eq("id", draftId)
    .maybeSingle();
  if (!row || (expectedKey && row.conversation_key !== expectedKey)) return null;
  if (!DECIDABLE_STATUSES.includes(row.status) && row.status !== "pending") return null;
  const status = sentStatus(row.draft_text, finalText);
  const { error } = await admin
    .from("reply_drafts")
    .update({ status, final_text: finalText, decided_at: new Date().toISOString(), decided_by: adminUserId, send_claimed_at: null })
    .eq("id", draftId);
  if (error) {
    console.error("reply_drafts_record_sent_failed", { draftId, error: error.message });
    return null;
  }
  return status;
}

export async function discardDraft(admin: SupabaseClient, draftId: string, adminUserId: string) {
  const { data } = await admin
    .from("reply_drafts")
    .update({ status: "discarded", decided_at: new Date().toISOString(), decided_by: adminUserId })
    .eq("id", draftId)
    .in("status", DECIDABLE_STATUSES)
    .is("send_claimed_at", null)
    .select("id");
  return Boolean(data?.length);
}

/** The open draft for one conversation, for the admin UI. */
export async function getOpenDraft(admin: SupabaseClient, key: string): Promise<PublicDraft | null> {
  const { data } = await admin
    .from("reply_drafts")
    .select(DRAFT_PUBLIC_COLUMNS)
    .eq("conversation_key", key)
    .in("status", OPEN_STATUSES)
    .maybeSingle();
  return (data as PublicDraft | null) ?? null;
}
