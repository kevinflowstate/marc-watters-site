import { createAdminClient } from "@/lib/supabase/admin";
import { OpsError, record, uuid, type OpsTask } from "./tasks";
import { getClient } from "./clients";
import { createHash } from "node:crypto";

async function createOnboardingTask(input: Record<string, unknown>) {
  const result = await createAdminClient().rpc("ops_create_onboarding_task", { p_data: input });
  if (result.error) throw new OpsError("The onboarding task could not be saved; retry intake", 503);
  return result.data as OpsTask;
}

/** A new email is an intake request, never proof that access was approved. */
export async function preparePendingAdmission(name: string, email: string) {
  const identity = createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
  return createOnboardingTask({
    kind: "task", area: "onboarding", assignee: "eimear", source: "system",
    title: `Review access for ${name.slice(0, 200)}`,
    detail: "Confirm the agreed offer and admission requirements. No account, module access, activation invitation or welcome message has been created for this intake.",
    external_ref: `onboarding-intake:${identity}`, client_id: null,
    payload: { intake_name: name, intake_email: email, admission: "needs_human_review" },
  });
}
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
  const client = await getClient(uuid(id));
  if (client.archived_at) throw new OpsError("Archived clients cannot start onboarding", 409);
  const r = await createAdminClient().rpc("ops_start_onboarding", {
    p_client: client.id,
  });
  if (r.error) throw new OpsError(r.error.message, 409);
  return getClient(id);
}

/** Internal preparation only. No admission, activation invite, message or stage advancement. */
export async function prepareOnboardingChecklist(id: string) {
  const client = await getClient(uuid(id));
  if (client.archived_at) throw new OpsError("Archived clients cannot start onboarding", 409);
  if (client.onboarding_stage === "complete") return client;
  const steps = [
    ["admission", "Review the new client’s access", "Confirm the agreed offer and admission requirements before giving access or contacting the client."],
    ["community_added", "Add the client to the community", "Check that admission is agreed, then confirm community access. This task does not add anyone automatically."],
    ["pack_sent", "Send the client’s welcome pack", "Review the correct welcome pack and sending permission. This task does not send it."],
  ] as const;
  for (const [key, title, detail] of steps) {
    // Stable references also match the existing onboarding RPC's community/pack tasks.
    // The task store reuses existing records and preserves their human decisions.
    await createOnboardingTask({
      kind: "task", area: "onboarding", assignee: "eimear", title, detail,
      client_id: client.id, external_ref: `onboarding:${client.id}:${key}`,
      due_at: client.onboarding_due_at || null, source: "system",
    });
  }
  return client;
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
