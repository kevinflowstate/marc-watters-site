import { describe, expect, it, vi } from "vitest";
import { combinedRevenue, manualSale, saveManualSale } from "@/lib/ops/manual-sales";
import { createAdminClient } from "@/lib/supabase/admin";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
const totals = { netGBP: 50, payments: 1, refundsGBP: 5, recurring: 1 };
const snapshot = {
  weekStart: "2026-11-30", monthStart: "2026-12-01",
  revenue: {
    coverage: "complete" as const, accounts: [], week: { ...totals, netGBP: 70 }, month: totals,
    daily: [{ date: "2026-11-30", netGBP: 20 }, { date: "2026-12-01", netGBP: 50 }], otherCurrencies: [],
  },
};
const days = [
  { paid_on: "2026-11-30", pence: 1250, payments: 1 },
  { paid_on: "2026-12-01", pence: 551, payments: 2 },
  { paid_on: "2026-12-02", pence: 10000, payments: 1 },
];
const input = { id: "a610296d-faa4-45e0-8ec4-fec72256a1d4", method: "cash", paid_on: "2025-01-01", amount_pence: 300, reference: "INV" };
describe("manual receipts in the business overview", () => {
  it("combines dated receipts with Stripe to the penny, including the prior month in this week", () => {
    const result = combinedRevenue(snapshot, days, new Date("2026-12-02T11:00:00Z"));
    expect(result.week).toEqual({ ...totals, netGBP: 188.01, payments: 5 });
    expect(result.month).toEqual({ ...totals, netGBP: 155.51, payments: 4 });
    expect(result.daily?.map(d => d.netGBP)).toEqual([32.5, 55.51, 100]);
    expect(snapshot.revenue.daily[1].netGBP).toBe(50);
  });
  it("rolls over the London reporting periods before the morning Stripe refresh", () => {
    const result = combinedRevenue(snapshot, [{ paid_on: "2027-01-01", pence: 201, payments: 1 }], new Date("2027-01-01T02:00Z"));
    expect(result.month).toEqual({ netGBP: 2.01, payments: 1, refundsGBP: 0, recurring: 0 });
    expect(result.week).toEqual(result.month);
    expect(result.daily?.at(-1)).toEqual({ date: "2027-01-01", netGBP: 2.01 });
  });
  it("preserves unavailable Stripe totals and legacy missing chart history", () => {
    const revenue = { ...snapshot.revenue, month: { ...totals, netGBP: null }, daily: null };
    const result = combinedRevenue({ ...snapshot, revenue }, days, new Date("2026-12-02T11:00Z"));
    expect(result.month.netGBP).toBeNull();
    expect(result.daily).toBeNull();
  });
  it("validates both methods, positive whole pence and an actual non-future calendar date", () => {
    expect(manualSale.safeParse(input).success).toBe(true);
    expect(manualSale.safeParse({ ...input, method: "bank_transfer" }).success).toBe(true);
    for (const change of [{ amount_pence: 0 }, { amount_pence: -1 }, { amount_pence: 2.5 },
      { paid_on: "2025-02-30" }, { paid_on: "2999-01-01" }, { method: "stripe" }]) {
      expect(manualSale.safeParse({ ...input, ...change }).success).toBe(false);
    }
  });
  it("confirms identical retries and rejects conflicting duplicates", async () => {
    const query = { insert: vi.fn().mockResolvedValue({ error: { code: "23505" } }),
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: input }) };
    vi.mocked(createAdminClient).mockReturnValue({ from: () => query } as unknown as ReturnType<typeof createAdminClient>);
    await expect(saveManualSale(input, "manager")).resolves.toBeUndefined();
    await expect(saveManualSale({ ...input, amount_pence: 400 }, "manager")).rejects.toMatchObject({ status: 409 });
    expect(query.eq).toHaveBeenCalledWith("created_by", "manager");
  });
});
