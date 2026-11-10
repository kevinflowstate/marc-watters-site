import { getEnv } from "@/lib/env";

/**
 * Extra Thursday report figures: strategy calls from the CRM calendar and payments received in
 * Stripe. Each source says "not connected" when it cannot be read; nothing here is ever zero by
 * default. Payments are charges that succeeded in the period (net of refunds), which is money
 * taken, not invoices raised.
 */

type Range = { from: string; to: string };
type Fetch = typeof fetch;

const GHL = "https://services.leadconnectorhq.com";
const LOCATION = "93GJEdsr0cT9el3OINXq";
/** "Strategy Call" calendar in the CRM; the sales-call reviews use the same booking link. */
export const STRATEGY_CALENDAR = "4SOIodvlfHYmyzKvIAmn";
const DAY = 86_400_000;

const within = (iso: unknown, r: Range) => {
  const t = Date.parse(String(iso));
  return Number.isFinite(t) && t >= Date.parse(r.from) && t < Date.parse(r.to);
};

export async function strategyCalls(ranges: { current: Range; previous: Range }, f: Fetch = fetch) {
  const token = getEnv("GHL_LOCATION_TOKEN");
  if (!token) return { connected: false as const, note: "not connected" };
  try {
    const start = Date.parse(ranges.previous.from);
    // Bookings made this week can be for a slot weeks ahead, so look ahead 60 days.
    const end = Date.parse(ranges.current.to) + 60 * DAY;
    const url = `${GHL}/calendars/events?locationId=${LOCATION}&calendarId=${STRATEGY_CALENDAR}&startTime=${start}&endTime=${end}`;
    const r = await f(url, {
      headers: { Authorization: `Bearer ${token}`, Version: "2021-04-15" },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!r.ok) return { connected: false as const, note: "not connected" };
    const body = (await r.json()) as { events?: Record<string, unknown>[] };
    const events = (body.events || []).filter((e) => e.deleted !== true);
    const period = (range: Range) => {
      const held = events.filter((e) => within(e.startTime, range));
      const status = (e: Record<string, unknown>) => String(e.appointmentStatus ?? "unknown");
      const count = (rows: Record<string, unknown>[], s: string) => rows.filter((e) => status(e) === s).length;
      return {
        booked: events.filter((e) => within(e.dateAdded, range)).length,
        scheduled: held.length,
        showed: count(held, "showed"),
        no_show: count(held, "noshow"),
        cancelled: count(held, "cancelled"),
        not_yet_marked: count(held, "confirmed") + count(held, "new"),
      };
    };
    return {
      connected: true as const,
      calendar: "Strategy Call",
      note: "booked = bookings made in the period; scheduled = calls whose time fell in the period, by the status recorded in the CRM",
      current: period(ranges.current),
      previous: period(ranges.previous),
    };
  } catch {
    return { connected: false as const, note: "not connected" };
  }
}

type Account = { label: string; api_key: string };

function stripeAccounts(): Account[] {
  try {
    const all = JSON.parse(getEnv("OPS_STRIPE_PAYMENT_ACCOUNTS_JSON") || "{}") as Record<string, Record<string, unknown>>;
    return Object.entries(all)
      .filter(([, v]) => v && typeof v.api_key === "string" && v.api_key)
      .map(([alias, v]) => ({
        label: typeof v.label === "string" && v.label.trim() ? v.label.trim().slice(0, 120) : alias,
        api_key: String(v.api_key),
      }));
  } catch {
    return [];
  }
}

export async function paymentsReceived(
  ranges: { current: Range; previous: Range },
  f: Fetch = fetch,
  accounts: Account[] = stripeAccounts(),
) {
  if (!accounts.length) return { connected: false as const, note: "not connected" };
  const gte = Math.floor(Date.parse(ranges.previous.from) / 1000);
  const lt = Math.ceil(Date.parse(ranges.current.to) / 1000);
  const results = await Promise.all(
    accounts.map(async (a) => {
      try {
        const charges: Record<string, unknown>[] = [];
        let after = "";
        for (let page = 0; page < 20; page += 1) {
          const q = new URLSearchParams({ "created[gte]": String(gte), "created[lt]": String(lt), limit: "100" });
          if (after) q.set("starting_after", after);
          const r = await f(`https://api.stripe.com/v1/charges?${q}`, {
            headers: { Authorization: `Bearer ${a.api_key}` },
            signal: AbortSignal.timeout(15_000),
            cache: "no-store",
          });
          if (!r.ok) return { account: a.label, connected: false as const, note: "not connected - this key cannot read payments" };
          const body = (await r.json()) as { data?: Record<string, unknown>[]; has_more?: boolean };
          const rows = body.data || [];
          charges.push(...rows);
          if (!body.has_more || !rows.length) {
            const period = (range: Range) => {
              const paid = charges.filter(
                (c) => c.status === "succeeded" && c.paid === true && within(new Date(Number(c.created) * 1000).toISOString(), range),
              );
              const by: Record<string, { payments: number; amount: number; refunded: number }> = {};
              for (const c of paid) {
                const cur = String(c.currency || "gbp").toUpperCase();
                by[cur] ??= { payments: 0, amount: 0, refunded: 0 };
                by[cur].payments += 1;
                by[cur].amount += Number(c.amount_captured ?? c.amount ?? 0) / 100;
                by[cur].refunded += Number(c.amount_refunded ?? 0) / 100;
              }
              for (const v of Object.values(by)) {
                v.amount = Math.round(v.amount * 100) / 100;
                v.refunded = Math.round(v.refunded * 100) / 100;
              }
              return by;
            };
            return { account: a.label, connected: true as const, current: period(ranges.current), previous: period(ranges.previous) };
          }
          after = String(rows[rows.length - 1].id);
        }
        return { account: a.label, connected: false as const, note: "not connected - too many payments to read" };
      } catch {
        return { account: a.label, connected: false as const, note: "not connected" };
      }
    }),
  );
  return {
    connected: results.some((r) => r.connected),
    note: "successful card and bank payments taken in the period, by Stripe account; refunds shown separately. Not invoices raised, not payouts.",
    accounts: results,
  };
}
