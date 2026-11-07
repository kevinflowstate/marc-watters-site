import { describe, expect, it } from "vitest";
import {
  paymentCaseView,
  paymentHumanHandoff,
  paymentInvoiceSourceUrl,
  paymentNextStep,
  paymentReminderSummary,
  paymentTaskText,
  reportedReminderAttempts,
} from "../lib/ops/payment-display";
import type { PaymentCase, PaymentCaseEvent } from "../lib/ops/payment-policy";

const now = Date.parse("2026-11-05T16:00:00Z");
const base = {
  id: "case-1",
  stripe_account_id: "acct_A",
  invoice_id: "in_A",
  invoice_number: "CBB-001",
  customer_name: "Example Client",
  contact_email: "client@example.invalid",
  state: "unpaid",
  amount_minor: 90000,
  currency: "GBP",
  hosted_invoice_url: "https://invoice.stripe.com/i/abc",
  first_failed_at: "2026-11-05T15:00:00Z",
  reminder_count: 0,
  latest_delivery: "enrolled",
  reply_needs_human: false,
  contact_dnd: false,
  manual_pause: false,
} as PaymentCase;
const sent1: PaymentCaseEvent = {
  id: "e1",
  source: "ghl",
  event_type: "reminder_1_sent",
  occurred_at: "2026-11-06T09:01:00Z",
  created_at: "2026-11-06T09:01:02Z",
};

describe("payment drawer and next action", () => {
  it("plans reminder 1 for the next working day at 09:00 while enrolled", () => {
    expect(paymentNextStep(base, [], now)).toMatchObject({
      kind: "planned",
      step: "first",
      planned_at: "2026-11-06T09:00:00.000Z",
      overdue: false,
    });
  });
  it("plans reminder 2 48 hours after GHL reported reminder 1", () => {
    const attempts = reportedReminderAttempts([sent1]);
    expect(attempts).toMatchObject([{ step_key: "first", state: "sent", verified_sent_at: sent1.occurred_at }]);
    expect(paymentNextStep({ ...base, reminder_count: 1, latest_delivery: "reminder_1_sent" }, attempts, now))
      .toMatchObject({ step: "second", planned_at: "2026-11-08T09:01:00.000Z" });
  });
  it("hands over to Eimear after escalation, reply or DND", () => {
    expect(paymentNextStep({ ...base, latest_delivery: "escalated", reminder_count: 2 }, null).title).toBe("Eimear takes over");
    expect(paymentNextStep({ ...base, reply_needs_human: true }, null).detail).toContain("replied");
    expect(paymentNextStep({ ...base, contact_dnd: true }, null).title).toBe("Messages stopped");
  });
  it("tells Eimear to match the contact when no single CRM contact matched", () => {
    const next = paymentNextStep({ ...base, latest_delivery: "no_contact_match" }, null);
    expect(next.detail).toBe(
      "No single CRM contact matched client@example.invalid; match it in the CRM, then add them to the reminder workflow.",
    );
    expect(paymentTaskText({ ...base, latest_delivery: "no_contact_match" }, { accountLabel: "MRW A" }).detail)
      .toContain("No single CRM contact matched client@example.invalid");
  });
  it("records reminders off without implying a send", () => {
    const handoff = paymentHumanHandoff({ ...base, latest_delivery: "reminders_off" }, [], false);
    expect(handoff.summary).toContain("Automatic reminders are off");
    expect(handoff.steps[0]).toContain("not added to the reminder workflow");
    expect(handoff.sends_message).toBe(false);
  });
  it("settles paid and voided invoices", () => {
    expect(paymentNextStep({ ...base, state: "paid" }, null).kind).toBe("settled");
    expect(paymentNextStep({ ...base, state: "void" }, null).kind).toBe("settled");
  });
  it("builds the full drawer view", () => {
    const enrolled: PaymentCaseEvent = {
      id: "e0", source: "ghl", event_type: "enrolled",
      occurred_at: "2026-11-05T15:00:05Z", created_at: "2026-11-05T15:00:05Z",
    };
    const view = paymentCaseView({ ...base, reminder_count: 1, latest_delivery: "reminder_1_sent" }, [sent1, enrolled], {
      accountLabel: "MRW Management Ltd (A)",
      note: "Called, paying Friday",
      now,
    });
    expect(view).toMatchObject({
      client_name: "Example Client",
      amount: "£900.00",
      invoice_number: "CBB-001",
      stripe_account_label: "MRW Management Ltd (A)",
      status: "unpaid",
      reminder_plan: {
        reminder_1_at: "2026-11-06T09:00:00.000Z",
        reminder_2_at: "2026-11-08T09:01:00.000Z",
        reminder_2_on_weekend: true,
      },
      reminders_sent: [{ reminder: 1, sent_at: "2026-11-06T09:01:00Z" }],
      enrolled: true,
      enrolled_at: "2026-11-05T15:00:05Z",
      eimear_note: "Called, paying Friday",
    });
    expect(view.next_action).toContain("48 hours");
    expect(paymentCaseView({ ...base, reply_needs_human: true }, [], { accountLabel: "x", note: null }).status).toBe("needs_person");
  });
  it("summarises workflow progress and links to the exact Stripe invoice", () => {
    expect(paymentReminderSummary(base, null)).toBe("In the CRM reminder workflow · no reminder reported yet");
    expect(paymentReminderSummary({ ...base, latest_delivery: null }, null)).toBe("Not in the reminder workflow");
    expect(paymentInvoiceSourceUrl(base)).toBe("https://dashboard.stripe.com/acct_A/invoices/in_A");
    expect(paymentInvoiceSourceUrl({ ...base, invoice_id: "../x" })).toBeNull();
  });
});
