import { createAdminClient } from "@/lib/supabase/admin";
import { EIMEAR_USER_ID } from "./call-outcomes";
import { OpsError } from "./tasks";
type Interaction = {
  created_at: string;
  action: string;
  task_id: string | null;
  data?: { status?: string } | null;
};
export function activitySummary(rows: Interaction[]) {
  const tasks = new Set(
    rows
      .filter(
        (r) =>
          r.task_id && (r.action === "complete" || r.data?.status === "done"),
      )
      .map((r) => r.task_id),
  );
  const dates = [
    ...new Set(
      rows.map((r) => Date.parse(r.created_at)).filter(Number.isFinite),
    ),
  ].sort((a, b) => a - b);
  // Count only intervals bounded by two recorded staff actions close together.
  const activeMinutes = Math.round(
    dates.reduce((sum, at, i) => {
      const gap = i ? at - dates[i - 1] : 0;
      return sum + (gap <= 5 * 60000 ? gap : 0);
    }, 0) / 60000,
  );
  return { completed: tasks.size, actions: rows.length, activeMinutes };
}
export async function readTeamActivity(from: string, to: string) {
  const rows: Interaction[] = [];
  const db = createAdminClient();
  for (let start = 0; ; start += 1000) {
    const r = await db
      .from("ops_events")
      .select("created_at,action,task_id,data")
      .eq("actor", EIMEAR_USER_ID)
      .gte("created_at", from)
      .lt("created_at", to)
      .order("id")
      .range(start, start + 999);
    if (r.error) throw new OpsError("Portal activity could not be read", 503);
    rows.push(...(r.data || []));
    if ((r.data || []).length < 1000) break;
  }
  return activitySummary(rows);
}
