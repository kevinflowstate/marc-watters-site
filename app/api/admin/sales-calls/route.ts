import { isBusinessManager } from "@/lib/ops/team-identities";
import { adminActor, respondPrivate } from "@/lib/ops/http";
import {
  validOutcome,
  outcomeStats,
} from "@/lib/ops/call-outcomes";
import { callsForPeriod, salesWindow } from "@/lib/ops/sales-calls";
import { OpsError } from "@/lib/ops/tasks";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  return respondPrivate(async () => {
    const actor = await adminActor();
    const before = new URL(request.url).searchParams.get("before");
    const now = Date.now();
    const range = salesWindow(before, now);
    const rows = await callsForPeriod(range.from, before ? range.to : now + 7 * 86400000);
    const calls = rows.filter((call) => Date.parse(call.endTime || call.startTime) <= now).reverse();
    const upcoming = before ? [] : rows.filter((call) =>
      call.status !== "cancelled" && Date.parse(call.endTime || call.startTime) > now,
    );
    return { calls, upcoming, stats: outcomeStats(calls), range, canEdit: isBusinessManager(actor) };
  });
}
export async function PATCH(request: Request) {
  return respondPrivate(async () => {
    const recorded_by = await adminActor();
    if (!isBusinessManager(recorded_by)) throw new OpsError("You have read-only access to sales calls.", 403);
    const { id, outcome, startTime, revision } = await request.json();
    const start = Date.parse(startTime);
    if (
      typeof id !== "string" ||
      id.length > 128 ||
      !validOutcome(outcome) ||
      !Number.isFinite(start) ||
      start > Date.now() ||
      (revision !== null && typeof revision !== "string")
    )
      throw new OpsError("Invalid call outcome");
    const booking = (await callsForPeriod(start - 60000, start + 60000)).find(
      (b) => b.id === id,
    );
    if (
      !booking ||
      booking.status === "cancelled" ||
      Date.parse(booking.endTime || booking.startTime) > Date.now()
    )
      throw new OpsError("This completed booking could not be verified", 409);
    const data = {
      appointment_id: id,
      starts_at: booking.startTime,
      outcome,
      recorded_by,
    };
    const table = createAdminClient().from("cbb_sales_call_outcomes");
    const result =
      revision === null
        ? await table.insert(data).select("updated_at").single()
        : await table
            .update(data)
            .eq("appointment_id", id)
            .eq("updated_at", revision)
            .select("updated_at")
            .maybeSingle();
    if (result.error || !result.data)
      throw new OpsError(
        "Could not save this version. Reload the calls and try again.",
        409,
      );
    return { saved: true };
  });
}
