import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { normalizeAttachments } from "@/lib/attachments";
import type { InboxConversation, InboxMessage, InboxMessageReaction } from "@/lib/types";

type UserRole = "admin" | "client";

interface ViewerContext {
  userId: string;
  role: UserRole;
  fullName: string;
  email: string;
  clientProfileId: string | null;
}

interface ClientRecord {
  id: string;
  user_id: string;
  business_name: string | null;
}

interface UserRecord {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
}

export async function getInboxViewer(): Promise<ViewerContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("id, full_name, email, role")
    .eq("id", user.id)
    .single<UserRecord>();

  if (!profile) return null;

  let clientProfileId: string | null = null;

  if (profile.role === "client") {
    const { data: clientProfile } = await admin
      .from("client_profiles")
      .select("id")
      .eq("user_id", user.id)
      .single<{ id: string }>();

    clientProfileId = clientProfile?.id ?? null;
  }

  return {
    userId: profile.id,
    role: profile.role,
    fullName: profile.full_name,
    email: profile.email,
    clientProfileId,
  };
}

export async function listInboxConversations(viewer: ViewerContext): Promise<InboxConversation[]> {
  const admin = createAdminClient();

  if (viewer.role === "client") {
    if (!viewer.clientProfileId) return [];

    const [clientRows, messageRows] = await Promise.all([
      admin
        .from("client_profiles")
        .select("id, user_id, business_name")
        .eq("id", viewer.clientProfileId)
        .single<ClientRecord>(),
      admin
        .from("inbox_messages")
        .select("*")
        .eq("client_id", viewer.clientProfileId)
        .order("created_at", { ascending: false }),
    ]);

    if (!clientRows.data) return [];

    const conversation = buildConversations(
      [clientRows.data],
      [],
      normalizeInboxMessages((messageRows.data ?? []) as InboxMessage[]),
      viewer.role,
    );

    return conversation;
  }

  const [clientsRes, usersRes, messagesRes] = await Promise.all([
    admin
      .from("client_profiles")
      .select("id, user_id, business_name")
      .order("created_at", { ascending: true }),
    admin
      .from("users")
      .select("id, full_name, email, role")
      .eq("role", "client"),
    admin
      .from("inbox_messages")
      .select("*")
      .order("created_at", { ascending: false }),
  ]);

  return buildConversations(
    (clientsRes.data ?? []) as ClientRecord[],
    (usersRes.data ?? []) as UserRecord[],
    normalizeInboxMessages((messagesRes.data ?? []) as InboxMessage[]),
    viewer.role,
  );
}

function buildConversations(
  clients: ClientRecord[],
  users: UserRecord[],
  messages: InboxMessage[],
  viewerRole: UserRole,
): InboxConversation[] {
  const userMap = new Map(users.map((user) => [user.id, user]));
  const messageMap = new Map<string, InboxMessage[]>();

  for (const message of messages) {
    const bucket = messageMap.get(message.client_id) ?? [];
    bucket.push(message);
    messageMap.set(message.client_id, bucket);
  }

  const conversations = clients.map((client) => {
    const thread = messageMap.get(client.id) ?? [];
    const latest = thread[0] ?? null;
    const user = userMap.get(client.user_id);

    const unreadCount = thread.filter((message) =>
      viewerRole === "admin" ? message.sender_role === "client" && !message.read_by_admin : message.sender_role === "admin" && !message.read_by_client
    ).length;

    return {
      client_id: client.id,
      client_name: client.business_name || user?.full_name || "Client",
      client_email: user?.email || "",
      business_name: client.business_name,
      latest_message: getInboxPreview(latest),
      latest_message_at: latest?.created_at ?? null,
      latest_sender_role: latest?.sender_role ?? null,
      unread_count: unreadCount,
    } satisfies InboxConversation;
  });

  return conversations.sort((a, b) => {
    if (a.latest_message_at && b.latest_message_at) {
      return b.latest_message_at.localeCompare(a.latest_message_at);
    }
    if (a.latest_message_at) return -1;
    if (b.latest_message_at) return 1;
    return a.client_name.localeCompare(b.client_name);
  });
}

