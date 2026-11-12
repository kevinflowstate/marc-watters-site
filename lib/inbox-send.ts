import { normalizeAttachments } from "@/lib/attachments";
import { getEnv } from "@/lib/env";
import { sendPushToUser } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Attachment } from "@/lib/types";

export type InboxSender = {
  userId: string;
  role: "admin" | "client";
  fullName: string;
  clientProfileId: string | null;
};

export class InboxSendError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

function isInboxStorageUrl(url: string, clientId: string) {
  const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL")?.replace(/\/$/, "");
  if (!supabaseUrl) return false;

  return url.startsWith(`${supabaseUrl}/storage/v1/object/public/plan-documents/inbox/${clientId}/`);
}

/**
 * The one inbox send path: stores the message, then the in-app notification and push for the other side.
 * Used by POST /api/inbox/send (typed messages) and by the reply-draft Send button, so both behave the same.
 */
export async function sendInboxMessage(
  viewer: InboxSender,
  input: { clientId?: string | null; message?: unknown; attachments?: unknown },
) {
  const trimmed = typeof input.message === "string" ? input.message.trim() : "";
  const normalizedAttachments: Attachment[] = normalizeAttachments(input.attachments);

  if (!trimmed && normalizedAttachments.length === 0) {
    throw new InboxSendError("message or attachment is required", 400);
  }

  const admin = createAdminClient();
  const clientId = viewer.role === "client" ? viewer.clientProfileId : input.clientId;

  if (!clientId) {
    throw new InboxSendError("client_id is required", 400);
  }

  const { data: clientProfile } = await admin
    .from("client_profiles")
    .select("id, user_id, business_name")
    .eq("id", clientId)
    .single<{ id: string; user_id: string; business_name: string | null }>();

  if (!clientProfile) {
    throw new InboxSendError("Client conversation not found", 404);
  }

  if (viewer.role === "client" && clientProfile.id !== viewer.clientProfileId) {
    throw new InboxSendError("Not authorized", 403);
  }

  if (normalizedAttachments.some((attachment) => !isInboxStorageUrl(attachment.url, clientProfile.id))) {
    throw new InboxSendError("Attachments must be uploaded through the inbox first", 400);
  }

  const insertPayload = {
    client_id: clientProfile.id,
    sender_user_id: viewer.userId,
    sender_role: viewer.role,
    message: trimmed,
    attachments: normalizedAttachments,
    read_by_admin: viewer.role === "admin",
    read_by_client: viewer.role === "client",
  };

  const { data: row, error } = await admin
    .from("inbox_messages")
    .insert(insertPayload)
    .select("*")
    .single();

  if (error) {
    throw new InboxSendError(error.message, 500);
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
    const preview =
      trimmed ||
      (normalizedAttachments.length === 1
        ? `Attachment: ${normalizedAttachments[0].name}`
        : `Sent ${normalizedAttachments.length} attachments`);
    const title =
      viewer.role === "admin"
        ? "New inbox message from Marc"
        : `New inbox message from ${clientProfile.business_name || viewer.fullName}`;
    const link = viewer.role === "admin" ? "/portal/inbox" : `/admin/inbox?client=${clientProfile.id}`;

    await admin.from("notifications").insert(
      recipientUserIds.map((userId) => ({
        user_id: userId,
        title,
        message: preview.slice(0, 200),
        link,
      })),
    );

    await Promise.all(
      recipientUserIds.map(async (userId) => {
        try {
          await sendPushToUser(userId, {
            title,
            body: preview.slice(0, 140),
            url: link,
            tag: viewer.role === "admin" ? "inbox-from-marc" : `inbox-${clientProfile.id}`,
          });
        } catch (pushError) {
          console.error("Failed to send inbox push notification:", pushError);
        }
      }),
    );
  }

  return {
    clientId: clientProfile.id,
    message: {
      ...row,
      attachments: normalizeAttachments(row?.attachments),
    },
  };
}
