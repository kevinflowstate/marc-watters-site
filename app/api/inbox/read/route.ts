import { getInboxViewer } from "@/lib/inbox-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const viewer = await getInboxViewer();

  if (!viewer) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { client_id } = await request.json().catch(() => ({}));
  const clientId = viewer.role === "client" ? viewer.clientProfileId : client_id;

  if (!clientId) {
    return NextResponse.json({ error: "client_id is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const update =
    viewer.role === "admin"
      ? { read_by_admin: true }
      : { read_by_client: true };
  const senderRole = viewer.role === "admin" ? "client" : "admin";

  const { error } = await admin
    .from("inbox_messages")
    .update(update)
    .eq("client_id", clientId)
    .eq("sender_role", senderRole);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
