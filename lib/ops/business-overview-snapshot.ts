import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { newLeads, publishedPosts } from "./business-dashboard";
import { callsForPeriod } from "./sales-calls";
import { strategyCalls } from "./report-sources";
import { outcomeStats } from "./call-outcomes";
import { summariseHubdocWeek } from "./hubdoc-week";
import { overviewRevenue } from "./overview-revenue";
import { londonDate, londonMidnight, weekStart } from "./task-weeks";
import { OpsError } from "./tasks";

const TABLE = "cbb_business_overview_snapshot";
const day = 86400000;
type Range = { from: string; to: string };

async function taskCounts(range: Range) {
  const db = createAdminClient();
  const open = () =>
    db
      .from("ops_tasks")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "in_progress", "awaiting_approval"]);
  const completed = async () => {
    const ids = new Set<string>();
    for (let start = 0; ; start += 1000) {
      const { error, data } = await db
        .from("ops_events")
        .select("id,task_id")
        .or("action.eq.complete,data->>status.eq.done")
        .gte("created_at", range.from)
        .lt("created_at", range.to)
        .order("id")
        .range(start, start + 999);
      if (error) return null;
      for (const row of data || []) if (row.task_id) ids.add(row.task_id);
      if ((data?.length ?? 0) < 1000) return ids.size;
    }
  };
  const [all, priority, done] = await Promise.all([
    open(),
    open().eq("priority", 1),
    completed(),
  ]);
  return {
    open: all.error ? null : all.count,
    priority: priority.error ? null : priority.count,
    completed: done,
  };
}

async function hubdoc(week: string, today: string) {
  const { error, data } = await createAdminClient()
    .from("ops_workspace_results")
    .select("run_key,summary,outcome")
    .eq("kind", "payments")
    .gte("run_key", "hubdoc:" + week)
    .lt("run_key", "hubdoc:" + today + "~");
  if (error) return null;
  const records = data || [];
  const summary = summariseHubdocWeek(records, week);
  // Today's brief may precede the forwarding job. Absence of a logged day is not proof of zero.
  const expectedDays = Math.min(
    5,
    1 + (Date.parse(today) - Date.parse(week)) / day,
  );
  const completeDaily = records.filter(
    (r) =>
      /^hubdoc:\d{4}-\d{2}-\d{2}:scheduled$/.test(r.run_key) &&
      new Date(r.run_key.slice(7, 17) + "T12:00:00Z").getUTCDay() % 6 !== 0 &&
      r.outcome === "complete" &&
      /^Hubdoc forwards: \d{1,6}\.(?:\s|$)/i.test(r.summary),
  ).length;
  return {
    ...summary,
    expectedDays,
    coverage:
      completeDaily === expectedDays ? ("complete" as const) : summary.coverage,
  };
}

async function weeklyCallStats(week: Date, nextWeek: Date, asOf: Date) {
  const rows = await callsForPeriod(week.getTime(), nextWeek.getTime());
  const cancelled = rows.filter((call) => call.status === "cancelled").length;
  return {
    ...outcomeStats(rows.filter((call) => Date.parse(call.endTime || call.startTime) <= asOf.getTime())),
    scheduled: rows.length - cancelled,
    cancelled,
  };
}

