import type { PaymentAttempt, PaymentCase } from "./payment-policy";

// Calendar arithmetic uses London dates, then resolves the due date's own UTC offset.
// This preserves 09:00 through BST changes instead of adding fixed 24/72-hour durations.
export function paymentReminderDueAt(
  failedAt: string | null,
  stepKey: string,
  firstVerifiedSentAt: string | null = null,
): string | null {
  if (!["first", "second"].includes(stepKey)) return null;
  const base = Date.parse(
    (stepKey === "first" ? failedAt : firstVerifiedSentAt) || "",
  );
  if (!Number.isFinite(base)) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(base));
  const part = (name: string) =>
    Number(parts.find((p) => p.type === name)?.value);
  const date = new Date(
    Date.UTC(
      part("year"),
      part("month") - 1,
      part("day") + (stepKey === "first" ? 1 : 3),
    ),
  );
  while ([0, 6].includes(date.getUTCDay()))
    date.setUTCDate(date.getUTCDate() + 1);
  const nominal = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    9,
  );
  const londonHour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(nominal),
  );
  return new Date(nominal - (londonHour - 9) * 3600000).toISOString();
}

export const paymentDeliveryLabels: Record<string, string> = {
  reserved: "Reserved · not sent",
  requested: "Requested · delivery not confirmed",
  sent: "Sent · delivery not confirmed",
  delivered: "Delivery confirmed",
  failed: "Send failed · check before retrying",
  unknown: "Outcome unknown · check before retrying",
};
export type PaymentNextStep = {
  kind: "planned" | "stopped" | "review" | "settled" | "unloaded";
  title: string;
  detail: string;
  planned_at?: string;
  step?: "first" | "second";
  overdue?: boolean;
};

/** A display-only plan, never sending eligibility. No request, mutation or claim. */
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
          ? "The saved invoice check records this payment as paid."
          : "The saved invoice is closed. Do not send another reminder.",
    };
  if (payment.contact_dnd)
    return {
      kind: "stopped",
      title: "Messages stopped",
      detail:
        "Do not disturb is set. Eimear needs to review the case; no further reminder is planned.",
    };
  if (payment.reply_needs_human)
    return {
      kind: "stopped",
      title: "Eimear takes over",
      detail:
        "The client has replied. Read their reply before deciding what happens next.",
    };
  if (payment.manual_pause || payment.state === "paused")
    return {
      kind: "stopped",
      title: "Follow-up paused",
      detail: "Eimear needs to review this case before any further reminder.",
    };
  if (payment.state !== "unpaid")
    return {
      kind: "review",
      title: "Check the invoice first",
      detail:
        "The saved status does not confirm an unpaid invoice. Eimear should check the payment account.",
    };
  if (payment.reminder_count >= 2)
    return {
      kind: "stopped",
      title: "Eimear takes over",
      detail:
        "Two reminders are recorded. The agreed reminder limit has been reached; no third reminder is planned.",
    };
  if (attempts === null)
    return {
      kind: "unloaded",
      title: "Check reminder history",
      detail:
        "Open the details to see the planned next step and any confirmed sends.",
    };
  if (
    attempts.some(
      (a) =>
        !["sent", "delivered"].includes(a.state) ||
        !a.receipt_verified ||
        !a.verified_sent_at ||
        !Number.isFinite(Date.parse(a.verified_sent_at)),
    )
  )
    return {
      kind: "review",
      title: "Check the previous reminder result",
      detail:
        "An attempt has no confirmed successful send time, or its outcome needs checking. Do not send or repeat a reminder until it is reconciled.",
    };
  const steps = new Set(attempts.map((a) => a.step_key));
  if (
    attempts.length !== steps.size ||
    [...steps].some((s) => !["first", "second"].includes(s)) ||
    steps.size !== payment.reminder_count ||
    (steps.has("second") && !steps.has("first"))
  )
    return {
      kind: "review",
      title: "Reminder records need checking",
      detail:
        "The case count and verified reminder history do not agree. Eimear should reconcile the records before another reminder.",
    };
  if (steps.size >= 2)
    return {
      kind: "stopped",
      title: "Eimear takes over",
      detail:
        "Both reminders have a confirmed send. No third reminder is planned.",
    };
  const step = steps.has("first") ? "second" : "first";
  const first = attempts.find((a) => a.step_key === "first");
  const planned_at = paymentReminderDueAt(
    payment.first_failed_at,
    step,
    first?.verified_sent_at || null,
  );
  if (!planned_at)
    return {
      kind: "review",
      title: "Reminder timing needs checking",
      detail:
        "The required failure date or confirmed first-send time is missing. A reminder date cannot be calculated safely.",
    };
  const prerequisites = !payment.contact_id
    ? "The client’s CRM record still needs matching. "
    : !payment.whatsapp_opt_in
      ? "WhatsApp permission still needs verifying. "
      : "";
  return {
    kind: "planned",
    title:
      step === "first"
        ? "First reminder · planned timing"
        : "One follow-up · planned timing",
    detail:
      prerequisites +
      (step === "first"
        ? "The next weekday after the recorded failure, at 09:00 London time."
        : "Three calendar days after the confirmed first send, moving weekends to Monday at 09:00 London time.") +
      " The invoice and sending permissions must be checked again before any send.",
    step,
    planned_at,
    overdue: Date.parse(planned_at) <= now,
  };
}
