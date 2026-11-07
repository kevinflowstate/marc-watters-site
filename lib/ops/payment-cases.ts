import { randomUUID } from "node:crypto";
import { getEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { OpsError, record, uuid } from "./tasks";
import {
  paymentCaseView,
  paymentHumanHandoff,
  paymentReminderPlan,
  paymentTaskText,
  reportedReminderAttempts,
} from "./payment-display";
import {
  GHL_PROGRESS_EVENTS,
  reminderStatusRank,
  type GhlProgressEvent,
  type PaymentCase,
  type PaymentCaseEvent,
} from "./payment-policy";
import {
  readStripePaymentSnapshot,
  stripeAccountLabel,
  stripePaymentAccount,
  verifyStripePaymentSignature,
} from "./payment-stripe";
import {
  addContactToWorkflow,
  findContactsByEmail,
  getGhlContact,
  GhlWorkflowError,
  removeContactFromWorkflow,
} from "./ghl-workflow";

const OPEN_STATES = ["unpaid", "unknown", "paused", "uncollectible"];
const remindersEnabled = () => getEnv("OPS_PAYMENT_REMINDERS_ENABLED") === "true";
const errorText = (e: unknown) =>
  e instanceof Error ? e.message.slice(0, 300) : "Unknown error";

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
  if (!r.data || r.data.length > 500)
    throw new OpsError("Payment cases exceed this view’s limit; the source needs checking", 503);
  return r.data as PaymentCase[];
}

async function loadCase(id: string) {
  const r = await createAdminClient()
    .from("ops_payment_cases")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  dbError(r.error);
  if (!r.data) throw new OpsError("Payment case not found", 404);
  return r.data as PaymentCase;
}

export async function getPaymentCase(id: string) {
  const db = createAdminClient();
  const payment = await loadCase(uuid(id));
  const events = await db
    .from("ops_payment_case_events")
    .select("id,source,event_type,occurred_at,created_at,data")
    .eq("case_id", payment.id)
    .order("created_at", { ascending: false })
    .limit(200);
  dbError(events.error);
  const rows = (events.data || []) as PaymentCaseEvent[];
  let note: string | null = null;
  if (payment.task_id) {
    const task = await db
      .from("ops_tasks")
      .select("id,status,decision_note")
      .eq("id", payment.task_id)
      .maybeSingle();
    dbError(task.error);
    note = (task.data?.decision_note as string | null) ?? null;
  }
  const attempts = reportedReminderAttempts(rows);
  return {
    payment_case: payment,
    attempts,
    events: rows.slice(0, 50).map((e) => ({
      id: e.id,
      source: e.source,
      event_type: e.event_type,
      occurred_at: e.occurred_at,
      created_at: e.created_at,
    })),
    human_followup: paymentHumanHandoff(payment, attempts, remindersEnabled()),
    view: paymentCaseView(payment, rows, {
      accountLabel: stripeAccountLabel(payment.stripe_account_id),
      note,
    }),
  };
}

export async function savePaymentSnapshot(
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
  return r.data as { duplicate: boolean; case?: PaymentCase };
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
    ["customer.subscription.updated", "customer.subscription.deleted"].includes(type)
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
      .neq("state", "void")
      .limit(101);
    dbError(r.error);
    if ((r.data || []).length > 100)
      throw new OpsError(
        "Subscription has too many open cases for synchronous refresh; reconcile the backlog",
        503,
      );
    invoiceIds = (r.data || []).map((row: { invoice_id: string }) => row.invoice_id);
  } else return { received: true, ignored: true };
  const results = [];
  for (const invoiceId of invoiceIds) {
    const snapshot = await readStripePaymentSnapshot(account, invoiceId);
    const saved = await savePaymentSnapshot(
      snapshot,
      `${account.account_id}:${event.id}:${invoiceId}`,
      type,
      occurred,
    );
    results.push(await afterSnapshot(saved));
  }
  return { received: true, cases: results };
}

