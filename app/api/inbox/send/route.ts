import { getInboxViewer } from "@/lib/inbox-server";
import { sendPushToUser } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const viewer = await getInboxViewer();

  if (!viewer) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { client_id, message } = await request.json().catch(() => ({}));
  const trimmed = typeof message === "string" ? message.trim() : "";

  if (!trimmed) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const clientId = viewer.role === "client" ? viewer.clientProfileId : client_id;

  if (!clientId) {
    return NextResponse.json({ error: "client_id is required" }, { status: 400 });
  }

  const { data: clientProfile } = await admin
    .from("client_profiles")
    .select("id, user_id, business_name")
    .eq("id", clientId)
    .single<{ id: string; user_id: string; business_name: string | null }>();

  if (!clientProfile) {
    return NextResponse.json({ error: "Client conversation not found" }, { status: 404 });
  }

  if (viewer.role === "client" && clientProfile.id !== viewer.clientProfileId) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const insertPayload = {
    client_id: clientProfile.id,
    sender_user_id: viewer.userId,
    sender_role: viewer.role,
    message: trimmed,
    read_by_admin: viewer.role === "admin",
    read_by_client: viewer.role === "client",
  };

  const { data: row, error } = await admin
    .from("inbox_messages")
    .insert(insertPayload)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const notificationUserId = viewer.role === "admin" ? clientProfile.user_id : null;
  let adminRecipientIds: string[] = [];

  if (viewer.role === "client") {
    const { data: adminUsers } = await admin
      .from("users")
      .select("id")
      .eq("role", "admin")
      .order("created_at", { ascending: true })
      .returns<Array<{ id: string }>>();

    adminRecipientIds = (adminUsers ?? []).map((user) => user.id);
  }

  const recipientUserIds =
    viewer.role === "admin"
      ? (notificationUserId ? [notificationUserId] : [])
      : adminRecipientIds;

  if (recipientUserIds.length > 0) {
    const title =
      viewer.role === "admin"
        ? "New inbox message from Marc"
        : `New inbox message from ${clientProfile.business_name || viewer.fullName}`;
    const link = viewer.role === "admin" ? "/portal/inbox" : `/admin/inbox?client=${clientProfile.id}`;

    await admin.from("notifications").insert(
      recipientUserIds.map((userId) => ({
        user_id: userId,
        title,
        message: trimmed.slice(0, 200),
        link,
      })),
    );

    await Promise.all(
      recipientUserIds.map(async (userId) => {
        try {
          await sendPushToUser(userId, {
            title,
            body: trimmed.slice(0, 140),
            url: link,
            tag: viewer.role === "admin" ? "inbox-from-marc" : `inbox-${clientProfile.id}`,
          });
        } catch (pushError) {
          console.error("Failed to send inbox push notification:", pushError);
        }
      }),
    );
  }

  return NextResponse.json({ message: row });
}
