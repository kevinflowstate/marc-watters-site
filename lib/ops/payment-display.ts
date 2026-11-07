import type {
  PaymentAttempt,
  PaymentCase,
  PaymentCaseEvent,
} from "./payment-policy";

// TIMING RULE (Kevin, 7 Nov 2026): reminder 1 at 09:00 Europe/London on the next
// working day (Mon-Fri) after the failure; reminder 2 exactly 48 hours after
// reminder 1 if still unpaid; then Eimear takes over. No bank-holiday handling.
// GHL enforces this; the portal only calculates it for display.
const HOUR = 3600000;

function londonDate(ms: number) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(ms));
  const part = (name: string) =>
    Number(parts.find((p) => p.type === name)?.value);
  return { year: part("year"), month: part("month"), day: part("day") };
}

/** 09:00 London on a London calendar date, resolving that date's own UTC offset. */
function londonNine(year: number, month: number, day: number) {
  const nominal = Date.UTC(year, month - 1, day, 9);
  const londonHour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(nominal),
  );
  return nominal - (londonHour - 9) * HOUR;
}

export function paymentReminderPlan(
  failedAt: string | null,
  firstSentAt: string | null = null,
) {
  const failed = Date.parse(failedAt || "");
  if (!Number.isFinite(failed)) return null;
  const d = londonDate(failed);
  const date = new Date(Date.UTC(d.year, d.month - 1, d.day + 1));
  while ([0, 6].includes(date.getUTCDay()))
    date.setUTCDate(date.getUTCDate() + 1);
  const first = londonNine(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  );
  const sent = Date.parse(firstSentAt || "");
  const second = (Number.isFinite(sent) ? sent : first) + 48 * HOUR;
  return {
    first: new Date(first).toISOString(),
    second: new Date(second).toISOString(),
    /** 48 hours after a Friday reminder 1 lands on a Sunday. */
    second_on_weekend: ["Sat", "Sun"].includes(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London",
        weekday: "short",
      }).format(new Date(second)),
    ),
  };
}

export function paymentReminderDueAt(
  failedAt: string | null,
  stepKey: string,
  firstSentAt: string | null = null,
): string | null {
  const plan = paymentReminderPlan(failedAt, firstSentAt);
  if (!plan) return null;
  if (stepKey === "first") return plan.first;
  if (stepKey === "second") return plan.second;
  return null;
}

/** Reminders GHL has reported as sent, shaped for the existing drawer list. */
export function reportedReminderAttempts(
  events: PaymentCaseEvent[],
): PaymentAttempt[] {
  const out: PaymentAttempt[] = [];
  for (const [type, step] of [
    ["reminder_1_sent", "first"],
    ["reminder_2_sent", "second"],
  ] as const) {
    const event = events
      .filter((e) => e.source === "ghl" && e.event_type === type)
      .sort((a, b) => Date.parse(a.occurred_at) - Date.parse(b.occurred_at))[0];
    if (event)
      out.push({
        id: event.id,
        step_key: step,
        state: "sent",
        provider_message_id: null,
        created_at: event.created_at,
        receipt_verified: true,
        verified_sent_at: event.occurred_at,
      });
  }
  return out;
}

export const paymentDeliveryLabels: Record<string, string> = {
  sent: "Reported sent by the CRM workflow",
};

export function paymentAttemptDeliveryLabel(attempt: PaymentAttempt) {
  return paymentDeliveryLabels[attempt.state] || "Reminder result needs checking";
}

const workflowLabels: Record<string, string> = {
  reminders_off: "Automatic reminders were off when this case opened",
  enrolling: "Adding to the CRM reminder workflow",
  no_contact_match: "Not in the reminder workflow · no single CRM contact matched",
  held_for_review: "Not in the reminder workflow · held for Eimear to review",
  enrol_failed: "Not in the reminder workflow · adding them failed",
  enrolled: "In the CRM reminder workflow · no reminder reported yet",
  reminder_1_sent: "Reminder 1 reported sent",
  reminder_2_sent: "Both reminders reported sent",
  escalated: "Both reminders sent · Eimear takes over",
};

export function paymentReminderSummary(
  payment: PaymentCase,
  attempts: PaymentAttempt[] | null,
) {
  const base =
    workflowLabels[payment.latest_delivery || ""] ||
    "Not in the reminder workflow";
  const latest = attempts?.[attempts.length - 1];
  return latest?.verified_sent_at
    ? `${base} · last reported ${londonTime(latest.verified_sent_at)}`
    : base;
}

