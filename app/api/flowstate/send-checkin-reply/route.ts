import { resolveCheckinReplySender } from "@/lib/checkin-replies";
import { requireFlowstateAccess } from "@/lib/flowstate/auth";
import { sendApprovedCheckinReply } from "@/lib/flowstate/portal";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const auth = requireFlowstateAccess(request);
  if (auth) return auth;

  if (process.env.FLOWSTATE_PORTAL_SEND_ENABLED !== "true") {
    return NextResponse.json({ ok: false, error: "flowstate_portal_send_disabled" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const checkinId = String(body.checkin_id || body.checkinId || "").trim();
  const replyText = String(body.reply_text || body.replyText || "").trim();
  const approvalId = String(body.approval_id || body.approvalId || "").trim();
  const approvedBy = String(body.approved_by || body.approvedBy || "").trim();

  if (!checkinId || !replyText || !approvalId || !approvedBy) {
    return NextResponse.json(
      { ok: false, error: "checkin_id_reply_text_approval_id_and_approved_by_required" },
      { status: 400 },
    );
  }

  try {
    const sender = await resolveCheckinReplySender();
    const result = await sendApprovedCheckinReply({
      checkinId,
      replyText,
      approvalId,
      approvedBy,
      senderUserId: sender.id,
      overwrite: body.overwrite === true,
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const status = (error as Error & { status?: number }).status || 500;
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "send_checkin_reply_failed" },
      { status },
    );
  }
}
