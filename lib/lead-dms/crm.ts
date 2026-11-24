// CRM (GHL) calls for the Leads tab. Verified 17 Nov 2026 with the portal's CRM token:
// conversations/search, conversations/{id}/messages and calendars/events return 200, and
// POST /conversations/messages accepts the token (it validated the body, not the auth).
// The token is read from the environment and never logged or returned.
import { getEnv } from "@/lib/env";
import { LEAD_LOCATION, STRATEGY_CALENDAR } from "./config";

const API = "https://services.leadconnectorhq.com";
const VERSION = "2021-04-15";

export class CrmError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

export type CrmDeps = { fetch?: typeof fetch; token?: string };

function token(deps: CrmDeps) {
  const t = (deps.token ?? getEnv("CBB_GHL_PIT_TOKEN"))?.trim();
  if (!t) throw new CrmError("CRM connection is not configured", 503);
  return t;
}

async function call<T>(path: string, deps: CrmDeps, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await (deps.fetch ?? fetch)(API + path, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token(deps)}`,
      Version: VERSION,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let message = "";
    try {
      message = String((JSON.parse(text) as { message?: unknown }).message ?? "");
    } catch {
      message = "";
    }
    throw new CrmError(`CRM ${init.method ?? "GET"} failed (${response.status})${message ? `: ${message.slice(0, 160)}` : ""}`, response.status >= 500 ? 502 : response.status);
  }
  return (await response.json()) as T;
}

export type CrmConversation = {
  id: string;
  contactId: string;
  fullName?: string;
  contactName?: string;
  profilePhoto?: string;
  lastMessageType?: string;
  lastMessageDirection?: "inbound" | "outbound";
  lastMessageDate?: number;
  lastMessageBody?: string;
  sort?: number[];
};

const idOk = (id: string) => /^[A-Za-z0-9]{6,64}$/.test(id);

/**
 * Conversations whose last message is an Instagram DM, newest first, back to `sinceMs`.
 * Pages with startAfterDate (the sort value of the last row).
 */
export async function recentInstagramConversations(sinceMs: number, deps: CrmDeps = {}, maxPages = 5): Promise<CrmConversation[]> {
  const out: CrmConversation[] = [];
  let after: number | null = null;
  for (let page = 0; page < maxPages; page += 1) {
    const q = new URLSearchParams({
      locationId: LEAD_LOCATION,
      lastMessageType: "TYPE_INSTAGRAM",
      sortBy: "last_message_date",
      sort: "desc",
      limit: "50",
    });
    if (after !== null) q.set("startAfterDate", String(after));
    const body = await call<{ conversations?: CrmConversation[] }>(`/conversations/search?${q}`, deps);
    const rows = body.conversations ?? [];
    for (const row of rows) {
      if (!row.lastMessageDate || row.lastMessageDate < sinceMs) return out;
      out.push(row);
    }
    if (rows.length < 50) return out;
    const last = rows[rows.length - 1];
    after = last.sort?.[0] ?? last.lastMessageDate ?? null;
    if (after === null) return out;
  }
  return out;
}

export type CrmMessage = {
  id: string;
  direction: "inbound" | "outbound";
  body?: string;
  attachments?: string[];
  dateAdded: string;
  messageType?: string;
  source?: string;
  meta?: { marketplace?: { appName?: string } };
};

/** The latest messages in a conversation, newest first (as the CRM returns them). */
export async function conversationMessages(conversationId: string, deps: CrmDeps = {}, limit = 30): Promise<CrmMessage[]> {
  if (!idOk(conversationId)) throw new CrmError("Invalid conversation id", 400);
  const body = await call<{ messages?: { messages?: CrmMessage[] } }>(
    `/conversations/${encodeURIComponent(conversationId)}/messages?limit=${Math.min(Math.max(limit, 1), 100)}`,
    deps,
  );
  return body.messages?.messages ?? [];
}

/** Sends an Instagram DM as Marc's account. The ONLY function in the Leads tab that sends anything. */
export async function sendInstagramMessage(contactId: string, message: string, deps: CrmDeps = {}) {
  if (!idOk(contactId)) throw new CrmError("Invalid contact id", 400);
  const body = await call<{ messageId?: string; conversationId?: string }>(`/conversations/messages`, deps, {
    method: "POST",
    body: { type: "IG", contactId, message },
  });
  return { messageId: body.messageId ?? null };
}

/** Best effort: mark the conversation read in the CRM after a reply goes out. */
export async function markConversationRead(conversationId: string, deps: CrmDeps = {}) {
  if (!idOk(conversationId)) return;
  try {
    await call(`/conversations/${encodeURIComponent(conversationId)}`, deps, { method: "PUT", body: { locationId: LEAD_LOCATION, unreadCount: 0 } });
  } catch (error) {
    console.error("lead_dms_mark_read_failed", error instanceof Error ? error.message : error);
  }
}

export type Booking = { id: string; name: string; startTime: string; endTime?: string; bookedAt: string | null; status: string };

/** Strategy Call bookings whose call time falls between from and to. */
export async function strategyCallBookings(fromMs: number, toMs: number, deps: CrmDeps = {}, includeCancelled = false): Promise<Booking[]> {
  const q = new URLSearchParams({
    locationId: LEAD_LOCATION,
    calendarId: STRATEGY_CALENDAR,
    startTime: String(fromMs),
    endTime: String(toMs - 1),
  });
  const body = await call<{ events?: Record<string, unknown>[] }>(`/calendars/events?${q}`, {
    ...deps, token: deps.token ?? (getEnv("CBB_GHL_PIT_TOKEN") || getEnv("GHL_LOCATION_TOKEN")),
  });
  if (!Array.isArray(body.events)) throw new CrmError("Strategy Call calendar response was incomplete");
  const latest = new Map<string, Record<string, unknown>>();
  for (const event of body.events) {
    if (!event.id || (event.calendarId && event.calendarId !== STRATEGY_CALENDAR)
      || (event.locationId && event.locationId !== LEAD_LOCATION)) continue;
    const id = String(event.id);
    const previous = latest.get(id);
    if (!previous || String(event.dateUpdated ?? "") >= String(previous.dateUpdated ?? "")) latest.set(id, event);
  }
  return [...latest.values()]
    .filter((e) => e.deleted !== true && (includeCancelled || String(e.appointmentStatus ?? "").toLowerCase() !== "cancelled"))
    .map((e) => ({
      id: String(e.id ?? ""),
      name: String(e.title ?? "Strategy call").replace(/\s+/g, " ").trim().slice(0, 120),
      startTime: String(e.startTime ?? ""),
      ...(e.endTime ? { endTime: String(e.endTime) } : {}),
      bookedAt: e.dateAdded ? String(e.dateAdded) : null,
      status: String(e.appointmentStatus ?? "unknown").toLowerCase(),
    }))
    .filter((e) => e.id && Date.parse(e.startTime) >= fromMs && Date.parse(e.startTime) < toMs)
    .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
}