function londonTime(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Link only to this saved merchant/invoice; keep internal IDs out of the main copy. */
export function paymentInvoiceSourceUrl(payment: PaymentCase) {
  if (
    !/^acct_[A-Za-z0-9]+$/.test(payment.stripe_account_id) ||
    !/^in_[A-Za-z0-9]+$/.test(payment.invoice_id)
  )
    return null;
  return `https://dashboard.stripe.com/${payment.stripe_account_id}/invoices/${payment.invoice_id}`;
}

export function paymentAmountText(payment: Pick<PaymentCase, "amount_minor" | "currency">) {
  if (payment.amount_minor == null || !payment.currency) return "Amount not recorded";
  try {
    const formatter = new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: payment.currency.toUpperCase(),
    });
    const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
    return formatter.format(payment.amount_minor / 10 ** digits);
  } catch {
    return `${payment.amount_minor} ${payment.currency}`;
  }
}

export type PaymentDisplayStatus =
  | "unpaid"
  | "paid"
  | "voided"
  | "needs_person"
  | "cancelled";
export function paymentDisplayStatus(payment: PaymentCase): PaymentDisplayStatus {
  if (payment.state === "paid") return "paid";
  if (payment.state === "void") return "voided";
  if (payment.state === "cancelled") return "cancelled";
  if (payment.reply_needs_human || payment.contact_dnd || payment.state !== "unpaid")
    return "needs_person";
  return "unpaid";
}

export type PaymentNextStep = {
  kind: "planned" | "stopped" | "review" | "settled" | "unloaded";
  title: string;
  detail: string;
  planned_at?: string;
  step?: "first" | "second";
  overdue?: boolean;
};

export function noContactMatchLine(email: string | null) {
  return `No single CRM contact matched ${email || "the invoice email"}; match it in the CRM, then add them to the reminder workflow.`;
}

/** Display-only plan. GHL owns the actual sending and its timing. */
export function paymentNextStep(
  payment: PaymentCase,
  attempts: PaymentAttempt[] | null,
  now = Date.now(),
): PaymentNextStep {
  if (["paid", "void", "cancelled"].includes(payment.state))
    return {
      kind: "settled",
      title: "No further reminder planned",
      detail:
        payment.state === "paid"
          ? "Stripe records this invoice as paid."
          : "This invoice is closed in Stripe. No reminder is needed.",
    };
  if (payment.contact_dnd)
    return {
      kind: "stopped",
      title: "Messages stopped",
      detail: "The client is set to Do not disturb in the CRM. Eimear handles this one personally.",
    };
  if (payment.reply_needs_human)
    return {
      kind: "stopped",
      title: "Eimear takes over",
      detail: "The client replied to a reminder. Read their reply in the CRM and pick it up from there.",
    };
  if (payment.state !== "unpaid")
    return {
      kind: "review",
      title: "Check the invoice first",
      detail: "Stripe does not show this invoice as simply unpaid (it may be paused or need a decision). Eimear should check it.",
    };
  const status = payment.latest_delivery || "";
  if (status === "escalated" || payment.reminder_count >= 2)
    return {
      kind: "stopped",
      title: "Eimear takes over",
      detail: "Both reminders have gone and the invoice is still unpaid. Eimear follows up personally.",
    };
  if (status === "reminders_off")
    return {
      kind: "review",
      title: "Eimear chases this one",
      detail: "Automatic reminders were off when this case opened, so the client was not added to the reminder workflow.",
    };
  if (status === "no_contact_match")
    return { kind: "review", title: "Match the client in the CRM", detail: noContactMatchLine(payment.contact_email) };
  if (status === "enrol_failed")
    return {
      kind: "review",
      title: "Add them to the reminder workflow",
      detail: "The portal could not add this client to the CRM reminder workflow. Add them by hand in the CRM.",
    };
  if (!["enrolled", "reminder_1_sent", "reminder_2_sent", "enrolling"].includes(status))
    return {
      kind: "review",
      title: "Not in the reminder workflow",
      detail: "This case is not in the CRM reminder workflow. Eimear decides whether to add them or chase personally.",
    };
  const firstSent =
    attempts?.find((a) => a.step_key === "first")?.verified_sent_at || null;
  const step: "first" | "second" =
    payment.reminder_count >= 1 || firstSent || status === "reminder_1_sent"
      ? "second"
      : "first";
  const planned_at = paymentReminderDueAt(payment.first_failed_at, step, firstSent);
  if (!planned_at)
    return {
      kind: "review",
      title: "Reminder timing needs checking",
      detail: "The failure date is missing, so the reminder dates cannot be shown.",
    };
  return {
    kind: "planned",
    title: step === "first" ? "Reminder 1 · planned timing" : "Reminder 2 · planned timing",
    detail:
      step === "first"
        ? "The CRM workflow sends reminder 1 at 09:00 London time on the next working day after the failure."
        : "The CRM workflow sends reminder 2 48 hours after reminder 1 if the invoice is still unpaid. Then Eimear takes over.",
    step,
    planned_at,
    overdue: Date.parse(planned_at) <= now,
  };
}

