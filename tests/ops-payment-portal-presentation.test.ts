import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PaymentCaseSummary } from "../components/ops/workspace/PaymentCasePanel";
import type { PaymentCase } from "../lib/ops/payment-policy";

const payment = {
  id: "payment-case",
  stripe_account_id: "acct_MerchantA",
  invoice_id: "in_InvoiceA",
  invoice_number: null,
  customer_name: "Example Client",
  contact_email: "client@example.invalid",
  contact_id: null,
  state: "unpaid",
  amount_minor: 90000,
  currency: "gbp",
  source_verified_at: "2026-11-06T10:00:00Z",
  first_failed_at: "2026-11-05T09:00:00Z",
  reminder_count: 0,
  latest_delivery: "reminders_off",
  manual_pause: false,
  reply_needs_human: false,
  contact_dnd: false,
  whatsapp_opt_in: false,
  task_id: "eimear-task",
  updated_at: "2026-11-06T10:00:00Z",
} as PaymentCase;

describe("payment case summary for Marc and Eimear", () => {
  it("shows the amount, status, planned timings and Eimear's next step without pretending anything was sent", () => {
    const html = renderToStaticMarkup(createElement(PaymentCaseSummary, { payment, remindersEnabled: false }));
    expect(html).toContain("£900.00");
    expect(html).toContain("Invoice number not recorded");
    expect(html).toContain("Unpaid");
    expect(html).toContain("Automatic reminders are off");
    expect(html).toContain("Reminder 1");
    expect(html).toContain("next working day after the failure");
    expect(html).toContain("48 hours after reminder 1");
    expect(html).toContain("Eimear chases this one");
    expect(html).not.toContain("Sent ");
    expect(html).toContain('href="https://dashboard.stripe.com/acct_MerchantA/invoices/in_InvoiceA"');
    expect(html).toContain("/admin/work?task=eimear-task");
  });

  it("flags unconfirmed reminder settings instead of calling them off", () => {
    const html = renderToStaticMarkup(createElement(PaymentCaseSummary, { payment, remindersEnabled: null }));
    expect(html).toContain("Reminder settings have not been confirmed");
    expect(html).not.toContain("Automatic reminders are off");
  });

  it("shows a settled invoice without a plan", () => {
    const paid = { ...payment, state: "paid" } as PaymentCase;
    const html = renderToStaticMarkup(createElement(PaymentCaseSummary, { payment: paid, remindersEnabled: true }));
    expect(html).toContain("Paid");
    expect(html).toContain("Stripe records this invoice as paid");
    expect(html).not.toContain("Reminder 2");
  });
});
