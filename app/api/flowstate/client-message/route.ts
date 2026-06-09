import { resolveCheckinReplySender } from "@/lib/checkin-replies";
import { requireFlowstateAccess } from "@/lib/flowstate/auth";
import { sendPushToUser } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

type ClientProfile = {
  id: string;
  user_id: string;
  business_name: string | null;
};

export async function POST(request: Request) {
  const auth = requireFlowstateAccess(request);
  if (auth) return auth;

  if (process.env.FLOWSTATE_PORTAL_SEND_ENABLED !== "true") {
    return NextResponse.json({ ok: false, error: "flowstate_portal_send_disabled" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const clientId = text(body.client_id || body.clientId);
  const message = text(body.message || body.text);
  const approvalId = text(body.approval_id || body.approvalId);
  const approvedBy = text(body.approved_by || body.approvedBy);

  if (!clientId || !message || !approvalId || !approvedBy) {
    return NextResponse.json(
      { ok: false, error: "client_id_message_approval_id_and_approved_by_required" },
      { status: 400 },
    );
  }

  try {
    const sender = await resolveCheckinReplySender();
    const admin = createAdminClient();
    const { data: clientProfile } = await admin
      .from("client_profiles")
      .select("id, user_id, business_name")
      .eq("id", clientId)
      .single<ClientProfile>();

    if (!clientProfile) {
      return NextResponse.json({ ok: false, error: "client_not_found" }, { status: 404 });
    }

    const { data: row, error: inboxError } = await admin
      .from("inbox_messages")
      .insert({
        client_id: clientProfile.id,
        sender_user_id: sender.id,
        sender_role: "admin",
        message,
        attachments: [],
        read_by_admin: true,
        read_by_client: false,
      })
      .select("id, client_id, created_at")
      .single<{ id: string; client_id: string; created_at: string }>();

    if (inboxError || !row) {
      return NextResponse.json({ ok: false, error: inboxError?.message || "message_not_created" }, { status: 500 });
    }

    const title = "New inbox message from Marc";
    const preview = message.slice(0, 200);
    const link = "/portal/inbox";
    const { error: notificationError } = await admin.from("notifications").insert({
      user_id: clientProfile.user_id,
      title,
      message: preview,
      link,
    });

    let pushSent = 0;
    let pushFailed = 0;
    try {
      const pushResult = await sendPushToUser(clientProfile.user_id, {
        title,
        body: message.slice(0, 140),
        url: link,
        tag: `inbox-${clientProfile.id}`,
      });
      pushSent = pushResult.sent;
      pushFailed = pushResult.failed;
    } catch (pushError) {
      console.error("Failed to send Flowstate client-message push:", pushError);
      pushFailed = 1;
    }

    return NextResponse.json({
      ok: true,
      result: {
        messageId: row.id,
        clientId: row.client_id,
        createdAt: row.created_at,
        notificationInserted: !notificationError,
        pushSent,
        pushFailed,
        approvalId,
        approvedBy,
      },
    });
  } catch (error) {
    const status = (error as Error & { status?: number }).status || 500;
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "client_message_failed" },
      { status },
    );
  }
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
