import { OpsError, record } from "./tasks";
import { paymentReminderDueAt } from "./payment-display";
export { paymentReminderDueAt } from "./payment-display";

export const MARC_PAYMENT_LOCATION = "93GJEdsr0cT9el3OINXq";
export type PaymentState =
  | "unpaid"
  | "paid"
  | "void"
  | "uncollectible"
  | "paused"
  | "cancelled"
  | "unknown";
export type PaymentCase = {
  id: string;
  stripe_account_id: string;
  invoice_id: string;
  invoice_number: string | null;
  stripe_customer_id: string | null;
  subscription_id: string | null;
  contact_id: string | null;
  contact_email: string | null;
  customer_name: string | null;
  client_id: string | null;
  state: PaymentState;
  amount_minor: number | null;
  currency: string | null;
  hosted_invoice_url: string | null;
  first_failed_at: string | null;
  source_verified_at: string | null;
  manual_pause: boolean;
  reply_needs_human: boolean;
  contact_dnd: boolean;
  whatsapp_opt_in: boolean;
  latest_delivery: string | null;
  reminder_count: number;
  task_id: string | null;
  updated_at: string;
};
export type PaymentAttempt = {
  id: string;
  step_key: string;
  state: string;
  provider_message_id: string | null;
  created_at: string;
  receipt_verified: boolean;
  verified_sent_at: string | null;
  workflow_run_id?: string | null;
  dispatch_claimed_at?: string | null;
};
export type PaymentRules = {
  enabled: boolean;
  revision: string;
  approved_by: string;
  approved_at: string;
  location_id: string;
  timezone: "Europe/London";
  max_reminders: number;
  allowed_local_hours: { start: number; end: number };
  timing: {
    first: "next_working_day";
    followup_calendar_days: 3;
    local_hour: 9;
  };
  steps: {
    key: string;
    template_id: string;
    body_template: string;
  }[];
};

export function paymentRules(input: unknown): PaymentRules {
  const b = record(input);
  const hours = record(b.allowed_local_hours);
  const timing = record(b.timing);
  if (
    b.enabled !== true ||
    typeof b.revision !== "string" ||
    !b.revision.trim() ||
    typeof b.approved_by !== "string" ||
    !b.approved_by.trim() ||
    typeof b.approved_at !== "string" ||
    !Number.isFinite(Date.parse(b.approved_at)) ||
    b.location_id !== MARC_PAYMENT_LOCATION ||
    b.timezone !== "Europe/London" ||
    !Number.isInteger(b.max_reminders) ||
    Number(b.max_reminders) !== 2 ||
    timing.first !== "next_working_day" ||
    timing.followup_calendar_days !== 3 ||
    timing.local_hour !== 9 ||
    !Number.isInteger(hours.start) ||
    !Number.isInteger(hours.end) ||
    Number(hours.start) < 0 ||
    Number(hours.end) > 24 ||
    Number(hours.start) >= Number(hours.end) ||
    !Array.isArray(b.steps) ||
    b.steps.length !== b.max_reminders
  )
    throw new OpsError(
      "Approved payment rules and sending hours are required",
      409,
    );
  const keys = new Set<string>();
  const steps = b.steps.map((entry, index) => {
    const s = record(entry);
    if (
      typeof s.key !== "string" ||
      s.key !== ["first", "second"][index] ||
      keys.has(s.key) ||
      "delay_minutes" in s ||
      typeof s.template_id !== "string" ||
      !s.template_id.trim() ||
      s.template_id.length > 300 ||
      typeof s.body_template !== "string" ||
      !s.body_template.trim() ||
      s.body_template.length > 4000 ||
      /{{|}}/.test(
        s.body_template.replace(
          /{{(?:name|first_name|invoice_reference|payment_link)}}/g,
          "",
        ),
      )
    )
      throw new OpsError(
        "Valid ordered reminder steps and approved template IDs are required",
        409,
      );
    keys.add(s.key);
    return {
      key: s.key,
      template_id: s.template_id,
      body_template: s.body_template,
    };
  });
  return {
    enabled: true,
    revision: b.revision,
    approved_by: b.approved_by,
    approved_at: b.approved_at,
    location_id: MARC_PAYMENT_LOCATION,
    timezone: "Europe/London",
    max_reminders: Number(b.max_reminders),
    allowed_local_hours: { start: Number(hours.start), end: Number(hours.end) },
    timing: {
      first: "next_working_day",
      followup_calendar_days: 3,
      local_hour: 9,
    },
    steps,
  };
}

