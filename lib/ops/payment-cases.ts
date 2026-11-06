import { createHash, randomUUID } from "node:crypto";
import { getEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { OpsError, record, uuid } from "./tasks";
import {
  MARC_PAYMENT_LOCATION,
  paymentRules,
  reminderEligibility,
  renderPaymentReminder,
  singleBoundPaymentCase,
  type PaymentCase,
  type PaymentAttempt,
} from "./payment-policy";
import {
  readStripePaymentSnapshot,
  stripePaymentAccount,
  stripePaymentAccountById,
  verifyStripePaymentSignature,
} from "./payment-stripe";

function dbError(error: { message: string } | null) {
  if (error) throw new OpsError(error.message, 409);
}
export async function listPaymentCases() {
  const r = await createAdminClient()
    .from("ops_payment_cases")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(501);
  dbError(r.error);
  if (!r.data || r.data.length > 500) throw new OpsError("Payment cases exceed this view’s limit; the source needs checking", 503);
  return r.data as PaymentCase[];
}
export async function getPaymentCase(id: string) {
  const db = createAdminClient();
  const r = await db
    .from("ops_payment_cases")
    .select("*")
    .eq("id", uuid(id))
    .maybeSingle();
  dbError(r.error);
  if (!r.data) throw new OpsError("Payment case not found", 404);
  const attempts = await db
    .from("ops_payment_attempts")
    .select("*")
    .eq("case_id", id)
    .order("created_at");
  dbError(attempts.error);
  const events = await db
    .from("ops_payment_case_events")
    .select("id,source,event_type,occurred_at,created_at")
    .eq("case_id", id)
    .order("created_at", { ascending: false })
    .limit(50);
  dbError(events.error);
  return {
    payment_case: r.data as PaymentCase,
    attempts: attempts.data as PaymentAttempt[],
    events: events.data,
  };
}

async function saveSnapshot(
  snapshot: Awaited<ReturnType<typeof readStripePaymentSnapshot>>,
  externalId: string,
  type: string,
  occurredAt: string,
) {
  const r = await createAdminClient().rpc("ops_record_payment_snapshot", {
    p_snapshot: snapshot,
    p_external: externalId,
    p_event_type: type,
    p_occurred: occurredAt,
  });
  dbError(r.error);
  return r.data as { duplicate: boolean; case: PaymentCase };
}

export async function receiveStripePaymentEvent(
  alias: string,
  raw: string,
  signature: string | null,
) {
  if (Buffer.byteLength(raw, "utf8") > 1048576)
    throw new OpsError("Stripe event payload is too large", 413);
  const account = stripePaymentAccount(alias);
  verifyStripePaymentSignature(raw, signature, account.webhook_secret);
  const event = record(JSON.parse(raw));
  if (
    typeof event.id !== "string" ||
    !/^evt_[A-Za-z0-9]+$/.test(event.id) ||
    !Number.isSafeInteger(event.created) ||
    Number(event.created) < 0 ||
    Number(event.created) > Date.now() / 1000 + 300 ||
    event.livemode !== account.livemode ||
    (event.account && event.account !== account.account_id)
  )
    throw new OpsError("Stripe event identity or mode does not match", 409);
  const object = record(record(event.data).object);
  const occurred = new Date(Number(event.created) * 1000).toISOString();
  const type = String(event.type);
  let invoiceIds: string[];
  if (
    [
      "invoice.payment_failed",
      "invoice.paid",
      "invoice.payment_succeeded",
      "invoice.voided",
      "invoice.marked_uncollectible",
    ].includes(type)
  ) {
    if (object.object !== "invoice" || typeof object.id !== "string")
      throw new OpsError("Invoice event required");
    invoiceIds = [object.id];
  } else if (
    ["customer.subscription.updated", "customer.subscription.deleted"].includes(
      type,
    )
  ) {
    if (
      object.object !== "subscription" ||
      typeof object.id !== "string" ||
      !/^sub_[A-Za-z0-9]+$/.test(object.id)
    )
      throw new OpsError("Subscription event required");
    const r = await createAdminClient()
      .from("ops_payment_cases")
      .select("invoice_id")
      .eq("stripe_account_id", account.account_id)
      .eq("subscription_id", object.id)
      .neq("state", "paid")
      .limit(101);
    dbError(r.error);
    if ((r.data || []).length > 100)
      throw new OpsError(
        "Subscription has too many open cases for synchronous refresh; reconcile the backlog",
        503,
      );
    invoiceIds = (r.data || []).map(
      (row: { invoice_id: string }) => row.invoice_id,
    );
  } else return { received: true, ignored: true };
  const results = [];
  for (const invoiceId of invoiceIds) {
    const snapshot = await readStripePaymentSnapshot(account, invoiceId);
    results.push(
      await saveSnapshot(
        snapshot,
        `${account.account_id}:${event.id}:${invoiceId}`,
        type,
        occurred,
      ),
    );
  }
  return { received: true, cases: results };
}

async function ghlPaymentRead(path: string) {
  const token = getEnv("OPS_GHL_PAYMENT_TOKEN");
  if (!token)
    throw new OpsError("Scoped CRM payment read access is not configured", 503);
  const r = await fetch("https://services.leadconnectorhq.com" + path, {
    headers: {
      Authorization: "Bearer " + token,
      Version: "v3",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(15000),
    redirect: "error",
    cache: "no-store",
  });
  if (!r.ok) throw new OpsError("CRM payment readback unavailable", 503);
  return record(await r.json());
}
async function verifyGhlPaymentLocation() {
  // Location/contact APIs retain the dated version; message read uses its current v3 contract.
  const token = getEnv("OPS_GHL_PAYMENT_TOKEN");
  if (!token)
    throw new OpsError("Scoped CRM payment read access is not configured", 503);
  const r = await fetch(
    `https://services.leadconnectorhq.com/locations/${MARC_PAYMENT_LOCATION}`,
    {
      headers: { Authorization: "Bearer " + token, Version: "2021-07-28" },
      signal: AbortSignal.timeout(15000),
      redirect: "error",
      cache: "no-store",
    },
  );
  if (!r.ok)
    throw new OpsError("CRM payment location could not be verified", 503);
  const location = record(record(await r.json()).location);
  if (
    location.id !== MARC_PAYMENT_LOCATION ||
    location.name !== "MRW Management LTD"
  )
    throw new OpsError("CRM payment location does not match", 409);
}
async function readGhlPaymentContact(contactId: string) {
  await verifyGhlPaymentLocation();
  const response = await fetch(
    `https://services.leadconnectorhq.com/contacts/${encodeURIComponent(contactId)}`,
    {
      headers: {
        Authorization: "Bearer " + getEnv("OPS_GHL_PAYMENT_TOKEN"),
        Version: "2021-07-28",
      },
      signal: AbortSignal.timeout(15000),
      redirect: "error",
      cache: "no-store",
    },
  );
  if (!response.ok) throw new OpsError("CRM contact cannot be verified", 409);
  const contact = record(record(await response.json()).contact);
  if (contact.id !== contactId || contact.locationId !== MARC_PAYMENT_LOCATION)
    throw new OpsError("CRM contact destination does not match", 409);
  return contact;
}

export async function bindPaymentContact(
  caseId: string,
  input: unknown,
  authenticatedAdminId: string,
) {
  const b = record(input);
  if (
    Object.keys(b).some(
      (k) =>
        !["contact_id", "whatsapp_opt_in", "consent_reference"].includes(k),
    ) ||
    typeof b.contact_id !== "string" ||
    !/^[A-Za-z0-9]{8,100}$/.test(b.contact_id) ||
    typeof b.whatsapp_opt_in !== "boolean" ||
    typeof b.consent_reference !== "string" ||
    b.consent_reference.length > 2000
  )
    throw new OpsError(
      "Verified contact, WhatsApp permission and evidence reference required",
    );
  uuid(authenticatedAdminId);
  await getPaymentCase(caseId);
  await readGhlPaymentContact(b.contact_id);
  const r = await createAdminClient().rpc("ops_bind_payment_contact", {
    p_case: caseId,
    p_contact: b.contact_id,
    p_opt_in: b.whatsapp_opt_in,
    p_consent: b.consent_reference,
    p_actor: authenticatedAdminId,
  });
  dbError(r.error);
  return r.data as PaymentCase;
}

export async function paymentReminderPreflight(
  caseId: string,
  input: unknown,
  expectedContactId?: string,
) {
  const b = record(input);
  if (
    Object.keys(b).some((k) => k !== "step_key") ||
    typeof b.step_key !== "string"
  )
    throw new OpsError("step_key required");
  if (getEnv("OPS_PAYMENT_REMINDERS_ENABLED") !== "true")
    return { authorised_send: false, reason: "Payment reminders are disabled" };
  let configured: unknown;
  try {
    configured = JSON.parse(getEnv("OPS_PAYMENT_RULES_JSON") || "{}");
  } catch {
    throw new OpsError("Payment rules configuration is invalid", 503);
  }
  const rules = paymentRules(configured);
  const existing = await getPaymentCase(caseId);
  if (
    expectedContactId &&
    existing.payment_case.contact_id !== expectedContactId
  )
    return {
      authorised_send: false,
      reason: "Contact binding changed; manual review required",
    };
  const account = stripePaymentAccountById(
    existing.payment_case.stripe_account_id,
  );
  const snapshot = await readStripePaymentSnapshot(
    account,
    existing.payment_case.invoice_id,
  );
  await saveSnapshot(
    snapshot,
    `${account.account_id}:preflight:${randomUUID()}`,
    "preflight",
    new Date().toISOString(),
  );
  const current = await getPaymentCase(caseId);
  if (
    expectedContactId &&
    current.payment_case.contact_id !== expectedContactId
  )
    return {
      authorised_send: false,
      reason: "Contact binding changed; manual review required",
    };
  if (!current.payment_case.contact_id)
    return {
      authorised_send: false,
      reason: "Verified CRM contact binding required",
    };
  const contact = await readGhlPaymentContact(current.payment_case.contact_id);
  const dndSettings =
    contact.dndSettings && typeof contact.dndSettings === "object"
      ? record(contact.dndSettings)
      : {};
  const whatsappDnd =
    dndSettings.WhatsApp && typeof dndSettings.WhatsApp === "object"
      ? record(dndSettings.WhatsApp)
      : null;
  if (
    typeof contact.dnd !== "boolean" ||
    contact.dnd ||
    (whatsappDnd && whatsappDnd.status !== "inactive")
  )
    return {
      authorised_send: false,
      reason: "CRM DND is active or cannot be verified",
    };
  const result = reminderEligibility(
    current.payment_case,
    current.attempts,
    rules,
    b.step_key,
  );
  if (!result.eligible)
    return {
      authorised_send: false,
      reason: result.reason,
      due_at: result.due_at,
    };
  if (expectedContactId) {
    const candidate =
      await resolveSinglePaymentCaseForContact(expectedContactId);
    if (!candidate.eligible || candidate.case_id !== caseId)
      return {
        authorised_send: false,
        reason:
          "Contact now has another unresolved invoice; manual review required",
      };
  }
  const rendered = renderPaymentReminder(
    current.payment_case,
    result.step.body_template,
    contact,
  );
  const body = rendered.body;
  const bodyHash = createHash("sha256")
    .update(normalisePaymentMessageBody(body))
    .digest("hex");
  const r = await createAdminClient().rpc("ops_reserve_payment_reminder", {
    p_case: caseId,
    p_expected: current.payment_case.updated_at,
    p_step: result.step.key,
    p_template: result.step.template_id,
    p_rules: rules.revision,
    p_location: rules.location_id,
    p_body_hash: bodyHash,
  });
  dbError(r.error);
  if (!r.data.authorised_send) return r.data;
  return {
    ...r.data,
    contact_id: current.payment_case.contact_id,
    location_id: rules.location_id,
    template_id: result.step.template_id,
    rendered_body: body,
    due_at: result.due_at,
    payment_link: current.payment_case.hosted_invoice_url,
    first_name: rendered.first_name,
    invoice_reference:
      current.payment_case.invoice_number || current.payment_case.invoice_id,
    case_id: caseId,
    stripe_account_id: current.payment_case.stripe_account_id,
    invoice_id: current.payment_case.invoice_id,
  };
}

// A native contact-triggered first reminder need not carry mutable invoice fields.
// Ambiguous/multiple outstanding cases are held for a person rather than selected.
export async function paymentReminderPreflightForContact(
  contactId: string,
  input: unknown,
) {
  const b = record(input);
  if (
    !/^[A-Za-z0-9]{8,100}$/.test(contactId) ||
    Object.keys(b).some((k) => k !== "step_key") ||
    typeof b.step_key !== "string"
  )
    throw new OpsError("Verified contact ID and step_key required");
  if (getEnv("OPS_PAYMENT_REMINDERS_ENABLED") !== "true")
    return { authorised_send: false, reason: "Payment reminders are disabled" };
  const candidate = await resolveSinglePaymentCaseForContact(contactId);
  if (!candidate.eligible)
    return { authorised_send: false, reason: candidate.reason };
  return paymentReminderPreflight(candidate.case_id, b, contactId);
}

async function resolveSinglePaymentCaseForContact(contactId: string) {
  const r = await createAdminClient()
    .from("ops_payment_cases")
    .select("id,contact_id,state")
    .eq("contact_id", contactId)
    .in("state", ["unpaid", "unknown", "paused", "uncollectible"])
    .limit(2);
  dbError(r.error);
  return singleBoundPaymentCase(r.data || [], contactId);
}

export function normalisePaymentMessageBody(body: string) {
  return body.replace(/\r\n/g, "\n").trim();
}
export function verifiedPaymentMessage(
  message: Record<string, unknown>,
  attempt: Record<string, unknown>,
) {
  const timestamp = Date.parse(String(message.dateAdded));
  const created = Date.parse(String(attempt.created_at)),
    expires = Date.parse(String(attempt.expires_at));
  if (
    message.id !== attempt.provider_message_id ||
    message.contactId !== attempt.contact_id ||
    message.locationId !== MARC_PAYMENT_LOCATION ||
    message.direction !== "outbound" ||
    !["TYPE_WHATSAPP", "WHATSAPP", "WhatsApp"].includes(
      String(message.messageType),
    ) ||
    !Number.isFinite(timestamp) ||
    !Number.isFinite(created) ||
    !Number.isFinite(expires) ||
    timestamp < created - 5000 ||
    timestamp > expires ||
    typeof message.body !== "string" ||
    createHash("sha256")
      .update(normalisePaymentMessageBody(message.body))
      .digest("hex") !== attempt.expected_body_hash
  )
    return null;
  if (["delivered", "read", "opened"].includes(String(message.status)))
    return "delivered";
  if (message.status === "sent") return "sent";
  if (["failed", "undelivered"].includes(String(message.status)))
    return "failed";
  return null;
}

export async function recordGhlPaymentCaseEvent(input: unknown) {
  const b = record(input);
  const allowed = [
    "schema_version",
    "stripe_account_id",
    "invoice_id",
    "location_id",
    "contact_id",
    "external_id",
    "event_type",
    "occurred_at",
    "attempt_id",
    "provider_message_id",
  ];
  if (
    Object.keys(b).some((k) => !allowed.includes(k)) ||
    b.schema_version !== 2 ||
    typeof b.stripe_account_id !== "string" ||
    !/^acct_[A-Za-z0-9]+$/.test(b.stripe_account_id) ||
    typeof b.invoice_id !== "string" ||
    !/^in_[A-Za-z0-9]+$/.test(b.invoice_id) ||
    b.location_id !== MARC_PAYMENT_LOCATION ||
    typeof b.contact_id !== "string" ||
    !/^[A-Za-z0-9]{8,100}$/.test(b.contact_id) ||
    typeof b.external_id !== "string" ||
    !b.external_id.trim() ||
    b.external_id.length > 500 ||
    typeof b.occurred_at !== "string" ||
    !Number.isFinite(Date.parse(b.occurred_at)) ||
    ![
      "reminder_requested",
      "reminder_sent",
      "reminder_delivered",
      "reminder_failed",
      "reply_needs_human",
      "contact_dnd",
      "manual_pause",
    ].includes(String(b.event_type))
  )
    throw new OpsError("Valid invoice-scoped CRM payment event required");
  let verified: string | null = null;
  let error: string | null = null;
  let verifiedSentAt: string | null = null;
  if (String(b.event_type).startsWith("reminder_")) {
    uuid(b.attempt_id);
    const attempt = await createAdminClient()
      .from("ops_payment_attempts")
      .select("*")
      .eq("id", b.attempt_id)
      .maybeSingle();
    dbError(attempt.error);
    if (!attempt.data)
      throw new OpsError("Reserved reminder attempt not found", 409);
    if (
      typeof b.provider_message_id === "string" &&
      /^[A-Za-z0-9_-]{1,200}$/.test(b.provider_message_id)
    ) {
      try {
        await verifyGhlPaymentLocation();
        const message = await ghlPaymentRead(
          "/conversations/messages/" +
            encodeURIComponent(b.provider_message_id),
        );
        verified = verifiedPaymentMessage(message, {
          ...attempt.data,
          provider_message_id: b.provider_message_id,
        });
        if (verified && ["sent", "delivered"].includes(verified))
          verifiedSentAt = new Date(String(message.dateAdded)).toISOString();
        if (!verified)
          error =
            "Message context/status could not be verified; reconcile before another reminder";
      } catch {
        error = "Provider message readback unavailable; delivery is unverified";
      }
    } else
      error = "Workflow reported progress without a provider message receipt";
  }
  const payload = {
    ...b,
    receipt_verified: Boolean(verified),
    delivery_state: verified,
    verified_sent_at: verifiedSentAt,
    error,
  };
  const r = await createAdminClient().rpc("ops_record_payment_ghl_event", {
    p_event: payload,
  });
  dbError(r.error);
  return r.data;
}
