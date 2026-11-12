import { requireAdmin } from "@/lib/admin-auth";
import { sendCheckinReply } from "@/lib/checkin-replies";
import { replyDraftsEnabled } from "@/lib/reply-drafts/config";
import { checkinKey, inboxKey } from "@/lib/reply-drafts/rules";
import { markConversationAnswered, recordDraftSent } from "@/lib/reply-drafts/store";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { after, NextResponse } from "next/server";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { checkin_id, reply_text, reply_draft_id } = await request.json();

  if (!checkin_id || !reply_text?.trim()) {
    return NextResponse.json(
      { error: "checkin_id and reply_text are required" },
      { status: 400 }
    );
  }

  try {
    const sent = await sendCheckinReply({
      checkinId: checkin_id,
      replyText: reply_text,
      senderUserId: user.id,
      overwrite: true,
    });
    // The reply is sent: draft bookkeeping must never turn this into an error.
    try {
      if (replyDraftsEnabled()) {
        after(async () => {
          const admin = createAdminClient();
          const key = checkinKey(String(checkin_id).trim());
          if (typeof reply_draft_id === "string" && reply_draft_id) {
            await recordDraftSent(admin, reply_draft_id, String(reply_text).trim(), user.id, key);
          }
          await markConversationAnswered(admin, key);
          // The reply also lands in the client's inbox thread, so that conversation is answered too.
          await markConversationAnswered(admin, inboxKey(sent.clientId));
        });
      }
    } catch (draftError) {
      console.error("reply_draft_hook_failed", draftError instanceof Error ? draftError.message : String(draftError));
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const status = (error as Error & { status?: number }).status || 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "send_checkin_reply_failed" },
      { status },
    );
  }
}
