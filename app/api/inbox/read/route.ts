import { getInboxViewer } from "@/lib/inbox-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const viewer = await getInboxViewer();

  if (!viewer) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { client_id, read = true, message_ids } = await request.json().catch(() => ({}));
  const clientId = viewer.role === "client" ? viewer.clientProfileId : client_id;

  if (!clientId) {
    return NextResponse.json({ error: "client_id is required" }, { status: 400 });
  }

  if (typeof read !== "boolean") {
    return NextResponse.json({ error: "read must be a boolean" }, { status: 400 });
  }

  const messageIds = Array.isArray(message_ids)
    ? message_ids.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];

  const admin = createAdminClient();
  const readField = viewer.role === "admin" ? "read_by_admin" : "read_by_client";
  const senderRole = viewer.role === "admin" ? "client" : "admin";

  if (!read && messageIds.length === 0) {
    const { data: latestMessage, error: latestMessageError } = await admin
      .from("inbox_messages")
      .select("id")
      .eq("client_id", clientId)
      .eq("sender_role", senderRole)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string }>();

    if (latestMessageError) {
      return NextResponse.json({ error: latestMessageError.message }, { status: 500 });
    }

    if (!latestMessage) {
      return NextResponse.json({ success: true, updated: 0 });
    }

    messageIds.push(latestMessage.id);
  }

  let updateQuery = admin
    .from("inbox_messages")
    .update({ [readField]: read })
    .eq("client_id", clientId)
    .eq("sender_role", senderRole);

  if (messageIds.length > 0) {
    updateQuery = updateQuery.in("id", messageIds);
  }

  const { error } = await updateQuery;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
