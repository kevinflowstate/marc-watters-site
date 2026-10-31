import { createAdminClient } from "@/lib/supabase/admin";
import { OpsError, record, uuid } from "./tasks";
import { getClient } from "./clients";
export const onboardingStages = [
  "none",
  "invited",
  "form_received",
  "paid",
  "welcomed",
  "community_added",
  "pack_sent",
  "complete",
] as const;
export async function startOnboarding(id: string) {
  const r = await createAdminClient().rpc("ops_start_onboarding", {
    p_client: uuid(id),
  });
  if (r.error) throw new OpsError(r.error.message, 409);
  return getClient(id);
}
export async function updateClientSignals(
  id: string,
  input: unknown,
  actor = "ops-token",
) {
  const b = record(input),
    c = await getClient(id),
    updates: Record<string, unknown> = {};
  for (const k of Object.keys(b))
    if (
      !["stage", "payment_status", "next_action", "next_action_due"].includes(k)
    )
      throw new OpsError("Unsupported signal field");
  if (b.stage !== undefined) {
    const stage = String(b.stage),
      index = onboardingStages.indexOf(
        stage as (typeof onboardingStages)[number],
      );
    if (index < 0) throw new OpsError("Invalid onboarding stage");
    if (index < onboardingStages.indexOf(c.onboarding_stage))
      throw new OpsError("Onboarding cannot move backwards");
    updates.onboarding_stage = stage;
    if (stage === "complete")
      updates.onboarding_completed_at =
        c.onboarding_completed_at || new Date().toISOString();
  }
  if (b.payment_status !== undefined) {
    if (
      !["current", "failed", "chasing", "paused", "cancelled"].includes(
        String(b.payment_status),
      )
    )
      throw new OpsError("Invalid payment status");
    updates.payment_status = b.payment_status;
    updates.payment_status_updated_at = new Date().toISOString();
  }
  if ("next_action" in b) {
    if (b.next_action !== null && typeof b.next_action !== "string")
      throw new OpsError("Invalid next action");
    updates.next_action = b.next_action;
  }
  if ("next_action_due" in b) {
    if (
      b.next_action_due !== null &&
      (typeof b.next_action_due !== "string" ||
        !Number.isFinite(Date.parse(b.next_action_due)))
    )
      throw new OpsError("Invalid next action due date");
    updates.next_action_due = b.next_action_due;
  }
  const r = await createAdminClient().rpc("ops_update_client_signals", {
    p_client: uuid(id),
    p_data: updates,
    p_actor: actor,
  });
  if (r.error) throw new OpsError(r.error.message, 409);
  return r.data;
}