export function reminderEligibility(
  c: PaymentCase,
  attempts: PaymentAttempt[],
  rules: PaymentRules,
  stepKey: string,
  now = new Date(),
) {
  const deny = (reason: string, due_at: string | null = null) => ({
    eligible: false as const,
    reason,
    due_at,
  });
  const step = rules.steps.find((s) => s.key === stepKey);
  if (!step) return deny("Unknown reminder step");
  if (c.state !== "unpaid") return deny("Invoice is not confirmed unpaid");
  if (c.manual_pause || c.reply_needs_human || c.contact_dnd)
    return deny("Follow-up is stopped for human review, pause or DND");
  if (!c.contact_id) return deny("Verified CRM contact binding required");
  if (!c.whatsapp_opt_in) return deny("Verified WhatsApp opt-in required");
  if (
    step.body_template.includes("{{payment_link}}") &&
    (!c.hosted_invoice_url || !isStripeInvoiceUrl(c.hosted_invoice_url))
  )
    return deny("Verified Stripe payment link required");
  const verified = Date.parse(c.source_verified_at || "");
  if (
    !Number.isFinite(verified) ||
    now.getTime() - verified > 120000 ||
    verified > now.getTime() + 5000
  )
    return deny("Fresh authoritative invoice check required");
  if (
    attempts.some((a) =>
      ["reserved", "requested", "unknown", "failed"].includes(a.state),
    )
  )
    return deny("An earlier reminder needs delivery reconciliation");
  if (attempts.some((a) => a.step_key === step.key))
    return deny("This reminder step already has an attempt");
  const index = rules.steps.indexOf(step);
  if (
    rules.steps
      .slice(0, index)
      .some(
        (s) =>
          !attempts.some(
            (a) =>
              a.step_key === s.key &&
              a.receipt_verified &&
              ["sent", "delivered"].includes(a.state) &&
              Boolean(a.verified_sent_at),
          ),
      )
  )
    return deny("Earlier reminder steps are incomplete");
  if (
    attempts.filter(
      (a) => a.receipt_verified && ["sent", "delivered"].includes(a.state),
    ).length >= rules.max_reminders
  )
    return deny("Agreed reminder limit reached");
  const first = attempts.find(
    (a) =>
      a.step_key === "first" &&
      a.receipt_verified &&
      ["sent", "delivered"].includes(a.state),
  );
  const due = paymentReminderDueAt(
    c.first_failed_at,
    step.key,
    first?.verified_sent_at || null,
  );
  if (!due)
    return deny("Verified first-send timing is required for the follow-up");
  if (now.getTime() < Date.parse(due)) return deny("Reminder is not due", due);
  const weekday = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
  }).format(now);
  if (["Sat", "Sun"].includes(weekday))
    return deny("Weekend reminders roll to Monday at 09:00", due);
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: rules.timezone,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now),
  );
  if (
    hour < rules.allowed_local_hours.start ||
    hour >= rules.allowed_local_hours.end
  )
    return deny("Outside agreed local sending hours", due);
  return {
    eligible: true as const,
    step,
    rules_revision: rules.revision,
    due_at: due,
  };
}

export function renderPaymentReminder(
  c: PaymentCase,
  bodyTemplate: string,
  contact: Record<string, unknown>,
) {
  const firstName =
    typeof contact.firstName === "string" ? contact.firstName.trim() : "";
  if (bodyTemplate.includes("{{first_name}}") && !firstName)
    throw new OpsError(
      "Current CRM first name is required for this approved template",
      409,
    );
  if (
    bodyTemplate.includes("{{payment_link}}") &&
    !isStripeInvoiceUrl(c.hosted_invoice_url)
  )
    throw new OpsError("Verified Stripe payment link required", 409);
  const name = (c.customer_name || "there").replace(/[\r\n]/g, " ");
  const invoiceReference = c.invoice_number || c.invoice_id;
  const body = bodyTemplate
    .replaceAll("{{name}}", name)
    .replaceAll("{{first_name}}", firstName)
    .replaceAll("{{invoice_reference}}", invoiceReference)
    .replaceAll("{{payment_link}}", c.hosted_invoice_url || "");
  return {
    body,
    first_name: firstName || null,
    invoice_reference: invoiceReference,
    payment_link: c.hosted_invoice_url,
  };
}

export function singleBoundPaymentCase(
  cases: Pick<PaymentCase, "id" | "contact_id" | "state">[],
  contactId: string,
) {
  const unresolved = cases.filter(
    (c) =>
      c.contact_id === contactId &&
      ["unpaid", "unknown", "paused", "uncollectible"].includes(c.state),
  );
  if (unresolved.length > 1)
    return {
      eligible: false as const,
      reason: "Several unresolved invoices need manual review",
    };
  if (unresolved.length !== 1 || unresolved[0].state !== "unpaid")
    return {
      eligible: false as const,
      reason: "Exactly one bound unpaid invoice is required",
    };
  return { eligible: true as const, case_id: unresolved[0].id };
}

export function isStripeInvoiceUrl(input: unknown): input is string {
  if (typeof input !== "string") return false;
  try {
    const u = new URL(input);
    return (
      u.protocol === "https:" &&
      u.hostname === "invoice.stripe.com" &&
      !u.username &&
      !u.password &&
      !u.port
    );
  } catch {
    return false;
  }
}
