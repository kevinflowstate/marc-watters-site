import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PaymentReviews } from "../components/admin/AutomationReviewPanels";
import type { PaymentCase } from "../lib/ops/payment-policy";

const payment = {
  id: "payment-case",
  stripe_account_id: "acct_MerchantA",
  invoice_id: "in_InvoiceA",
  invoice_number: null,
  customer_name: "Example Client",
  state: "unpaid",
  amount_minor: 90000,
  currency: "gbp",
  source_verified_at: "2026-11-06T10:00:00Z",
  first_failed_at: "2026-11-06T09:00:00Z",
  reminder_count: 1,
  latest_delivery: "delivered",
  task_id: "eimear-task",
} as PaymentCase;

describe("payment cards for Marc and Eimear", () => {
  it("shows the client, source check, owner and task meaning without treating a saved status as a receipt", () => {
    const html = renderToStaticMarkup(createElement(PaymentReviews, { cases: [payment], remindersEnabled: false }));
    expect(html).toContain("Example Client");
    expect(html).toContain("£900.00");
    expect(html).toContain("Payment last checked: 6 Nov 2026, 10:00");
    expect(html).toContain("London time");
    expect(html).toContain("Next action for Eimear");
    expect(html).toContain("Automatic reminders are off");
    expect(html).toContain("Not in the reminder workflow");
    expect(html).not.toContain("Delivery confirmed");
    expect(html).not.toContain("Verified reminders:");
    expect(html).toContain("does not send a reminder or mark the invoice as paid");
  });

  it("keeps unknown account names explicit and sends the reviewer to the exact merchant's invoice", () => {
    const html = renderToStaticMarkup(createElement(PaymentReviews, { cases: [payment], remindersEnabled: null }));
    expect(html).toContain("Payment account name needs confirming");
    expect(html).toContain("Invoice number not recorded");
    expect(html).toContain('href="https://dashboard.stripe.com/acct_MerchantA/invoices/in_InvoiceA"');
    expect(html).toContain("Check invoice in Stripe");
    expect(html).toContain("Reminder settings have not been confirmed");
    expect(html).not.toContain("Automatic reminders are off");
  });
});