/** Eimear's view of what to do next. It never sends a message. */
export function paymentHumanHandoff(
  payment: PaymentCase,
  attempts: PaymentAttempt[] | null,
  remindersEnabled: boolean,
  now = Date.now(),
) {
  const next = paymentNextStep(payment, attempts, now);
  const closed = ["paid", "void", "cancelled"].includes(payment.state);
  const steps: string[] = [];
  if (closed) steps.push("No payment chase is needed for this invoice.");
  else {
    steps.push(next.detail);
    if (payment.latest_delivery === "no_contact_match" && next.kind !== "review")
      steps.push(noContactMatchLine(payment.contact_email));
    if (next.kind === "stopped" || next.kind === "review")
      steps.push("Open the invoice in Stripe to confirm it is still unpaid before contacting the client.");
  }
  return {
    owner: "eimear" as const,
    required: !closed && next.kind !== "planned",
    title: closed ? "No payment chase needed" : next.title,
    summary: closed
      ? "Stripe records this invoice as closed. The client has been taken out of the reminder workflow."
      : remindersEnabled
        ? "The CRM workflow sends the two reminders. This portal records what it reports back."
        : "Automatic reminders are off. New cases are recorded for Eimear only.",
    steps,
    source_checked_at: payment.source_verified_at,
    reminder_plan: next,
    sends_message: false as const,
  };
}

/** Everything the drawer needs for one case. */
export function paymentCaseView(
  payment: PaymentCase,
  events: PaymentCaseEvent[],
  options: { accountLabel: string; note: string | null; now?: number },
) {
  const reported = reportedReminderAttempts(events);
  const firstSent = reported.find((a) => a.step_key === "first")?.verified_sent_at || null;
  const plan = paymentReminderPlan(payment.first_failed_at, firstSent);
  const enrolled = events.find((e) => e.event_type === "enrolled");
  return {
    client_name: payment.customer_name || payment.contact_email || "Client not matched",
    amount: paymentAmountText(payment),
    invoice_number: payment.invoice_number || payment.invoice_id,
    invoice_url: payment.hosted_invoice_url,
    stripe_invoice_url: paymentInvoiceSourceUrl(payment),
    stripe_account_label: options.accountLabel,
    status: paymentDisplayStatus(payment),
    reminder_plan: plan
      ? { reminder_1_at: plan.first, reminder_2_at: plan.second, reminder_2_on_weekend: plan.second_on_weekend }
      : null,
    reminders_sent: reported.map((a) => ({
      reminder: a.step_key === "first" ? 1 : 2,
      sent_at: a.verified_sent_at,
    })),
    enrolled:
      Boolean(enrolled) ||
      ["enrolled", "reminder_1_sent", "reminder_2_sent", "escalated"].includes(
        payment.latest_delivery || "",
      ),
    enrolled_at: enrolled?.occurred_at || payment.bound_at || null,
    workflow_status: payment.latest_delivery,
    eimear_note: options.note,
    next_action: paymentNextStep(payment, reported, options.now).detail,
  };
}

/** Eimear's task title and detail, rebuilt from the case every time it changes. */
export function paymentTaskText(
  payment: PaymentCase,
  options: { accountLabel: string; extraLines?: string[] },
) {
  const label = payment.customer_name || payment.contact_email || payment.invoice_id;
  const next = paymentNextStep(payment, null);
  const lines = [
    `Invoice ${payment.invoice_number || payment.invoice_id} · ${options.accountLabel}`,
    `Amount: ${paymentAmountText(payment)}`,
    `Payment: ${payment.state}`,
    `Reminders: ${paymentReminderSummary(payment, null)} (${payment.reminder_count} of 2 reported sent)`,
    `Next: ${next.detail}`,
    ...(options.extraLines || []),
  ];
  return {
    title:
      next.kind === "stopped"
        ? `Eimear: follow up on unpaid payment — ${label}`
        : `Payment needs checking — ${label}`,
    detail: lines.join("\n"),
  };
}
