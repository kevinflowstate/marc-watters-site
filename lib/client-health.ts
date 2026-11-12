import type { SupabaseClient } from "@supabase/supabase-js";
import type { TrafficLight } from "./types";
import { weekStart } from "./ops/task-weeks";
import { staffReactedMessageIds } from "./inbox-reactions";

/**
 * How each client is doing, for the admin Dashboard, Clients list, Blueprint AI and the weekly email.
 * (Marc, 11 Nov 2026: "says clients haven't been active but they have been" and "everyone is red".)
 *
 * Two fixes over the old rule:
 * - "Active" is the latest of anything the client did: opened the portal, checked in, sent a message,
 *   used Blueprint AI or finished a lesson. It used to be the Home page visit and check-ins only.
 * - Check-ins are judged by the weekly round (form_config checkin_day, Thursday for CBB), not by a
 *   day count, so the gap between two Thursdays never turns anyone amber or red.
 */

const DAY = 86_400_000;
/** A round counts as missed once this long has passed since it opened (Thursday -> Monday). */
const ROUND_GRACE_DAYS = 4;
const QUIET_DAYS = 14;
const MESSAGE_WINDOW_DAYS = 14;
const ACTIVITY_LOOKBACK_DAYS = 180;
const CHUNK = 100;

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

export type ActivityKind = "opened the portal" | "checked in" | "sent a message" | "used Blueprint AI" | "finished a lesson";

export interface ClientActivity {
  at: string | null;
  kind: ActivityKind | null;
  /** Set when the latest message in the conversation is from the client and is recent. */
  awaiting_reply_since: string | null;
  awaiting_reply_unread: boolean;
}

export interface ClientHealth {
  status: TrafficLight;
  /** Short chip text. */
  label: string;
  /** One plain sentence on why. */
  reason: string;
  last_active_at: string | null;
  last_active_kind: ActivityKind | null;
  days_inactive: number | null;
  missed_rounds: number;
  checked_in_this_round: boolean;
  is_new: boolean;
  awaiting_reply_since: string | null;
  awaiting_reply_unread: boolean;
}

const ms = (v: string | null | undefined) => {
  if (!v) return NaN;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : NaN;
};

function weekdayIndex(day: string | null | undefined) {
  const i = WEEKDAYS.indexOf(String(day || "").toLowerCase());
  return i === -1 ? 3 : i;
}

/** When the check-in round containing `at` opened (00:00 London on the check-in day). */
export function roundStart(at: Date, checkinDay = "thursday"): Date {
  const start = weekStart(at).getTime() + weekdayIndex(checkinDay) * DAY;
  return new Date(start > at.getTime() ? start - 7 * DAY : start);
}

/**
 * Rounds the client has let pass since their last check-in (or since joining, if they never have).
 * The round in progress only counts once its grace period is over.
 */
export function missedRounds(lastCheckin: string | null, createdAt: string | null, now = new Date(), checkinDay = "thursday") {
  const last = ms(lastCheckin);
  let next: number;
  if (Number.isFinite(last)) {
    next = roundStart(new Date(last), checkinDay).getTime() + 7 * DAY;
  } else {
    const created = ms(createdAt);
    if (!Number.isFinite(created)) return 0;
    const first = roundStart(new Date(created), checkinDay).getTime();
    next = first === created ? first : first + 7 * DAY;
  }
  let missed = 0;
  for (let r = next; r + ROUND_GRACE_DAYS * DAY <= now.getTime(); r += 7 * DAY) missed += 1;
  return missed;
}

function shortDate(t: number) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short" }).format(new Date(t));
}

export function latestActivity(
  lastLogin: string | null,
  lastCheckin: string | null,
  extra?: Partial<ClientActivity> | null,
): { at: string | null; kind: ActivityKind | null } {
  const candidates: Array<[string | null | undefined, ActivityKind]> = [
    [lastLogin, "opened the portal"],
    [lastCheckin, "checked in"],
    [extra?.at, extra?.kind ?? "opened the portal"],
  ];
  let best: { at: string | null; kind: ActivityKind | null } = { at: null, kind: null };
  for (const [at, kind] of candidates) {
    const t = ms(at);
    if (Number.isFinite(t) && (!best.at || t > ms(best.at))) best = { at: new Date(t).toISOString(), kind };
  }
  return best;
}

