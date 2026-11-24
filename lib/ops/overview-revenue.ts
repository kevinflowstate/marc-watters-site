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
    cashBank: "unverified" as const,
    otherCurrencies: [...new Set(accounts.flatMap((a) => a.currencies))],
  };
}
