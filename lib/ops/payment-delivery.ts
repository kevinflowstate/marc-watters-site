import { createHash } from "node:crypto";
import { getEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { OpsError, record } from "./tasks";
import {
  getPaymentCase,
  normalisePaymentMessageBody,
  readGhlPaymentContact,
  recordGhlPaymentCaseEvent,
  savePaymentSnapshot,
  validPaymentWorkflowRun,
} from "./payment-cases";
import {
  MARC_PAYMENT_LOCATION,
  paymentReminderDueAt,
  paymentRules,
  reminderEligibility,
  renderPaymentReminder,
} from "./payment-policy";
import { readStripePaymentSnapshot, stripePaymentAccountById } from "./payment-stripe";

type DeliveryAttempt = {
  id: string;
  case_id: string;
  step_key: string;
  workflow_run_id: string;
  context_token_hash: string;
  contact_id: string;
  location_id: string;
  template_id: string;
  rules_revision: string;
  expected_body_hash: string;
  state: string;
  created_at: string;
  expires_at: string;
  dispatch_claimed_at: string | null;
};

function workflowContext(input: unknown, extras: string[] = []) {
  const body = record(input);
  if (
    Object.keys(body).some((key) => !["context_token", "workflow_run_id", ...extras].includes(key)) ||
    typeof body.context_token !== "string" ||
    !/^[a-f0-9]{64}$/.test(body.context_token) ||
    !validPaymentWorkflowRun(body.workflow_run_id)
  ) throw new OpsError("The saved payment workflow context is required");
  return {
    body,
    run: body.workflow_run_id,
    hash: createHash("sha256").update(body.context_token).digest("hex"),
  };
}

async function getDeliveryAttempt(hash: string, run: string) {
  const result = await createAdminClient()
    .from("ops_payment_attempts")
    .select("*")
    .eq("context_token_hash", hash)
    .maybeSingle();
  if (result.error) throw new OpsError("The saved reminder could not be checked", 503);
  const attempt = result.data as DeliveryAttempt | null;
  if (!attempt || attempt.workflow_run_id !== run || attempt.location_id !== MARC_PAYMENT_LOCATION)
    throw new OpsError("This context does not match the saved workflow run", 409);
  return attempt;
}

function configuredRules() {
  let configured: unknown;
  try { configured = JSON.parse(getEnv("OPS_PAYMENT_RULES_JSON") || "{}"); }
  catch { throw new OpsError("Payment rules configuration is invalid", 503); }
  return paymentRules(configured);
}

function contactCanReceive(contact: Record<string, unknown>) {
  const settings = contact.dndSettings && typeof contact.dndSettings === "object"
    ? record(contact.dndSettings) : {};
  const whatsapp = settings.WhatsApp && typeof settings.WhatsApp === "object"
    ? record(settings.WhatsApp) : null;
  return contact.dnd === false && (!whatsapp || whatsapp.status === "inactive");
}

/** Claims one immediate native GHL action. It never calls a messaging provider. */
export async function claimPaymentDelivery(input: unknown) {
  const context = workflowContext(input);
  if (getEnv("OPS_PAYMENT_REMINDERS_ENABLED") !== "true")
    return { authorised_send: false, reason: "Payment reminders are disabled" };
  const attempt = await getDeliveryAttempt(context.hash, context.run);
  const deny = (reason: string) => ({ authorised_send: false, reason });
  if (attempt.dispatch_claimed_at)
    return deny("This reminder was already handed to the sender; check its receipt before doing anything else");
  if (Date.parse(attempt.expires_at) < Date.now())
    return deny("The send permission expired; Eimear needs to check the outcome");
  const original = await getPaymentCase(attempt.case_id);
  const account = stripePaymentAccountById(original.payment_case.stripe_account_id);
  const snapshot = await readStripePaymentSnapshot(account, original.payment_case.invoice_id);
  await savePaymentSnapshot(snapshot, `${account.account_id}:dispatch:${attempt.id}:${Date.now()}`, "dispatch", new Date().toISOString());
  const current = await getPaymentCase(attempt.case_id);
  if (current.payment_case.contact_id !== attempt.contact_id)
    return deny("The client linked to this invoice has changed; Eimear needs to review it");
  const contact = await readGhlPaymentContact(attempt.contact_id);
  if (!contactCanReceive(contact)) return deny("WhatsApp follow-up is stopped or could not be checked");
  const rules = configuredRules();
  if (rules.revision !== attempt.rules_revision)
    return deny("The agreed reminder settings changed; this old permission cannot be used");
  const eligible = reminderEligibility(current.payment_case,
    current.attempts.filter((value) => value.id !== attempt.id), rules, attempt.step_key);
  if (!eligible.eligible) return deny(eligible.reason);
  if (eligible.step.template_id !== attempt.template_id)
    return deny("The approved WhatsApp template changed; this old permission cannot be used");
  const rendered = renderPaymentReminder(current.payment_case, eligible.step.body_template, contact);
  if (createHash("sha256").update(normalisePaymentMessageBody(rendered.body)).digest("hex") !== attempt.expected_body_hash)
    return deny("The reminder wording or client name changed; a person needs to review it");
  const claim = await createAdminClient().rpc("ops_claim_payment_dispatch", {
    p_attempt: attempt.id,
    p_context_hash: context.hash,
    p_run: context.run,
    p_expected: current.payment_case.updated_at,
    p_hour_start: rules.allowed_local_hours.start,
    p_hour_end: rules.allowed_local_hours.end,
  });
  if (claim.error) throw new OpsError("The reminder could not be handed to the sender", 409);
  if (!claim.data?.authorised_send) return claim.data;
  return {
    authorised_send: true,
    workflow_run_id: context.run,
    attempt_id: attempt.id,
    case_id: attempt.case_id,
    contact_id: attempt.contact_id,
    location_id: attempt.location_id,
    template_id: attempt.template_id,
    rendered_body: rendered.body,
    first_name: rendered.first_name,
    expires_at: attempt.expires_at,
  };
}

/** The caller supplies a receipt, never an invoice/contact/attempt identity. */
export async function recordPaymentDeliveryReceipt(input: unknown) {
  const context = workflowContext(input, ["event_id", "event_type", "occurred_at", "provider_message_id"]);
  const body = context.body;
  if (typeof body.event_id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,179}$/.test(body.event_id) ||
    !["reminder_requested", "reminder_sent", "reminder_delivered", "reminder_failed"].includes(String(body.event_type)) ||
    typeof body.occurred_at !== "string" || !Number.isFinite(Date.parse(body.occurred_at)) ||
    Date.parse(body.occurred_at) > Date.now() + 300000 ||
    (body.provider_message_id !== undefined &&
      (typeof body.provider_message_id !== "string" || !/^[A-Za-z0-9_-]{1,200}$/.test(body.provider_message_id))))
    throw new OpsError("A valid status event from the saved workflow run is required");
  const attempt = await getDeliveryAttempt(context.hash, context.run);
  if (!attempt.dispatch_claimed_at)
    throw new OpsError("This reminder has not been handed to the sender", 409);
  if (Date.parse(body.occurred_at) < Date.parse(attempt.dispatch_claimed_at) - 5000)
    throw new OpsError("The receipt predates this reminder", 409);
  const current = await getPaymentCase(attempt.case_id);
  if (current.payment_case.contact_id !== attempt.contact_id)
    throw new OpsError("The reminder's client binding changed; Eimear needs to review it", 409);
  const result = record(await recordGhlPaymentCaseEvent({
    schema_version: 2,
    stripe_account_id: current.payment_case.stripe_account_id,
    invoice_id: current.payment_case.invoice_id,
    location_id: attempt.location_id,
    contact_id: attempt.contact_id,
    attempt_id: attempt.id,
    external_id: `delivery:${attempt.id}:${body.event_id}`,
    event_type: body.event_type,
    occurred_at: body.occurred_at,
    ...(body.provider_message_id === undefined ? {} : { provider_message_id: body.provider_message_id }),
  }, { run: context.run, hash: context.hash }));
  const savedCase = result.case && typeof result.case === "object" ? record(result.case) : null;
  const receipt = result.receipt && typeof result.receipt === "object" ? record(result.receipt) : null;
  const followupDue = attempt.step_key === "first" && savedCase?.state === "unpaid" &&
    !savedCase.manual_pause && !savedCase.reply_needs_human && !savedCase.contact_dnd &&
    receipt?.verified === true && ["sent", "delivered"].includes(String(receipt.state))
    ? paymentReminderDueAt(String(savedCase.first_failed_at || ""), "second", typeof receipt.sent_at === "string" ? receipt.sent_at : null)
    : null;
  return { ...result, followup_due_at: followupDue };
}