export function clientHealth(
  input: {
    lastLogin: string | null;
    lastCheckin: string | null;
    createdAt: string | null;
    activity?: Partial<ClientActivity> | null;
  },
  now = new Date(),
  checkinDay = "thursday",
): ClientHealth {
  const latest = latestActivity(input.lastLogin, input.lastCheckin, input.activity);
  const activeAt = ms(latest.at ?? input.createdAt);
  const daysInactive = Number.isFinite(activeAt) ? Math.max(0, Math.floor((now.getTime() - activeAt) / DAY)) : null;
  const missed = missedRounds(input.lastCheckin, input.createdAt, now, checkinDay);
  const thisRound = roundStart(now, checkinDay).getTime();
  const checkedInThisRound = ms(input.lastCheckin) >= thisRound;
  const neverCheckedIn = !Number.isFinite(ms(input.lastCheckin));
  const isNew = neverCheckedIn && missed === 0;
  const lastSeen = Number.isFinite(activeAt) ? shortDate(activeAt) : "never";

  const base = {
    last_active_at: latest.at,
    last_active_kind: latest.kind,
    days_inactive: daysInactive,
    missed_rounds: missed,
    checked_in_this_round: checkedInThisRound,
    is_new: isNew,
    awaiting_reply_since: input.activity?.awaiting_reply_since ?? null,
    awaiting_reply_unread: Boolean(input.activity?.awaiting_reply_unread),
  };
  const lastCheckinText = neverCheckedIn ? "has not checked in yet" : `last checked in ${shortDate(ms(input.lastCheckin))}`;

  if (missed >= 2 && (daysInactive ?? Infinity) >= QUIET_DAYS) {
    return {
      ...base,
      status: "red",
      label: "Gone quiet",
      reason: `Nothing in the portal since ${lastSeen} and ${lastCheckinText}.`,
    };
  }
  if (missed >= 1) {
    return {
      ...base,
      status: "amber",
      label: missed === 1 ? "Missed check-in" : `Missed ${missed} check-ins`,
      reason: `Still active (${latest.kind ?? "seen"} ${lastSeen}) but ${lastCheckinText}.`,
    };
  }
  if ((daysInactive ?? 0) >= QUIET_DAYS) {
    return {
      ...base,
      status: "amber",
      label: `Quiet ${daysInactive} days`,
      reason: `Checked in on time but nothing in the portal since ${lastSeen}.`,
    };
  }
  return {
    ...base,
    status: "green",
    label: isNew ? "New" : "On track",
    reason: isNew ? "Joined recently; first check-in not due yet." : checkedInThisRound ? "Checked in this round." : "Up to date.",
  };
}

function chunks<T>(values: T[]) {
  const out: T[][] = [];
  for (let i = 0; i < values.length; i += CHUNK) out.push(values.slice(i, i + CHUNK));
  return out;
}

type Profile = { id: string; user_id: string };

/**
 * The latest thing each client did outside the Home page and check-ins, plus whether their
 * conversation is waiting on Marc. Read errors leave a client's extra activity empty, never fail the page.
 */
export async function loadClientActivity(
  admin: SupabaseClient,
  profiles: Profile[],
  now = new Date(),
): Promise<Map<string, ClientActivity>> {
  const result = new Map<string, ClientActivity>();
  for (const p of profiles) result.set(p.id, { at: null, kind: null, awaiting_reply_since: null, awaiting_reply_unread: false });
  if (!profiles.length) return result;

  const since = new Date(now.getTime() - ACTIVITY_LOOKBACK_DAYS * DAY).toISOString();
  const messageSince = now.getTime() - MESSAGE_WINDOW_DAYS * DAY;
  const byUser = new Map(profiles.map((p) => [p.user_id, p.id]));

  const bump = (clientId: string | undefined, at: string | null | undefined, kind: ActivityKind) => {
    if (!clientId || !at) return;
    const row = result.get(clientId);
    if (!row) return;
    const t = ms(at);
    if (Number.isFinite(t) && (!row.at || t > ms(row.at))) {
      row.at = new Date(t).toISOString();
      row.kind = kind;
    }
  };

  await Promise.all(
    chunks(profiles).map(async (group) => {
      const ids = group.map((p) => p.id);
      const userIds = group.map((p) => p.user_id).filter(Boolean);
      const [messages, ai, lessons] = await Promise.all([
        admin
          .from("inbox_messages")
          .select("id,client_id,sender_role,read_by_admin,created_at")
          .in("client_id", ids)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(5000),
        userIds.length
          ? admin.from("ai_usage").select("user_id,created_at").in("user_id", userIds).gte("created_at", since).order("created_at", { ascending: false }).limit(5000)
          : Promise.resolve({ data: [], error: null }),
        admin
          .from("content_progress")
          .select("client_id,completed_at")
          .in("client_id", ids)
          .gte("completed_at", since)
          .limit(5000),
      ]);

      type Msg = { id: string; client_id: string; sender_role: string; read_by_admin: boolean; created_at: string };
      const latestByClient = new Map<string, Msg>();
      for (const m of (messages.error ? [] : messages.data || []) as Msg[]) {
        if (!latestByClient.has(m.client_id)) latestByClient.set(m.client_id, m);
        if (m.sender_role === "client") bump(m.client_id, m.created_at, "sent a message");
      }
      // A thumbs up or heart from Marc on the client's latest message counts as a reply (Marc, 12 Nov 2026).
      const waiting = [...latestByClient.values()].filter((m) => m.sender_role === "client" && ms(m.created_at) >= messageSince);
      const reacted = waiting.length ? await staffReactedMessageIds(admin, waiting.map((m) => m.id)) : new Set<string>();
      for (const [clientId, m] of latestByClient) {
        const row = result.get(clientId);
        if (row && m.sender_role === "client" && ms(m.created_at) >= messageSince && !reacted.has(m.id)) {
          row.awaiting_reply_since = m.created_at;
          row.awaiting_reply_unread = m.read_by_admin === false;
        }
      }
      for (const a of (ai.error ? [] : ai.data || []) as Array<{ user_id: string; created_at: string }>) {
        bump(byUser.get(a.user_id), a.created_at, "used Blueprint AI");
      }
      for (const l of (lessons.error ? [] : lessons.data || []) as Array<{ client_id: string; completed_at: string | null }>) {
        bump(l.client_id, l.completed_at, "finished a lesson");
      }
    }),
  );
  return result;
}

/** The weekly check-in day Marc set in the check-in form settings (Thursday by default). */
export async function loadCheckinDay(admin: SupabaseClient): Promise<string> {
  const { data } = await admin.from("form_config").select("config").eq("form_type", "checkin").maybeSingle();
  const day = (data?.config as { checkin_day?: string } | null)?.checkin_day;
  return WEEKDAYS.includes(String(day || "").toLowerCase()) ? String(day).toLowerCase() : "thursday";
}
