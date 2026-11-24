import { describe, expect, it } from "vitest";
import { totalsForPeriod } from "@/lib/ops/overview-revenue";
import { londonMidnight, weekStart } from "@/lib/ops/task-weeks";

describe("business overview cutoffs and cash", () => {
  it("subtracts refunds in the period independently of when the charge was paid", () => {
    const charges = [
      {
        status: "succeeded",
        paid: true,
        currency: "gbp",
        amount_captured: 10000,
        created: 20,
        amount_refunded: 1500,
      },
      {
        status: "succeeded",
        paid: true,
        currency: "eur",
        amount_captured: 20000,
        created: 20,
      },
      {
        status: "failed",
        paid: false,
        currency: "gbp",
        amount_captured: 3000,
        created: 25,
      },
    ];
    const refunds = [
      {
        status: "succeeded",
        currency: "gbp",
        amount: 2500,
        created: 15,
        charge: "prior_month",
      },
      { status: "succeeded", currency: "gbp", amount: 1500, created: 30 },
      { status: "pending", currency: "gbp", amount: 1500, created: 20 },
    ];
    expect(totalsForPeriod(charges, refunds, [], 10, 30)).toEqual({
      netGBP: 75,
      payments: 1,
      refundsGBP: 25,
      recurring: 0,
    });
    expect(totalsForPeriod([], null, null, 10, 30)).toEqual({
      netGBP: null,
      payments: 0,
      refundsGBP: null,
      recurring: null,
    });
  });
  it("uses UK midnight for the week and month over BST and the change back", () => {
    expect(londonMidnight("2026-06-01").toISOString()).toBe(
      "2026-05-31T23:00:00.000Z",
    );
    expect(weekStart(new Date("2026-10-25T15:30Z")).toISOString()).toBe(
      "2026-10-18T23:00:00.000Z",
    );
    expect(londonMidnight("2026-11-01").toISOString()).toBe(
      "2026-11-01T00:00:00.000Z",
    );
  });
});
