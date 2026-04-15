import { getInboxViewer } from "@/lib/inbox-server";
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
  let adminRecipientId: string | null = null;

  if (viewer.role === "client") {
    const { data: adminUser } = await admin
      .from("users")
      .select("id")
      .eq("role", "admin")
      .order("created_at", { ascending: true })
      .limit(1)
      .single<{ id: string }>();
    adminRecipientId = adminUser?.id ?? null;
  }

  const recipientUserId = viewer.role === "admin" ? notificationUserId : adminRecipientId;

  if (recipientUserId) {
    await admin.from("notifications").insert({
      user_id: recipientUserId,
      title: viewer.role === "admin" ? "New inbox message from Marc" : `New inbox message from ${clientProfile.business_name || viewer.fullName}`,
      message: trimmed.slice(0, 200),
      link: viewer.role === "admin" ? "/portal/inbox" : `/admin/inbox?client=${clientProfile.id}`,
    });
  }

  return NextResponse.json({ message: row });
}
