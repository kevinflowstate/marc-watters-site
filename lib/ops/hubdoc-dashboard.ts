import { createAdminClient } from "@/lib/supabase/admin";
import { summariseHubdocWeek } from "./hubdoc-week";
import { londonDate, weekStart } from "./task-weeks";

export async function readDashboardHubdoc(now: Date) {
  const week = londonDate(weekStart(now));
  const today = londonDate(now);
  // Include only the recognised source keys. Other jobs, free-text mentions and retries
  // cannot increase a week's count. The unique run_key constraint deduplicates imports.
  const monday = Date.parse(week + "T12:00:00Z");
  const keys = [`hubdoc:${week}:week-reconciled`];
  for (let i = 0; i < 5; i++) {
    const date = new Date(monday + i * 86400000).toISOString().slice(0, 10);
    if (date <= today)
      keys.push(`hubdoc:${date}:scheduled`, `hubdoc:${date}:sent-reconciled`);
  }
  const { data, error } = await createAdminClient()
    .from("ops_workspace_results")
    .select("run_key,summary,outcome")
    .eq("kind", "payments")
    .in("run_key", keys);
  if (error) return null;
  return {
    ...summariseHubdocWeek(data || [], week, today),
    weekStart: week,
    checkedAt: now.toISOString(),
  };
}
