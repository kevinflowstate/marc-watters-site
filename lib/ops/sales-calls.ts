import { strategyCallBookings } from "@/lib/lead-dms/crm";
import { getEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { OpsError } from "./tasks";
import { validOutcome, type CallOutcome } from "./call-outcomes";
const DAY = 86400000;
export function salesWindow(endDate?: string | null, now = Date.now()) {
  const end = endDate ? Date.parse(endDate + "T00:00:00Z") : now;
  if (
    !Number.isFinite(end) ||
    (endDate &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(endDate) ||
        new Date(end).toISOString().slice(0, 10) !== endDate ||
        end > now + DAY))
  )
    throw new OpsError("Invalid call period");
  const midnight = Date.parse(
    new Date(end).toISOString().slice(0, 10) + "T00:00:00Z",
  );
  return { from: midnight - 28 * DAY, to: end };
}
export async function callsForPeriod(from: number, to: number) {
  const bookings = await strategyCallBookings(
    from,
    to,
    { token: getEnv("CBB_GHL_PIT_TOKEN") || getEnv("GHL_LOCATION_TOKEN") },
    true,
  );
  const unique = [
    ...new Map(
      bookings
        .filter(
          (b) =>
            Date.parse(b.startTime) >= from && Date.parse(b.startTime) < to,
        )
        .map((b) => [b.id, b]),
    ).values(),
  ];
  const db = createAdminClient();
  const saved = new Map<string, { outcome: CallOutcome; updated_at: string }>();
  for (let i = 0; i < unique.length; i += 100) {
    const rows = await db
      .from("cbb_sales_call_outcomes")
      .select("appointment_id,outcome,updated_at")
      .in(
        "appointment_id",
        unique.slice(i, i + 100).map((b) => b.id),
      );
    if (rows.error)
      throw new OpsError("Saved sales outcomes are unavailable", 503);
    for (const r of rows.data || [])
      if (validOutcome(r.outcome)) saved.set(r.appointment_id, r);
  }
  return unique.map((b) => {
    const mark = saved.get(b.id);
    return {
      ...b,
      outcome:
        mark?.outcome ??
        (b.status.toLowerCase().replace(/[_ -]/g, "") === "noshow"
          ? ("no_show" as const)
          : null),
      revision: mark?.updated_at ?? null,
    };
  });
}
