// The ONLY place a Leads-tab draft becomes a real Instagram message, and it runs only when an admin presses
// Send (POST /api/admin/leads/[id]/decide). Eimear can also send her own words while a suggestion is still
// being written or when there is none.
import type { SupabaseClient } from "@supabase/supabase-js";
import { conversationMessages, markConversationRead, sendInstagramMessage, type CrmDeps } from "./crm";
import { OPEN_STATUSES, checkBeforeSend, sentStatus } from "./rules";

export class LeadDecisionError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

const MAX_DM = 1000;

type Row = {
  id: string;
  conversation_id: string;
  contact_id: string;
  inbound_message_id: string;
  inbound_at: string;
  status: string;
  draft_text: string | null;
};

export async function sendLeadDraft(admin: SupabaseClient, id: string, actorId: string, editedText: string | null, deps: { crm?: CrmDeps; now?: Date } = {}) {
  const { data } = await admin
    .from("lead_dm_drafts")
    .select("id, conversation_id, contact_id, inbound_message_id, inbound_at, status, draft_text")
    .eq("id", id)
    .maybeSingle();
  const row = data as Row | null;
  if (!row) throw new LeadDecisionError("Message not found", 404);
  if (!(OPEN_STATUSES as readonly string[]).includes(row.status)) throw new LeadDecisionError("This one has already been handled.", 409);

  const finalText = (typeof editedText === "string" && editedText.trim() ? editedText : row.draft_text || "").trim();
  if (!finalText) throw new LeadDecisionError("There is no reply to send.", 400);
  if (finalText.length > MAX_DM) throw new LeadDecisionError(`Instagram replies are limited to ${MAX_DM} characters.`, 400);

  // Claim it so two devices cannot both send it.
  const staleBefore = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data: claimed } = await admin
    .from("lead_dm_drafts")
    .update({ send_claimed_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", [...OPEN_STATUSES])
    .or(`send_claimed_at.is.null,send_claimed_at.lt.${staleBefore}`)
    .select("id");
  if (!claimed?.length) throw new LeadDecisionError("This reply is already being sent.", 409);
  const release = () => admin.from("lead_dm_drafts").update({ send_claimed_at: null }).eq("id", id);

  // Re-read the thread: never answer something Marc or the AI setter has already answered.
  let check;
  try {
    check = checkBeforeSend(await conversationMessages(row.conversation_id, deps.crm, 30), row, deps.now ?? new Date());
  } catch (error) {
    await release();
    throw new LeadDecisionError(`Could not check the conversation first: ${error instanceof Error ? error.message : "CRM error"}`, 502);
  }
  if (!check.ok) {
    if (check.status === "newer") {
      await release();
    } else {
      await admin
        .from("lead_dm_drafts")
        .update({ status: check.status, error_message: check.message, decided_at: new Date().toISOString(), send_claimed_at: null })
        .eq("id", id)
        .in("status", [...OPEN_STATUSES]);
    }
    throw new LeadDecisionError(check.message, 409);
  }

  let messageId: string | null = null;
  try {
    messageId = (await sendInstagramMessage(row.contact_id, finalText, deps.crm)).messageId;
  } catch (error) {
    await release();
    throw new LeadDecisionError(error instanceof Error ? error.message : "Send failed", 502);
  }

  // The message is out. From here on never report failure: a bookkeeping error must not cause a resend.
  const status = sentStatus(row.draft_text, finalText);
  const { error } = await admin
    .from("lead_dm_drafts")
    .update({
      status,
      final_text: finalText,
      crm_message_id: messageId,
      decided_at: new Date().toISOString(),
      decided_by: actorId,
      send_claimed_at: null,
    })
    .eq("id", id);
  if (error) console.error("lead_dms_record_sent_failed", { id, error: error.message });
  await markConversationRead(row.conversation_id, deps.crm);
  return { status };
}

/** Leave for Marc, back to the main list, or no reply needed. */
export async function setLeadDraftState(admin: SupabaseClient, id: string, actorId: string, action: "for_marc" | "unassign" | "dismiss") {
  const update =
    action === "dismiss"
      ? { status: "dismissed", decided_at: new Date().toISOString(), decided_by: actorId }
      : { for_marc: action === "for_marc" };
  const { data } = await admin.from("lead_dm_drafts").update(update).eq("id", id).in("status", [...OPEN_STATUSES]).select("id");
  if (!data?.length) throw new LeadDecisionError("This one has already been handled.", 409);
  return { status: action };
}