async function collect(now: Date) {
  const today = londonDate(now);
  const week = weekStart(now);
  const nextWeek = weekStart(new Date(week.getTime() + 8 * day));
  const monthDay = today.slice(0, 7) + "-01";
  const month = londonMidnight(monthDay);
  const current = { from: week.toISOString(), to: now.toISOString() };
  const previous = {
    from: weekStart(new Date(week.getTime() - day)).toISOString(),
    to: current.from,
  };
  const [revenue, leads, calls, bookings, posts, tasks, receipts] =
    await Promise.all([
      overviewRevenue(week, month, now),
      newLeads(current).catch(() => null),
      weeklyCallStats(week, nextWeek, now).catch(() => null),
      strategyCalls({ current, previous })
        .then((r) => (r.connected ? r.current.booked : null))
        .catch(() => null),
      publishedPosts(current).catch(() => null),
      taskCounts(current).catch(() => ({
        open: null,
        priority: null,
        completed: null,
      })),
      hubdoc(londonDate(week), today).catch(() => null),
    ]);
  return {
    asOf: now.toISOString(),
    weekStart: londonDate(week),
    monthStart: monthDay,
    revenue,
    operations: {
      leads,
      calls,
      bookingsMade: bookings,
      posts,
      tasks,
      hubdoc: receipts,
      recurring: revenue.week.recurring,
    },
  };
}
export type BusinessOverviewSnapshot = Awaited<ReturnType<typeof collect>>;

export async function readBusinessOverview(): Promise<BusinessOverviewSnapshot | null> {
  const row = await createAdminClient()
    .from(TABLE)
    .select("snapshot")
    .eq("singleton", true)
    .single();
  if (row.error)
    throw new OpsError("Dashboard snapshot could not be read", 503);
  const snapshot = row.data.snapshot as BusinessOverviewSnapshot | null;
  if (!snapshot) return null;
  // A saved outcome should appear on the next Dashboard visit, without rerunning finance or other sources.
  const week = londonMidnight(snapshot.weekStart);
  const nextWeek = weekStart(new Date(week.getTime() + 8 * day));
  const changed = await createAdminClient().from("cbb_sales_call_outcomes")
    .select("appointment_id").gte("starts_at", week.toISOString()).lt("starts_at", nextWeek.toISOString())
    .gt("updated_at", snapshot.asOf).limit(1);
  if (changed.error || changed.data?.length) {
    const calls = await weeklyCallStats(week, nextWeek, new Date()).catch(() => null);
    return { ...snapshot, operations: { ...snapshot.operations, calls } };
  }
  return snapshot;
}

async function refresh(morningOnly: boolean) {
  const db = createAdminClient();
  const now = new Date();
  const id = randomUUID();
  const time = now.toISOString();
  // 08:00 in London exists every day, including both DST transition dates.
  const currentDay = londonDate(now);
  const morning = new Date(currentDay + "T08:00:00Z");
  const localHour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(morning),
  );
  morning.setUTCHours(8 - (localHour - 8));
  let claim = db
    .from(TABLE)
    .update({
      lease_id: id,
      lease_until: new Date(now.getTime() + 150000).toISOString(),
    })
    .eq("singleton", true)
    .or("lease_until.is.null,lease_until.lt." + time);
  if (morningOnly)
    claim = claim.or(
      "refreshed_at.is.null,refreshed_at.lt." + morning.toISOString(),
    );
  const lock = await claim.select("singleton").maybeSingle();
  if (lock.error) throw new OpsError("Dashboard refresh could not start", 503);
  if (!lock.data) {
    const cached = await readBusinessOverview();
    if (cached && morningOnly && Date.parse(cached.asOf) >= morning.getTime())
      return cached;
    throw new OpsError("A dashboard refresh is already running", 409);
  }
  try {
    const snapshot = await collect(now);
    const saved = await db
      .from(TABLE)
      .update({
        snapshot,
        refreshed_at: time,
        lease_id: null,
        lease_until: null,
      })
      .eq("singleton", true)
      .eq("lease_id", id)
      .select("singleton")
      .maybeSingle();
    if (saved.error || !saved.data)
      throw new OpsError("Dashboard refresh could not be saved", 503);
    return snapshot;
  } catch (error) {
    await db
      .from(TABLE)
      .update({ lease_id: null, lease_until: null })
      .eq("singleton", true)
      .eq("lease_id", id);
    throw error;
  }
}
export const refreshBusinessOverview = () => refresh(false);
export const ensureMorningBusinessOverview = () => refresh(true);
