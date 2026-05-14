import { requireAdmin } from "@/lib/admin-auth";
import { getInboxViewer } from "@/lib/inbox-server";
import { sendPushToUser } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const viewer = await getInboxViewer();
  if (!viewer || viewer.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { message } = await request.json().catch(() => ({}));
  const trimmed = typeof message === "string" ? message.trim() : "";

  if (!trimmed) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  if (trimmed.length > 2000) {
    return NextResponse.json({ error: "Broadcast must be 2000 characters or fewer" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: clients, error: clientsError } = await admin
    .from("client_profiles")
    .select("id, user_id, business_name")
    .order("created_at", { ascending: true })
    .returns<Array<{ id: string; user_id: string; business_name: string | null }>>();

  if (clientsError) {
    return NextResponse.json({ error: clientsError.message }, { status: 500 });
  }

  const recipients = clients ?? [];
  if (recipients.length === 0) {
    return NextResponse.json({ error: "No clients found" }, { status: 404 });
  }

  const inboxRows = recipients.map((client) => ({
    client_id: client.id,
    sender_user_id: viewer.userId,
    sender_role: "admin",
    message: trimmed,
    attachments: [],
    read_by_admin: true,
    read_by_client: false,
  }));

  const { error: inboxError } = await admin.from("inbox_messages").insert(inboxRows);
  if (inboxError) {
    return NextResponse.json({ error: inboxError.message }, { status: 500 });
  }

  const preview = trimmed.slice(0, 200);
  const notifications = recipients.map((client) => ({
    user_id: client.user_id,
    title: "New message from Marc",
    message: preview,
    link: "/portal/inbox",
  }));

  const { error: notificationError } = await admin.from("notifications").insert(notifications);
  if (notificationError) {
    return NextResponse.json({ error: notificationError.message }, { status: 500 });
  }

  const pushResults = await Promise.all(
    recipients.map((client) =>
      sendPushToUser(client.user_id, {
        title: "New message from Marc",
        body: trimmed.slice(0, 140),
        url: "/portal/inbox",
        tag: `broadcast-${Date.now()}`,
      }),
    ),
  );

  const pushSent = pushResults.reduce((total, result) => total + result.sent, 0);
  const pushFailed = pushResults.reduce((total, result) => total + result.failed, 0);

  return NextResponse.json({
    success: true,
    clients: recipients.length,
    inboxMessages: inboxRows.length,
    notifications: notifications.length,
    pushSent,
    pushFailed,
  });
}
