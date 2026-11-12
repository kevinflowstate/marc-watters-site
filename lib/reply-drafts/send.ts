// The ONLY place a reply draft turns into a real message, and it runs only when an admin presses Send
// (POST /api/admin/reply-drafts/[id]/decide). It reuses the existing admin send paths so the client
// gets exactly what they would get if Marc had typed the reply himself.
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendCheckinReply } from "@/lib/checkin-replies";
import { sendInboxMessage } from "@/lib/inbox-send";
import { DECIDABLE_STATUSES, inboxKey } from "./rules";
import { markConversationAnswered, recordDraftSent } from "./store";

export class DraftDecisionError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

type AdminActor = { userId: string; fullName: string };

export async function sendApprovedDraft(admin: SupabaseClient, draftId: string, actor: AdminActor, editedText?: string | null) {
  const { data: draft } = await admin
    .from("reply_drafts")
    .select("id, kind, client_id, checkin_id, status, draft_text, send_claimed_at")
    .eq("id", draftId)
    .maybeSingle();
  if (!draft) throw new DraftDecisionError("Draft not found", 404);
  if (!DECIDABLE_STATUSES.includes(draft.status)) throw new DraftDecisionError("This draft has already been handled.", 409);

  const finalText = (typeof editedText === "string" && editedText.trim() ? editedText : draft.draft_text || "").trim();
  if (!finalText) throw new DraftDecisionError("There is no reply to send.", 400);

  // Claim it so two devices cannot both send it.
  const staleBefore = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data: claimed } = await admin
    .from("reply_drafts")
    .update({ send_claimed_at: new Date().toISOString() })
    .eq("id", draftId)
    .in("status", DECIDABLE_STATUSES)
    .or(`send_claimed_at.is.null,send_claimed_at.lt.${staleBefore}`)
    .select("id");
  if (!claimed?.length) throw new DraftDecisionError("This draft is already being sent.", 409);

  let clientId = draft.client_id as string;
  try {
    if (draft.kind === "checkin") {
      const result = await sendCheckinReply({ checkinId: draft.checkin_id, replyText: finalText, senderUserId: actor.userId, overwrite: false });
      clientId = result.clientId;
    } else {
      await sendInboxMessage(
        { userId: actor.userId, role: "admin", fullName: actor.fullName, clientProfileId: null },
        { clientId: draft.client_id, message: finalText, attachments: [] },
      );
    }
  } catch (error) {
    await admin.from("reply_drafts").update({ send_claimed_at: null }).eq("id", draftId);
    const status = (error as { status?: number }).status || 500;
    throw new DraftDecisionError(error instanceof Error ? error.message : "Send failed", status);
  }

  // The message is out. From here on, never report failure: a bookkeeping error must not make Marc resend.
  const status = (await recordDraftSent(admin, draftId, finalText, actor.userId)) ?? "sent";
  if (draft.kind === "checkin") await markConversationAnswered(admin, inboxKey(clientId));
  return { status, finalText };
}
