import { createAdminClient } from "@/lib/supabase/admin";
import { OpsError, record } from "./tasks";
export async function recordPayment(input: unknown) {
  const b = record(input);
  if (
    ![
      "payment_failed",
      "payment_succeeded",
      "chase_sent",
      "subscription_cancelled",
      "payment_paused",
    ].includes(String(b.event_type))
  )
    throw new OpsError("Invalid event_type");
  if (
    typeof b.external_id !== "string" ||
    !b.external_id.trim() ||
    b.external_id.length > 300
  )
    throw new OpsError("external_id required");
  if (typeof b.contact_email !== "string" || !b.contact_email.includes("@"))
    throw new OpsError("contact_email required");
  if (
    typeof b.occurred_at !== "string" ||
    !Number.isFinite(Date.parse(b.occurred_at))
  )
    throw new OpsError("Valid occurred_at required");
  const amount = b.amount == null ? null : Number(b.amount);
  if (
    amount !== null &&
    (!Number.isFinite(amount) || amount < 0 || amount > 20000000)
  )
    throw new OpsError("Invalid amount in major currency units");
  const payload = {
    event_type: b.event_type,
    external_id: b.external_id.trim(),
    contact_email: b.contact_email.trim().toLowerCase(),
    contact_id: typeof b.contact_id === "string" ? b.contact_id : null,
    amount_pence: amount === null ? null : Math.round(amount * 100),
    currency: String(b.currency || "GBP").toUpperCase(),
    occurred_at: new Date(b.occurred_at).toISOString(),
  };
  const r = await createAdminClient().rpc("ops_payment_event", {
    p_event: payload,
  });
  if (r.error) throw new OpsError(r.error.message, 409);
  return r.data;
}
