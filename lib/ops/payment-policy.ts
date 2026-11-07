// Shared payment-case types and constants. GHL sends the reminders natively;
// the portal records cases, enrols/removes the contact and shows progress.
export { paymentReminderDueAt, paymentReminderPlan } from "./payment-display";

export const MARC_PAYMENT_LOCATION = "93GJEdsr0cT9el3OINXq";
export type PaymentState =
  | "unpaid"
  | "paid"
  | "void"
  | "uncollectible"
  | "paused"
  | "cancelled"
  | "unknown";

/** Stored in ops_payment_cases.latest_delivery: where the CRM workflow has got to. */
export type ReminderStatus =
  | "reminders_off"
  | "enrolling"
  | "no_contact_match"
  | "enrol_failed"
  | "enrolled"
  | "reminder_1_sent"
  | "reminder_2_sent"
  | "escalated";
export const reminderStatusRank: Record<string, number> = {
  enrolled: 1,
  reminder_1_sent: 2,
  reminder_2_sent: 3,
  escalated: 4,
};

/** Progress events the GHL workflow posts back to /api/webhooks/ghl-payment. */
export const GHL_PROGRESS_EVENTS = [
  "reminder_1_sent",
  "reminder_2_sent",
  "escalated",
  "reply_received",
  "dnd",
] as const;
export type GhlProgressEvent = (typeof GHL_PROGRESS_EVENTS)[number];

export type PaymentCase = {
  id: string;
  stripe_account_id: string;
  invoice_id: string;
  invoice_number: string | null;
  stripe_customer_id: string | null;
  subscription_id: string | null;
  /** GHL contact ID (found by email at enrolment, or bound by an admin). */
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
  /** Reminder workflow status (see ReminderStatus); legacy rows may hold old delivery states. */
  latest_delivery: string | null;
  reminder_count: number;
  task_id: string | null;
  /** Enrolment time when the portal added the contact to the GHL workflow. */
  bound_at?: string | null;
  updated_at: string;
};

/** Display-only: one row per reminder that GHL has reported as sent. */
export type PaymentAttempt = {
  id: string;
  step_key: string;
  state: string;
  provider_message_id: string | null;
  created_at: string;
  receipt_verified: boolean;
  verified_sent_at: string | null;
};

export type PaymentCaseEvent = {
  id: string;
  source: string;
  event_type: string;
  occurred_at: string;
  created_at: string;
  data?: Record<string, unknown> | null;
};

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