export async function getInboxThread(viewer: ViewerContext, requestedClientId?: string): Promise<{
  clientId: string;
  clientName: string;
  clientEmail: string;
  businessName: string | null;
  viewerUserId: string;
  messages: InboxMessage[];
} | null> {
  const admin = createAdminClient();
  const clientId = viewer.role === "client" ? viewer.clientProfileId : requestedClientId;

  if (!clientId) return null;

  const { data: clientProfile } = await admin
    .from("client_profiles")
    .select("id, user_id, business_name")
    .eq("id", clientId)
    .single<ClientRecord>();

  if (!clientProfile) return null;

  if (viewer.role === "client" && clientProfile.id !== viewer.clientProfileId) {
    return null;
  }

  const [messagesRes, userRes] = await Promise.all([
    admin
      .from("inbox_messages")
      .select("*")
      .eq("client_id", clientProfile.id)
      .order("created_at", { ascending: true }),
    admin
      .from("users")
      .select("id, full_name, email")
      .eq("id", clientProfile.user_id)
      .single<{ id: string; full_name: string; email: string }>(),
  ]);

  const rawMessages = (messagesRes.data ?? []) as InboxMessage[];
  const messageIds = rawMessages.map((message) => message.id);
  const reactionsByMessage = await getReactionsByMessage(admin, messageIds);

  return {
    clientId: clientProfile.id,
    clientName: clientProfile.business_name || userRes.data?.full_name || "Client",
    clientEmail: userRes.data?.email || "",
    businessName: clientProfile.business_name,
    viewerUserId: viewer.userId,
    messages: normalizeInboxMessages(rawMessages, reactionsByMessage),
  };
}

export async function getInboxUnreadCount(viewer: ViewerContext): Promise<number> {
  const admin = createAdminClient();

  if (viewer.role === "client") {
    if (!viewer.clientProfileId) return 0;
    const { count } = await admin
      .from("inbox_messages")
      .select("*", { count: "exact", head: true })
      .eq("client_id", viewer.clientProfileId)
      .eq("sender_role", "admin")
      .eq("read_by_client", false);
    return count ?? 0;
  }

  const { count } = await admin
    .from("inbox_messages")
    .select("*", { count: "exact", head: true })
    .eq("sender_role", "client")
    .eq("read_by_admin", false);

  return count ?? 0;
}

async function getReactionsByMessage(
  admin: ReturnType<typeof createAdminClient>,
  messageIds: string[],
): Promise<Map<string, InboxMessageReaction[]>> {
  const reactionsByMessage = new Map<string, InboxMessageReaction[]>();
  if (messageIds.length === 0) return reactionsByMessage;

  const { data } = await admin
    .from("inbox_message_reactions")
    .select("id, message_id, user_id, emoji, created_at, user:users(full_name)")
    .in("message_id", messageIds)
    .order("created_at", { ascending: true });

  for (const reaction of data ?? []) {
    const normalized = normalizeInboxReaction(reaction);
    if (!normalized) continue;

    const bucket = reactionsByMessage.get(normalized.message_id) ?? [];
    bucket.push(normalized);
    reactionsByMessage.set(normalized.message_id, bucket);
  }

  return reactionsByMessage;
}

function normalizeInboxMessages(
  messages: InboxMessage[],
  reactionsByMessage = new Map<string, InboxMessageReaction[]>(),
): InboxMessage[] {
  return messages.map((message) => ({
    ...message,
    message: typeof message.message === "string" ? message.message : "",
    attachments: normalizeAttachments((message as InboxMessage & { attachments?: unknown }).attachments),
    reactions: reactionsByMessage.get(message.id) ?? [],
    reply_context: normalizeReplyContext((message as InboxMessage & { reply_context?: unknown }).reply_context),
  }));
}

function normalizeInboxReaction(raw: unknown): InboxMessageReaction | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const record = raw as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id : "";
  const messageId = typeof record.message_id === "string" ? record.message_id : "";
  const userId = typeof record.user_id === "string" ? record.user_id : "";
  const emoji = typeof record.emoji === "string" ? record.emoji : "";
  const createdAt = typeof record.created_at === "string" ? record.created_at : "";
  const rawUser = record.user;
  const user = Array.isArray(rawUser) ? rawUser[0] : rawUser;
  const userName =
    user && typeof user === "object" && !Array.isArray(user) && typeof (user as Record<string, unknown>).full_name === "string"
      ? ((user as Record<string, unknown>).full_name as string)
      : undefined;

  if (!id || !messageId || !userId || !emoji || !createdAt) return null;

  return {
    id,
    message_id: messageId,
    user_id: userId,
    emoji,
    created_at: createdAt,
    user_name: userName,
  };
}

function normalizeReplyContext(raw: unknown): InboxMessage["reply_context"] | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;

  const record = raw as Record<string, unknown>;
  if (record.type !== "checkin") return undefined;

  const title = typeof record.title === "string" ? record.title.trim() : "";
  const body = typeof record.body === "string" ? record.body.trim() : "";
  const href = typeof record.href === "string" ? record.href : undefined;

  if (!title || !body) return undefined;

  return {
    type: "checkin",
    title,
    body,
    href,
  };
}

function getInboxPreview(message: InboxMessage | null): string | null {
  if (!message) return null;

  const trimmed = message.message.trim();
  if (trimmed) return trimmed;

  const attachments = message.attachments ?? [];
  if (attachments.length === 1) {
    if (attachments[0].type === "audio") return "Voice note";
    return `Attachment: ${attachments[0].name}`;
  }
  if (attachments.length > 1) {
    return `${attachments.length} attachments`;
  }

  return null;
}
