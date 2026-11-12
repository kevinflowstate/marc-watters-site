import { getInboxViewer } from "@/lib/inbox-server";
import { InboxSendError, sendInboxMessage } from "@/lib/inbox-send";
import { replyDraftsEnabled } from "@/lib/reply-drafts/config";
import { inboxKey } from "@/lib/reply-drafts/rules";
import { markConversationAnswered, onClientInboxMessage, recordDraftSent } from "@/lib/reply-drafts/store";
import { createAdminClient } from "@/lib/supabase/admin";
import { after, NextResponse } from "next/server";

export async function POST(request: Request) {
  const viewer = await getInboxViewer();

  if (!viewer) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { client_id, message, attachments, reply_draft_id } = await request.json().catch(() => ({}));

  let result: Awaited<ReturnType<typeof sendInboxMessage>>;
  try {
    result = await sendInboxMessage(viewer, { clientId: client_id, message, attachments });
  } catch (error) {
    const status = error instanceof InboxSendError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to send message" }, { status });
  }

  // Reply drafts (switch OFF by default). Runs after the response; never blocks or fails the send.
  try {
    if (replyDraftsEnabled()) {
      const sentId = result.message?.id as string | undefined;
      const sentText = typeof result.message?.message === "string" ? result.message.message : "";
      after(async () => {
        const admin = createAdminClient();
        if (viewer.role === "client") {
          if (sentId) await onClientInboxMessage(admin, result.clientId, sentId);
          return;
        }
        // An admin replied: record the draft they started from (if any), then retire any other open draft.
        if (typeof reply_draft_id === "string" && reply_draft_id) {
          await recordDraftSent(admin, reply_draft_id, sentText, viewer.userId, inboxKey(result.clientId));
        }
        await markConversationAnswered(admin, inboxKey(result.clientId));
      });
    }
  } catch (draftError) {
    console.error("reply_draft_hook_failed", draftError instanceof Error ? draftError.message : String(draftError));
  }

  return NextResponse.json({ message: result.message });
}
