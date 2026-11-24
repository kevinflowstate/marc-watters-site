import { getEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGhlContact, ghlWhatsAppBlocked } from "./ghl-workflow";
import { paymentReminderDueAt } from "./payment-display";
import type { PaymentCase } from "./payment-policy";
import { verifyPaymentRun } from "./payment-run";
import {
  stripePaymentAccount,
  readStripePaymentSnapshot,
} from "./payment-stripe";
import { record, OpsError } from "./tasks";

export async function reserveNativeReminder(input: unknown) {
  const held = { allow_send: false };
  if (getEnv("OPS_PAYMENT_REMINDERS_ENABLED") !== "true") return held;
  const body = record(input);
  const run = verifyPaymentRun(body.run_context, body.contact_id);
  if (body.step !== "first" && body.step !== "second")
    throw new OpsError("Unknown reminder step");
  const db = createAdminClient();
  const found = await db
    .from("ops_payment_cases")
    .select("*")
    .eq("id", run.case_id)
    .eq("contact_id", run.contact_id)
    .eq("stripe_account_id", run.stripe_account_id)
    .eq("invoice_id", run.invoice_id)
    .maybeSingle();
  if (found.error || !found.data) return held;
  const c = found.data as PaymentCase;
  if (
    c.state !== "unpaid" ||
    c.manual_pause ||
    c.reply_needs_human ||
    c.contact_dnd ||
    !c.whatsapp_opt_in
  )
    return held;
  const accounts = record(
    JSON.parse(getEnv("OPS_STRIPE_PAYMENT_ACCOUNTS_JSON") || "{}"),
  );
  const aliases = Object.keys(accounts).filter(
    (key) => record(accounts[key]).account_id === run.stripe_account_id,
  );
  if (aliases.length !== 1) return held;
  const [snapshot, contact] = await Promise.all([
    readStripePaymentSnapshot(stripePaymentAccount(aliases[0]), run.invoice_id),
    getGhlContact(run.contact_id),
  ]);
  if (
    snapshot.state !== "unpaid" ||
    !snapshot.stripe_customer_id ||
    snapshot.stripe_customer_id !== c.stripe_customer_id ||
    ghlWhatsAppBlocked(contact)
  )
    return held;
  // SQL enforces the second wait against the actual first callback and accepts a step only once.
  const due = paymentReminderDueAt(c.first_failed_at, "first");
  if (!due || Date.parse(due) > Date.now()) return held;
  const result = await db.rpc("ops_reserve_native_reminder", {
    p_case: run.case_id,
    p_contact: run.contact_id,
    p_account: run.stripe_account_id,
    p_invoice: run.invoice_id,
    p_step: body.step,
    p_observed: snapshot.source_verified_at,
    p_expected: c.updated_at,
    p_due: due,
  });
  return { allow_send: !result.error && result.data === true };
}
