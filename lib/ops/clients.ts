import { createAdminClient } from "@/lib/supabase/admin";
import { OpsError, uuid } from "./tasks";
export async function listClients() {
  const r = await createAdminClient()
    .from("client_profiles")
    .select("*,users(full_name,email)")
    .limit(1000);
  if (r.error) throw new OpsError(r.error.message, 500);
  return r.data;
}
export async function getClient(id: string) {
  const r = await createAdminClient()
    .from("client_profiles")
    .select("*,users(full_name,email)")
    .eq("id", uuid(id))
    .maybeSingle();
  if (r.error) throw new OpsError(r.error.message, 500);
  if (!r.data) throw new OpsError("Client not found", 404);
  return r.data;
}
export async function listClientsNeedingAttention() {
  return (await listClients()).filter(
    (c) =>
      (c.payment_status && c.payment_status !== "current") ||
      (c.onboarding_due_at &&
        c.onboarding_stage !== "complete" &&
        Date.parse(c.onboarding_due_at) < Date.now()) ||
      (c.next_action_due && Date.parse(c.next_action_due) < Date.now()) ||
      Date.parse(c.last_checkin || c.created_at) < Date.now() - 14 * 86400000,
  );
}
