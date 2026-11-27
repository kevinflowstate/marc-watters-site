import { stripePaymentAccount } from "./payment-stripe";
import { stripeList } from "./report-sources";

const merchants = ["mrw", "mrw-2"];
type Row = Record<string, unknown>;
type Coverage = "complete" | "partial" | "missing";
type Amounts = {
  netGBP: number | null;
  payments: number | null;
  refundsGBP: number | null;
  recurring: number | null;
};

// Refunds are counted on the refund date, including refunds of charges collected before this period.
export function totalsForPeriod(
  charges: Row[] | null,
  refunds: Row[] | null,
  invoices: Row[] | null,
  from: number,
  to: number,
): Amounts {
  const inRange = (date: unknown) =>
    typeof date === "number" && date >= from && date < to;
  const paid = charges?.filter(
    (c) =>
      c.status === "succeeded" &&
      c.paid === true &&
      c.currency === "gbp" &&
      Number(c.amount_captured) > 0 &&
      inRange(c.created),
  );
  const returned = refunds?.filter(
    (r) =>
      r.status === "succeeded" && r.currency === "gbp" && inRange(r.created),
  );
  const receivedPence = paid?.reduce(
    (sum, c) => sum + Number(c.amount_captured),
    0,
  );
  const refundedPence = returned?.reduce((sum, r) => sum + Number(r.amount), 0);
  const recurring = invoices?.filter(
    (i) =>
      i.billing_reason === "subscription_cycle" &&
      Number(i.amount_paid) > 0 &&
      inRange((i.status_transitions as Row | null)?.paid_at),
  ).length;
  return {
    netGBP:
      receivedPence != null && refundedPence != null
        ? (receivedPence - refundedPence) / 100
        : null,
    payments: paid?.length ?? null,
    refundsGBP: refundedPence != null ? refundedPence / 100 : null,
    recurring: recurring ?? null,
  };
}

const londonDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Net GBP pence per London day, using the same charge and refund rules as totalsForPeriod. */
export function dailyNetPence(
  charges: Row[] | null,
  refunds: Row[] | null,
  from: number,
  to: number,
): Map<string, number> | null {
  if (!charges || !refunds) return null;
  const days = new Map<string, number>();
  const add = (at: unknown, pence: number) => {
    if (typeof at !== "number" || at < from || at >= to) return;
    const key = londonDay.format(new Date(at * 1000));
    days.set(key, (days.get(key) ?? 0) + pence);
  };
  for (const c of charges)
    if (
      c.status === "succeeded" &&
      c.paid === true &&
      c.currency === "gbp" &&
      Number(c.amount_captured) > 0
    )
      add(c.created, Number(c.amount_captured));
  for (const r of refunds)
    if (r.status === "succeeded" && r.currency === "gbp")
      add(r.created, -Number(r.amount));
  return days;
}

/** One entry per London day from `from` to `to`; null when any merchant is incomplete. */
export function dailySeries(
  perAccount: (Map<string, number> | null)[],
  from: number,
  to: number,
) {
  if (!perAccount.length || perAccount.some((m) => m === null)) return null;
  const series: { date: string; netGBP: number }[] = [];
  const last = londonDay.format(new Date(to * 1000 - 1));
  for (let at = from * 1000 + 12 * 3600000; ; at += 86400000) {
    const date = londonDay.format(new Date(at));
    if (series.at(-1)?.date === date) continue;
    if (date > last) break;
    const pence = perAccount.reduce((n, m) => n + (m!.get(date) ?? 0), 0);
    series.push({ date, netGBP: Math.round(pence) / 100 });
    if (date === last) break;
  }
  return series;
}

function combine(values: Amounts[]) {
  const sum = (key: keyof Amounts) =>
    values.some((v) => v[key] === null)
      ? null
      : Math.round(values.reduce((n, v) => n + (v[key] ?? 0), 0) * 100) / 100;
  return {
    netGBP: sum("netGBP"),
    payments: sum("payments"),
    refundsGBP: sum("refundsGBP"),
    recurring: sum("recurring"),
  };
}

export async function overviewRevenue(
  week: Date,
  month: Date,
  now: Date,
  request = fetch,
) {
  const from = Math.min(week.getTime(), month.getTime()) / 1000;
  const to = now.getTime() / 1000;
  const range = {
    "created[gte]": String(Math.floor(from)),
    "created[lt]": String(Math.ceil(to)),
  };
  const seen = new Set<string>();
  const accounts = await Promise.all(
    merchants.map(async (alias) => {
      let label = alias;
      let charges: Row[] | null = null,
        refunds: Row[] | null = null,
        invoices: Row[] | null = null;
      try {
        const account = stripePaymentAccount(alias);
        label = account.label || alias;
        const identity = await request("https://api.stripe.com/v1/account", {
          headers: { Authorization: "Bearer " + account.api_key },
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(10000),
        });
        if (
          !identity.ok ||
          (await identity.json()).id !== account.account_id ||
          !account.livemode ||
          seen.has(account.account_id)
        )
          throw new Error("Merchant identity unavailable");
        seen.add(account.account_id);
        const list = async (path: string, params: Record<string, string>) => {
          try {
            const result = await stripeList(
              request,
              account.api_key,
              path,
              params,
            );
            return result.ok && result.rows.every((r) => r.livemode !== false)
              ? result.rows
              : null;
          } catch {
            return null;
          }
        };
        // Paid invoices can have been created before both periods. A truncated list stays unknown.
        [charges, refunds, invoices] = await Promise.all([
          list("charges", range),
          list("refunds", range),
          list("invoices", {
            status: "paid",
            "created[lt]": range["created[lt]"],
          }),
        ]);
      } catch {
        /* A missing merchant contributes no invented zeroes. */
      }
      const coverage: Coverage =
        charges && refunds
          ? "complete"
          : charges || refunds
            ? "partial"
            : "missing";
      return {
        label,
        coverage,
        daily: dailyNetPence(charges, refunds, from, to),
        week: totalsForPeriod(
          charges,
          refunds,
          invoices,
          week.getTime() / 1000,
          to,
        ),
        month: totalsForPeriod(
          charges,
          refunds,
          invoices,
          month.getTime() / 1000,
          to,
        ),
        currencies: [
          ...new Set(
            [...(charges || []), ...(refunds || [])]
              .map((c) => String(c.currency).toUpperCase())
              .filter((c) => c !== "GBP"),
          ),
        ],
      };
    }),
  );
  const coverage: Coverage = accounts.every((a) => a.coverage === "complete")
    ? "complete"
    : accounts.every((a) => a.coverage === "missing")
      ? "missing"
      : "partial";
  return {
    coverage,
    accounts: accounts.map(({ label, coverage }) => ({ label, coverage })),
    week: combine(accounts.map((a) => a.week)),
    month: combine(accounts.map((a) => a.month)),
    daily: dailySeries(
      accounts.map((a) => a.daily),
      Math.floor(from),
      Math.ceil(to),
    ),
    otherCurrencies: [...new Set(accounts.flatMap((a) => a.currencies))],
  };
}