/** The Stripe event is already recorded, so CRM problems are saved on the case, never thrown. */
async function afterSnapshot(saved: { duplicate: boolean; case?: PaymentCase }) {
  const c = saved?.case;
  if (!c?.id || saved.duplicate) return saved;
  let reminders: string;
  try {
    if (["paid", "void", "cancelled"].includes(c.state)) reminders = await stopReminders(c);
    else if (c.state === "unpaid") reminders = await startReminders(c);
    else reminders = c.latest_delivery || "not_started";
    await syncPaymentTask(await loadCase(c.id));
  } catch (e) {
    console.error("Payment reminder follow-on failed", errorText(e));
    reminders = "follow_on_failed";
  }
  return { ...saved, reminders };
}

async function updateCase(id: string, patch: Record<string, unknown>) {
  const r = await createAdminClient().from("ops_payment_cases").update(patch).eq("id", id);
  dbError(r.error);
}

async function logCaseEvent(
  caseId: string,
  eventType: string,
  data: Record<string, unknown>,
  options: { externalId?: string; occurredAt?: string } = {},
) {
  const r = await createAdminClient().from("ops_payment_case_events").insert({
    case_id: caseId,
    source: "ghl",
    external_id: options.externalId || `portal:${eventType}:${caseId}:${randomUUID()}`,
    event_type: eventType,
    occurred_at: options.occurredAt || new Date().toISOString(),
    data,
  });
  if (r.error && (r.error as { code?: string }).code === "23505") return false;
  dbError(r.error);
  return true;
}

/** New unpaid case: find the CRM contact by email and add them to the reminder workflow. */
async function startReminders(c: PaymentCase) {
  if (c.latest_delivery) return c.latest_delivery;
  if (!c.first_failed_at) return "not_started";
  if (!remindersEnabled()) {
    await updateCase(c.id, { latest_delivery: "reminders_off" });
    await logCaseEvent(c.id, "reminders_off", {});
    return "reminders_off";
  }
  // Claim the case so two concurrent Stripe events cannot enrol twice.
  const claim = await createAdminClient()
    .from("ops_payment_cases")
    .update({ latest_delivery: "enrolling" })
    .eq("id", c.id)
    .is("latest_delivery", null)
    .select("id");
  dbError(claim.error);
  if (!claim.data?.length) return "already_started";
  try {
    let contactId = c.contact_id;
    if (!contactId) {
      const matches = c.contact_email ? await findContactsByEmail(c.contact_email) : [];
      if (matches.length !== 1) {
        await updateCase(c.id, { latest_delivery: "no_contact_match" });
        await logCaseEvent(c.id, "no_contact_match", {
          email: c.contact_email,
          matches: matches.length,
        });
        return "no_contact_match";
      }
      contactId = matches[0].id;
    }
    const plan = paymentReminderPlan(c.first_failed_at);
    await addContactToWorkflow(contactId, { eventStartTime: plan?.first });
    const at = new Date().toISOString();
    await updateCase(c.id, { contact_id: contactId, bound_at: at, latest_delivery: "enrolled" });
    await logCaseEvent(
      c.id,
      "enrolled",
      {
        contact_id: contactId,
        workflow_id: getEnv("OPS_PAYMENT_WORKFLOW_ID") || null,
        event_start_time: plan?.first ?? null,
      },
      { occurredAt: at },
    );
    return "enrolled";
  } catch (e) {
    await updateCase(c.id, { latest_delivery: "enrol_failed" });
    await logCaseEvent(c.id, "enrol_failed", { error: errorText(e) });
    return "enrol_failed";
  }
}

/** Paid, voided or cancelled: take the contact out of the reminder workflow once. */
async function stopReminders(c: PaymentCase) {
  if (!c.contact_id) return "no_contact";
  const externalId = `portal:removed:${c.id}`;
  const done = await createAdminClient()
    .from("ops_payment_case_events")
    .select("id")
    .eq("source", "ghl")
    .eq("external_id", externalId)
    .maybeSingle();
  dbError(done.error);
  if (done.data) return "already_removed";
  try {
    const result = await removeContactFromWorkflow(c.contact_id);
    await logCaseEvent(c.id, "removed_from_workflow", { contact_id: c.contact_id, ...result }, { externalId });
    return result.removed ? "removed" : "not_in_workflow";
  } catch (e) {
    await logCaseEvent(c.id, "removal_failed", { contact_id: c.contact_id, error: errorText(e) });
    return "removal_failed";
  }
}

