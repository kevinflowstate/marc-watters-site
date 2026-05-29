import { getInboxViewer } from "@/lib/inbox-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

const ALLOWED_EMOJIS = new Set(["👍", "🔥", "✅", "👏", "🙏"]);

export async function POST(request: Request) {
  const viewer = await getInboxViewer();

  if (!viewer) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { message_id, emoji } = await request.json().catch(() => ({}));

  if (typeof message_id !== "string" || !message_id) {
    return NextResponse.json({ error: "message_id is required" }, { status: 400 });
  }

  if (typeof emoji !== "string" || !ALLOWED_EMOJIS.has(emoji)) {
    return NextResponse.json({ error: "Unsupported reaction" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: message } = await admin
    .from("inbox_messages")
    .select("id, client_id")
    .eq("id", message_id)
    .single<{ id: string; client_id: string }>();

  if (!message) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  if (viewer.role === "client" && message.client_id !== viewer.clientProfileId) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { data: existing } = await admin
    .from("inbox_message_reactions")
    .select("id")
    .eq("message_id", message.id)
    .eq("user_id", viewer.userId)
    .eq("emoji", emoji)
    .maybeSingle<{ id: string }>();

  if (existing) {
    const { error } = await admin
      .from("inbox_message_reactions")
      .delete()
      .eq("id", existing.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ reacted: false });
  }

  const { error } = await admin.from("inbox_message_reactions").insert({
    message_id: message.id,
    user_id: viewer.userId,
    emoji,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ reacted: true });
}
