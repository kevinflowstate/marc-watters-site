import { MARC_USER_ID } from "@/lib/ops/team-identities";
import { adminActor, respond } from "@/lib/ops/http";
import {
  validOutcome,
  outcomeStats,
} from "@/lib/ops/call-outcomes";
import { callsForPeriod, salesWindow } from "@/lib/ops/sales-calls";
import { OpsError } from "@/lib/ops/tasks";
import { createAdminClient } from "@/lib/supabase/admin";

async function marc() {
  const id = await adminActor();
  if (id !== MARC_USER_ID) throw new OpsError("Not found", 404);
  return id;
}
export async function GET(request: Request) {
  return respond(async () => {
    await marc();
    const range = salesWindow(new URL(request.url).searchParams.get("before"));
    const calls = (await callsForPeriod(range.from, range.to))
      .filter((c) => Date.parse(c.endTime || c.startTime) <= Date.now())
      .reverse();
    return { calls, stats: outcomeStats(calls), range };
  });
}
export async function PATCH(request: Request) {
  return respond(async () => {
    const recorded_by = await marc();
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