async function mutateTask(action: string, data: Record<string, unknown>, actor: string, id?: string) {
  const r = await createAdminClient().rpc("ops_mutate_task", {
    p_action: action,
    p_data: data,
    p_actor: actor,
    p_id: id ?? null,
  });
  dbError(r.error);
  return r.data as { id: string; status: string };
}

/** Rebuild Eimear's task from the case. Closing keeps her decision note (migration 031). */
export async function syncPaymentTask(
  c: PaymentCase,
  options: { reopen?: boolean; extraLines?: string[] } = {},
) {
  if (["paid", "void"].includes(c.state)) {
    if (!c.task_id) return null;
    const t = await createAdminClient()
      .from("ops_tasks")
      .select("id,status")
      .eq("id", c.task_id)
      .maybeSingle();
    dbError(t.error);
    if (t.data && !["done", "cancelled"].includes(String(t.data.status)))
      await mutateTask(
        "complete",
        {
          status: "done",
          completion_reason:
            c.state === "paid"
              ? "Stripe confirms this invoice is paid; this invoice follow-up is closed."
              : "Stripe shows this invoice was voided; this invoice follow-up is closed.",
        },
        "stripe-payment",
        c.task_id,
      );
    return c.task_id;
  }
  const text = paymentTaskText(c, {
    accountLabel: stripeAccountLabel(c.stripe_account_id),
    extraLines: options.extraLines,
  });
  const task = await mutateTask(
    "create",
    {
      kind: "flag",
      area: "payments",
      assignee: "eimear",
      external_ref: `payment-case:${c.id}`,
      title: text.title,
      detail: text.detail,
      payload: {
        payment_case_id: c.id,
        stripe_account_id: c.stripe_account_id,
        invoice_id: c.invoice_id,
        state: c.state,
        latest_delivery: c.latest_delivery,
      },
      links: [{ label: "Review payment case", url: `/admin/automation?payment=${c.id}` }],
    },
    "payment-case",
  );
  if (task?.id && task.id !== c.task_id) await updateCase(c.id, { task_id: task.id });
  if (options.reopen && task && ["done", "cancelled", "rejected"].includes(task.status))
    await mutateTask("update", { status: "open" }, "payment-case", task.id);
  return task?.id ?? null;
}

function progressPatch(c: PaymentCase, type: GhlProgressEvent) {
  const advance = (status: string, count: number) => ({
    reminder_count: Math.max(c.reminder_count || 0, count),
    latest_delivery:
      (reminderStatusRank[c.latest_delivery || ""] || 0) < reminderStatusRank[status]
        ? status
        : c.latest_delivery,
  });
  if (type === "reminder_1_sent") return advance("reminder_1_sent", 1);
  if (type === "reminder_2_sent") return advance("reminder_2_sent", 2);
  if (type === "escalated") return advance("escalated", 2);
  if (type === "reply_received") return { reply_needs_human: true };
  return { contact_dnd: true };
}

