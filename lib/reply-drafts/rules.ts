// Pure decision logic for reply drafts. No database, no network: easy to test.

export type DraftKind = "inbox" | "checkin" | "checkin_followup";

export type DraftStatus =
  | "pending"
  | "ready"
  | "needs_marc"
  | "skipped"
  | "sent"
  | "edited_sent"
  | "discarded"
  | "superseded"
  | "failed";

/** Statuses that hold the one open slot for a conversation. */
export const OPEN_STATUSES: DraftStatus[] = ["pending", "ready", "needs_marc", "skipped"];
/** Generated and waiting for an admin decision. */
export const DECIDABLE_STATUSES: DraftStatus[] = ["ready", "needs_marc", "skipped"];

export type ThreadMessage = {
  id: string;
  sender_role: "admin" | "client";
  message: string;
  created_at: string;
  reply_context?: { type?: string; href?: string } | null;
};

export const inboxKey = (clientId: string) => `inbox:${clientId}`;
export const checkinKey = (checkinId: string) => `checkin:${checkinId}`;

/**
 * Should the latest state of an inbox thread get a draft?
 * Messages must be oldest first. reactedIds = messages an admin has reacted to (counts as answered).
 */
export function inboxDraftDecision(
  messages: ThreadMessage[],
  reactedIds: Set<string>,
  opts: { archived: boolean },
): { draft: false; reason: string } | { draft: true; burst: ThreadMessage[]; kind: DraftKind; checkinId: string | null } {
  if (opts.archived) return { draft: false, reason: "client_archived" };
  const latest = messages[messages.length - 1];
  if (!latest) return { draft: false, reason: "no_messages" };
  if (latest.sender_role === "admin") return { draft: false, reason: "admin_replied" };
  if (reactedIds.has(latest.id)) return { draft: false, reason: "admin_reacted" };

  // The burst: every client message since the last admin message.
  const burst: ThreadMessage[] = [];
  let lastAdmin: ThreadMessage | null = null;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].sender_role === "admin") {
      lastAdmin = messages[i];
      break;
    }
    burst.unshift(messages[i]);
  }

  const checkinId = lastAdmin?.reply_context?.type === "checkin" ? checkinIdFromHref(lastAdmin.reply_context.href) : null;
  return { draft: true, burst, kind: checkinId ? "checkin_followup" : "inbox", checkinId };
}

export function checkinIdFromHref(href: string | undefined | null): string | null {
  const match = /\/checkins\/([0-9a-f-]{36})/i.exec(href || "");
  return match ? match[1] : null;
}

export type OpenDraft = { id: string; status: DraftStatus; source_message_ids: string[] | null; claimed_at?: string | null };

/**
 * What to do with the conversation's open draft when a new client message lands.
 * - no open draft: create one, due 2 minutes after this message
 * - still pending (not written yet): push the due time back and add the message (debounce)
 * - already written but not sent: supersede it and start a new one that covers the whole burst
 */
export function planForNewClientMessage(
  open: OpenDraft | null,
  messageId: string,
  messageAt: Date,
  debounceMs: number,
):
  | { action: "create"; dueAt: string; sourceIds: string[] }
  | { action: "extend"; draftId: string; dueAt: string; sourceIds: string[] }
  | { action: "supersede_and_create"; supersedeId: string; dueAt: string; sourceIds: string[] } {
  const dueAt = new Date(messageAt.getTime() + debounceMs).toISOString();
  const previous = (open?.source_message_ids || []).filter((id) => id !== messageId);
  const sourceIds = [...previous, messageId];
  if (!open) return { action: "create", dueAt, sourceIds: [messageId] };
  if (open.status === "pending") return { action: "extend", draftId: open.id, dueAt, sourceIds };
  return { action: "supersede_and_create", supersedeId: open.id, dueAt, sourceIds };
}

export type ModelDraft = {
  draft: string;
  needs_marc: boolean;
  needs_marc_reason: string | null;
  skip: boolean;
  skip_reason: string | null;
};

export const DRAFT_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["draft", "needs_marc", "needs_marc_reason", "skip", "skip_reason"],
  properties: {
    draft: { type: "string" },
    needs_marc: { type: "boolean" },
    needs_marc_reason: { anyOf: [{ type: "string" }, { type: "null" }] },
    skip: { type: "boolean" },
    skip_reason: { anyOf: [{ type: "string" }, { type: "null" }] },
  },
} as const;

/** Parse and validate the model's JSON. Throws on anything malformed. */
export function parseModelDraft(text: string): ModelDraft {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const raw = JSON.parse(trimmed) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  if (typeof raw.draft !== "string" || typeof raw.needs_marc !== "boolean" || typeof raw.skip !== "boolean") {
    throw new Error("invalid_model_output");
  }
  return {
    draft: raw.draft.trim(),
    needs_marc: raw.needs_marc,
    needs_marc_reason: str(raw.needs_marc_reason),
    skip: raw.skip,
    skip_reason: str(raw.skip_reason),
  };
}

/** Map the model's answer onto a stored draft. Skip wins over needs-Marc; an empty draft is treated as a skip. */
export function outcomeFromModel(out: ModelDraft): { status: "ready" | "needs_marc" | "skipped"; draftText: string | null; reason: string | null } {
  if (out.skip || !out.draft) {
    return { status: "skipped", draftText: null, reason: oneLine(out.skip_reason || "Reply yourself") };
  }
  if (out.needs_marc) {
    return { status: "needs_marc", draftText: out.draft, reason: oneLine(out.needs_marc_reason || "Check this before sending") };
  }
  return { status: "ready", draftText: out.draft, reason: null };
}

function oneLine(text: string) {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length > 160 ? `${line.slice(0, 157)}...` : line;
}

/** Whitespace-insensitive comparison: a draft sent with only spacing changes counts as sent unchanged. */
export function sentStatus(draftText: string | null, finalText: string): "sent" | "edited_sent" {
  const norm = (v: string) => v.replace(/\s+/g, " ").trim();
  return draftText !== null && norm(draftText) === norm(finalText) ? "sent" : "edited_sent";
}

export type DraftStats = {
  total: number;
  decided: number;
  sentUnchanged: number;
  edited: number;
  discarded: number;
  sentUnchangedPct: number;
  editedPct: number;
  discardedPct: number;
};

/** Monthly decision stats for admin Settings. Counts only, never money. */
export function draftStats(rows: Array<{ status: string }>): DraftStats {
  const count = (s: string) => rows.filter((r) => r.status === s).length;
  const sentUnchanged = count("sent");
  const edited = count("edited_sent");
  const discarded = count("discarded");
  const decided = sentUnchanged + edited + discarded;
  const pct = (n: number) => (decided ? Math.round((n / decided) * 100) : 0);
  const total = rows.filter((r) => r.status !== "superseded" && r.status !== "failed").length;
  return {
    total,
    decided,
    sentUnchanged,
    edited,
    discarded,
    sentUnchangedPct: pct(sentUnchanged),
    editedPct: pct(edited),
    discardedPct: pct(discarded),
  };
}

/** Push notification copy for a ready or needs-you draft. */
export function pushCopy(clientName: string, status: "ready" | "needs_marc", draftText: string | null, reason: string | null) {
  const body =
    status === "needs_marc"
      ? `Needs you: ${reason || "check before sending"}`
      : (draftText || "").replace(/\s+/g, " ").trim();
  return {
    title: `Reply to approve for ${clientName}`,
    body: body.length > 100 ? `${body.slice(0, 99)}...` : body,
  };
}
