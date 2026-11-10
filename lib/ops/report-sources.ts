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

type Summary = Record<string, { payments: number; amount: number; refunded: number }>;

function summarise(items: { at: number; currency: string; amount: number; refunded: number }[], range: Range): Summary {
  const by: Summary = {};
  for (const x of items) {
    if (!within(new Date(x.at * 1000).toISOString(), range)) continue;
    const cur = x.currency.toUpperCase();
    by[cur] ??= { payments: 0, amount: 0, refunded: 0 };
    by[cur].payments += 1;
    by[cur].amount += x.amount / 100;
    by[cur].refunded += x.refunded / 100;
  }
  for (const v of Object.values(by)) {
    v.amount = Math.round(v.amount * 100) / 100;
    v.refunded = Math.round(v.refunded * 100) / 100;
  }
  return by;
}

async function stripeList(f: Fetch, key: string, path: string, params: Record<string, string>) {
  const rows: Record<string, unknown>[] = [];
  let after = "";
  for (let page = 0; page < 20; page += 1) {
    const q = new URLSearchParams({ ...params, limit: "100" });
    if (after) q.set("starting_after", after);
    const r = await f(`https://api.stripe.com/v1/${path}?${q}`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!r.ok) return { ok: false as const, status: r.status };
    const body = (await r.json()) as { data?: Record<string, unknown>[]; has_more?: boolean };
    const batch = body.data || [];
    rows.push(...batch);
    if (!body.has_more || !batch.length) return { ok: true as const, rows };
    after = String(batch[batch.length - 1].id);
  }
  return { ok: false as const, status: 507 };
}

/**
 * Money taken in each period, per Stripe account. Uses successful charges when the key can read
 * them; otherwise paid invoices by the date they were paid (restricted keys made for payment
 * alerts can read invoices only), which leaves out payments taken without an invoice.
 */
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
        const charges = await stripeList(f, a.api_key, "charges", { "created[gte]": String(gte), "created[lt]": String(lt) });
        if (charges.ok) {
          const items = charges.rows
            .filter((c) => c.status === "succeeded" && c.paid === true)
            .map((c) => ({
              at: Number(c.created),
              currency: String(c.currency || "gbp"),
              amount: Number(c.amount_captured ?? c.amount ?? 0),
              refunded: Number(c.amount_refunded ?? 0),
            }));
          return { account: a.label, connected: true as const, basis: "all successful payments", current: summarise(items, ranges.current), previous: summarise(items, ranges.previous) };
        }
        if (charges.status !== 401 && charges.status !== 403)
          return { account: a.label, connected: false as const, note: "not connected" };
        // Invoices can be paid long after they are raised, so look back 180 days and keep those PAID in the period.
        const invoices = await stripeList(f, a.api_key, "invoices", { status: "paid", "created[gte]": String(gte - 180 * 86_400), "created[lt]": String(lt) });
        if (!invoices.ok) return { account: a.label, connected: false as const, note: "not connected - this key cannot read payments or invoices" };
        const items = invoices.rows
          .filter((i) => Number(i.amount_paid) > 0)
          .map((i) => ({
            at: Number((i.status_transitions as Record<string, unknown> | undefined)?.paid_at ?? 0),
            currency: String(i.currency || "gbp"),
            amount: Number(i.amount_paid ?? 0),
            refunded: 0,
          }));
        return {
          account: a.label,
          connected: true as const,
          basis: "invoices paid in the period (payments without an invoice, and refunds, are not included)",
          current: summarise(items, ranges.current),
          previous: summarise(items, ranges.previous),
        };
      } catch {
        return { account: a.label, connected: false as const, note: "not connected" };
      }
    }),
  );
  return {
    connected: results.some((r) => r.connected),
    note: "money taken in the period, by Stripe account, by the date it was paid. Not invoices raised, not payouts.",
    accounts: results,
  };
}