/** GHL workflow progress: { event_type, contact_id, occurred_at, event_id, invoice_id? }. */
export async function recordGhlPaymentProgress(input: unknown) {
  const b = record(input);
  // occurred_at is optional: GHL may not expose a reliable timestamp merge field.
  const occurredRaw =
    typeof b.occurred_at === "string" && b.occurred_at.trim() ? b.occurred_at.trim() : new Date().toISOString();
  const invoiceId = typeof b.invoice_id === "string" && b.invoice_id.trim() ? b.invoice_id.trim() : null;
  if (
    !GHL_PROGRESS_EVENTS.includes(b.event_type as GhlProgressEvent) ||
    typeof b.contact_id !== "string" ||
    !/^[A-Za-z0-9]{8,100}$/.test(b.contact_id) ||
    typeof b.event_id !== "string" ||
    !b.event_id.trim() ||
    b.event_id.length > 200 ||
    !Number.isFinite(Date.parse(occurredRaw)) ||
    Date.parse(occurredRaw) > Date.now() + 300000 ||
    (invoiceId !== null && !/^in_[A-Za-z0-9]+$/.test(invoiceId))
  )
    throw new OpsError(
      "event_type, contact_id and event_id are required (occurred_at must be a valid past time if sent); event_type must be one of " +
        GHL_PROGRESS_EVENTS.join(", "),
    );
  const type = b.event_type as GhlProgressEvent;
  const eventId = b.event_id.trim();
  const occurredAt = new Date(occurredRaw).toISOString();
  const db = createAdminClient();
  let query = db
    .from("ops_payment_cases")
    .select("*")
    .eq("contact_id", b.contact_id)
    .in("state", OPEN_STATES);
  if (invoiceId) query = query.eq("invoice_id", invoiceId);
  const found = await query.limit(20);
  dbError(found.error);
  const cases = (found.data || []) as PaymentCase[];
  if (!cases.length)
    return { received: true, matched: 0, note: "No open payment case for this contact" };
  const externalIds = cases.map((c) => `progress:${eventId}:${c.id}`);
  const seen = await db
    .from("ops_payment_case_events")
    .select("external_id")
    .eq("source", "ghl")
    .in("external_id", externalIds);
  dbError(seen.error);
  const seenIds = new Set((seen.data || []).map((e: { external_id: string }) => e.external_id));
  const fresh = cases.filter((c) => !seenIds.has(`progress:${eventId}:${c.id}`));
  if (!fresh.length) return { received: true, duplicate: true, matched: cases.length };
  const note =
    cases.length > 1
      ? `This CRM contact has ${cases.length} open invoices; the workflow update "${type}" was applied to all of them.`
      : undefined;
  for (const c of fresh) {
    await updateCase(c.id, progressPatch(c, type));
    await logCaseEvent(
      c.id,
      type,
      { event_id: eventId, contact_id: b.contact_id, invoice_id: invoiceId },
      { externalId: `progress:${eventId}:${c.id}`, occurredAt },
    );
    await syncPaymentTask(await loadCase(c.id), {
      reopen: ["escalated", "reply_received", "dnd"].includes(type),
      extraLines: note ? [note] : [],
    });
  }
  return { received: true, duplicate: false, matched: cases.length, applied: fresh.length, note };
}

/** Admin match of a case to a CRM contact (e.g. after "no single CRM contact matched"). */
export async function bindPaymentContact(
  caseId: string,
  input: unknown,
  authenticatedAdminId: string,
) {
  const b = record(input);
  if (
    Object.keys(b).some((k) => !["contact_id", "whatsapp_opt_in", "consent_reference"].includes(k)) ||
    typeof b.contact_id !== "string" ||
    !/^[A-Za-z0-9]{8,100}$/.test(b.contact_id) ||
    (b.whatsapp_opt_in !== undefined && typeof b.whatsapp_opt_in !== "boolean") ||
    (b.consent_reference !== undefined &&
      (typeof b.consent_reference !== "string" || b.consent_reference.length > 2000))
  )
    throw new OpsError("A valid CRM contact_id is required");
  uuid(authenticatedAdminId);
  await loadCase(uuid(caseId));
  try {
    await getGhlContact(b.contact_id);
  } catch (e) {
    if (e instanceof GhlWorkflowError) throw new OpsError(e.message, e.status);
    throw e;
  }
  const r = await createAdminClient().rpc("ops_bind_payment_contact", {
    p_case: caseId,
    p_contact: b.contact_id,
    p_opt_in: b.whatsapp_opt_in === true,
    p_consent: typeof b.consent_reference === "string" ? b.consent_reference : "",
    p_actor: authenticatedAdminId,
  });
  dbError(r.error);
  const bound = r.data as PaymentCase;
  await syncPaymentTask(await loadCase(bound.id));
  return bound;
}
