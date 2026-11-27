import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BusinessOverviewSnapshot } from "./business-overview-snapshot";
import { londonDate, weekStart } from "./task-weeks";
import { OpsError } from "./tasks";

export const manualSale = z.object({
  id: z.uuid(),
  paid_on: z.iso.date().refine(date => date <= londonDate(new Date()), "Choose today or an earlier date"),
  method: z.enum(["bank_transfer", "cash"]),
  amount_pence: z.number().int().min(1).max(2147483647),
  reference: z.string().trim().max(160).default(""),
});
type Sale = z.infer<typeof manualSale>;
type Day = { paid_on: string; pence: number; payments: number };
type Snapshot = Pick<BusinessOverviewSnapshot, "weekStart" | "monthStart" | "revenue">;

export async function saveManualSale(body: unknown, actor: string) {
  const parsed = manualSale.safeParse(body);
  if (!parsed.success) throw new OpsError("Check the payment date, method, amount and reference.", 400);
  const sale = parsed.data;
  const db = createAdminClient();
  const { error } = await db.from("cbb_manual_sales").insert({ ...sale, created_by: actor });
  if (!error) return;
  if (error.code !== "23505") throw new OpsError("Could not record the sale. Try again.", 503);
  const prior = await db.from("cbb_manual_sales").select("method,paid_on,amount_pence,reference")
    .eq("id", sale.id).eq("created_by", actor).maybeSingle();
  if (prior.error) throw new OpsError("Could not confirm the sale. Try again.", 503);
  if (!prior.data || prior.data.method !== sale.method || prior.data.paid_on !== sale.paid_on ||
      prior.data.amount_pence !== sale.amount_pence || prior.data.reference !== sale.reference)
    throw new OpsError("This entry was already saved with different details. Refresh to check it.", 409);
}

function reportingDates(now: Date) {
  const today = londonDate(now);
  return { today, weekStart: londonDate(weekStart(now)), monthStart: today.slice(0, 7) + "-01" };
}

export function combinedRevenue(snapshot: Snapshot, days: Day[], now: Date) {
  const { today, weekStart, monthStart } = reportingDates(now);
  const stripe = snapshot.revenue;
  function period(key: "week" | "month", start: string, snapshotStart: string) {
    const totals = stripe[key];
    const entries = days.filter(d => d.paid_on >= start && d.paid_on <= today);
    // When the period rolls over before the next Stripe refresh, none of the old period carries over.
    const base = (value: number | null) => value === null ? null : snapshotStart === start ? value : 0;
    const net = base(totals.netGBP);
    const count = base(totals.payments);
    return {
      netGBP: net === null ? null : (Math.round(net * 100) + entries.reduce((n, d) => n + d.pence, 0)) / 100,
      payments: count === null ? null : count + entries.reduce((n, d) => n + d.payments, 0),
      refundsGBP: base(totals.refundsGBP),
      recurring: base(totals.recurring),
    };
  }
  const start = weekStart < monthStart ? weekStart : monthStart;
  const stripeDays = new Map(stripe.daily?.map(d => [d.date, Math.round(d.netGBP * 100)]));
  const manualDays = new Map(days.map(d => [d.paid_on, d.pence]));
  const daily = stripe.daily ? [] as { date: string; netGBP: number }[] : null;
  if (daily) {
    for (let at = Date.parse(start + "T12:00:00Z"); ; at += 86400000) {
      const date = new Date(at).toISOString().slice(0, 10);
      daily.push({ date, netGBP: ((stripeDays.get(date) ?? 0) + (manualDays.get(date) ?? 0)) / 100 });
      if (date === today) break;
    }
  }
  return { ...stripe, today, weekStart, monthStart, daily,
    week: period("week", weekStart, snapshot.weekStart), month: period("month", monthStart, snapshot.monthStart) };
}

export async function readCombinedRevenue(snapshot: Snapshot, now = new Date()) {
  const { today, monthStart, weekStart } = reportingDates(now);
  const db = createAdminClient();
  const [daily, recent] = await Promise.all([
    db.from("cbb_manual_sales_daily").select("paid_on,pence,payments")
      .gte("paid_on", weekStart < monthStart ? weekStart : monthStart).lte("paid_on", today),
    db.from("cbb_manual_sales").select("id,paid_on,method,amount_pence,reference")
      .order("created_at", { ascending: false }).order("id").limit(5),
  ]);
  if (daily.error || recent.error) throw new OpsError("Manual sales could not be loaded. Try Refresh.", 503);
  return { ...combinedRevenue(snapshot, daily.data, now), recentSales: recent.data as Sale[] };
}
