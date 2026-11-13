/** Explicitly linked inbox replies count without rewriting the check-in conversation. */
export const CHECKIN_INBOX_REPLY_SELECT =
  "inbox_reply:inbox_messages!checkins_inbox_reply_id_fkey(id,client_id,sender_role,created_at)";

export interface CheckinReplyRecord {
  id: string;
  client_id?: unknown;
  admin_reply?: unknown;
  replied_at?: unknown;
  created_at?: unknown;
  client_reply?: unknown;
  client_replied_at?: unknown;
  inbox_reply?: unknown;
}

function timestamp(value: unknown): number | null {
  const result = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(result) ? result : null;
}
function hasText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

export function checkinReplyState(row: CheckinReplyRecord) {
  if (!hasText(row.admin_reply))
    return { needs_reply: true, reason: "no_admin_reply" };
  const replied = timestamp(row.replied_at);
  const created = timestamp(row.created_at);
  if (replied === null || created === null || replied < created)
    return { needs_reply: null, reason: "reply_order_uncertain" };
  if (!hasText(row.client_reply))
    return { needs_reply: false, reason: "admin_replied" };
  const clientReplied = timestamp(row.client_replied_at);
  if (clientReplied === null || clientReplied < created || clientReplied === replied)
    return { needs_reply: null, reason: "reply_order_uncertain" };
  const linked = row.inbox_reply;
  if (linked && typeof linked === "object" && !Array.isArray(linked)) {
    const reply = linked as Record<string, unknown>;
    const inboxReplied = timestamp(reply.created_at);
    if (
      hasText(reply.id) && hasText(row.client_id) && reply.client_id === row.client_id &&
      reply.sender_role === "admin" && inboxReplied !== null && inboxReplied > clientReplied
    ) return { needs_reply: false, reason: "admin_replied_in_inbox" };
  }
  return {
    needs_reply: clientReplied > replied,
    reason: clientReplied > replied ? "client_replied_after_admin" : "admin_replied",
  };
}

