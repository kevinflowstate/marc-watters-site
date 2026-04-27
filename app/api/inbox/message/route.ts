import { normalizeAttachments } from "@/lib/attachments";
import { getInboxViewer } from "@/lib/inbox-server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { InboxMessage } from "@/lib/types";
import { NextResponse } from "next/server";

async function getOwnMessage(messageId: unknown, userId: string) {
  if (typeof messageId !== "string" || !messageId) {
    return { error: NextResponse.json({ error: "message_id is required" }, { status: 400 }) };
  }

  const admin = createAdminClient();
  const { data: message } = await admin
    .from("inbox_messages")
    .select("*")
    .eq("id", messageId)
    .single<InboxMessage>();

  if (!message) {
    return { error: NextResponse.json({ error: "Message not found" }, { status: 404 }) };
  }

  if (message.sender_user_id !== userId) {
    return { error: NextResponse.json({ error: "Not authorized" }, { status: 403 }) };
  }

  return { admin, message };
}

export async function PATCH(request: Request) {
  const viewer = await getInboxViewer();

  if (!viewer) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { message_id, message } = await request.json().catch(() => ({}));
  const result = await getOwnMessage(message_id, viewer.userId);
  if (result.error) return result.error;

  const trimmed = typeof message === "string" ? message.trim() : "";
  const attachments = normalizeAttachments(result.message.attachments);

  if (!trimmed && attachments.length === 0) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const { data: updated, error } = await result.admin
    .from("inbox_messages")
    .update({ message: trimmed })
    .eq("id", result.message.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    message: {
      ...updated,
      attachments: normalizeAttachments(updated?.attachments),
    },
  });
}

export async function DELETE(request: Request) {
  const viewer = await getInboxViewer();

  if (!viewer) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { message_id } = await request.json().catch(() => ({}));
  const result = await getOwnMessage(message_id, viewer.userId);
  if (result.error) return result.error;

  const { error } = await result.admin
    .from("inbox_messages")
    .delete()
    .eq("id", result.message.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
