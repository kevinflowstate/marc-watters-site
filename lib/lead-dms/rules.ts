// Pure decisions for the Leads tab. No database, no network: easy to test.
import { AI_SETTER_APP, REPLY_WINDOW_MS } from "./config";
import type { CrmMessage } from "./crm";

export const OPEN_STATUSES = ["pending", "ready", "needs_marc", "skipped"] as const;
export const DECIDABLE_STATUSES = ["ready", "needs_marc", "skipped"] as const;

export type DmLine = { id: string; from: "lead" | "marc" | "ai"; text: string; media: number; at: string };

const isIg = (m: CrmMessage) => m.messageType === "TYPE_INSTAGRAM";
const fromAi = (m: CrmMessage) => m.direction === "outbound" && m.meta?.marketplace?.appName === AI_SETTER_APP;

/** Instagram messages oldest first, as lines a person (or the model) can read. */
export function toLines(messages: CrmMessage[]): DmLine[] {
  return messages
    .filter(isIg)
    .map((m) => ({
      id: m.id,
      from: m.direction === "inbound" ? ("lead" as const) : fromAi(m) ? ("ai" as const) : ("marc" as const),
      text: (m.body || "").trim(),
      media: (m.attachments || []).length,
      at: m.dateAdded,
    }))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

export type ThreadState =
  | { waiting: false; reason: "no_messages" | "replied" | "window_closed" | "ai_setter" }
  | { waiting: true; latest: DmLine; burst: DmLine[]; windowEndsAt: string; textless: boolean };

/**
 * Is this Instagram thread waiting on a reply from Marc's side?
 * - the newest Instagram message must be from the lead;
 * - it must be inside Instagram's 24-hour reply window;
 * - if Marc's AI setter has replied in the thread in the last 24 hours it is handling the lead, so the
 *   thread is left alone (otherwise the lead could get two answers).
 */
export function threadState(messages: CrmMessage[], now = new Date()): ThreadState {
  const lines = toLines(messages);
  const latest = lines[lines.length - 1];
  if (!latest) return { waiting: false, reason: "no_messages" };
  if (latest.from !== "lead") return { waiting: false, reason: "replied" };
  const latestMs = Date.parse(latest.at);
  if (now.getTime() - latestMs >= REPLY_WINDOW_MS) return { waiting: false, reason: "window_closed" };
  const aiRecently = lines.some((l) => l.from === "ai" && now.getTime() - Date.parse(l.at) < REPLY_WINDOW_MS);
  if (aiRecently) return { waiting: false, reason: "ai_setter" };

  const burst: DmLine[] = [];
  for (let i = lines.length - 1; i >= 0 && lines[i].from === "lead"; i -= 1) burst.unshift(lines[i]);
  return {
    waiting: true,
    latest,
    burst,
    windowEndsAt: new Date(latestMs + REPLY_WINDOW_MS).toISOString(),
    textless: burst.every((l) => !l.text),
  };
}

/** What a lead's message looks like in a list: its text, or what they shared. */
export function preview(line: Pick<DmLine, "text" | "media">) {
  if (line.text.trim()) return line.text.replace(/\s+/g, " ").trim().slice(0, 280);
  return line.media > 1 ? `Sent ${line.media} attachments` : line.media === 1 ? "Sent an attachment" : "Sent a message";
}

export type SendCheck = { ok: true } | { ok: false; status: "superseded" | "expired" | "newer"; message: string };

/**
 * Right before a send: re-read the thread. Blocks if anyone replied after the drafted message, if a newer
 * message arrived that the draft has not seen, or if Instagram's reply window has closed.
 */
export function checkBeforeSend(messages: CrmMessage[], draft: { inbound_message_id: string; inbound_at: string }, now = new Date()): SendCheck {
  const lines = toLines(messages);
  const after = lines.filter((l) => Date.parse(l.at) > Date.parse(draft.inbound_at) && l.id !== draft.inbound_message_id);
  const reply = after.find((l) => l.from !== "lead");
  if (reply) {
    return {
      ok: false,
      status: "superseded",
      message: reply.from === "ai" ? "The AI setter has already replied to this one." : "Marc has already replied to this one.",
    };
  }
  if (after.some((l) => l.from === "lead")) {
    return { ok: false, status: "newer", message: "They have sent another message since this was written. Refresh for an updated suggestion." };
  }
  if (now.getTime() - Date.parse(draft.inbound_at) >= REPLY_WINDOW_MS) {
    return { ok: false, status: "expired", message: "Instagram's 24-hour reply window has closed for this message." };
  }
  return { ok: true };
}

/** Whitespace-insensitive: a draft sent with only spacing changes counts as sent unchanged. */
export function sentStatus(draftText: string | null, finalText: string): "sent" | "edited_sent" {
  const norm = (v: string) => v.replace(/\s+/g, " ").trim();
  return draftText !== null && norm(draftText) === norm(finalText) ? "sent" : "edited_sent";
}
