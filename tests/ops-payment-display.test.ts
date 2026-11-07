import { describe, expect, it } from "vitest";
import {
  paymentNextStep,
  paymentReminderDueAt,
  paymentHumanHandoff,
  paymentAttemptDeliveryLabel,
  paymentReminderSummary,
  paymentInvoiceSourceUrl,
} from "../lib/ops/payment-display";
import type { PaymentCase, PaymentAttempt } from "../lib/ops/payment-policy";
const now = Date.parse("2026-11-06T12:00:00Z");
const invoice = {
  state: "unpaid",
  reminder_count: 0,
  first_failed_at: "2026-11-06T10:00:00Z",
  contact_id: "contact",
  whatsapp_opt_in: true,
} as PaymentCase;
const first = {
  id: "a1",
  step_key: "first",
  state: "delivered",
  receipt_verified: true,
  verified_sent_at: "2026-11-09T10:00:00Z",
} as PaymentAttempt;
describe("read-only payment next-step presentation", () => {
  it("keeps a useful Eimear handoff when reminders are off without claiming a queued send", () => {
    const review = paymentHumanHandoff(invoice, [], false, now);
    expect(review).toMatchObject({ owner: "eimear", required: true, sends_message: false });
    expect(review.summary).toContain("Automatic reminders are off");
    expect(review.steps[0]).toContain("correct payment account");
    expect(review.reminder_plan).toMatchObject({ step: "first", planned_at: "2026-11-09T09:00:00.000Z" });
  });
  it("shows missing identity and permission without a WhatsApp action", () => {
    const review = paymentHumanHandoff({ ...invoice, contact_id: null, whatsapp_opt_in: false }, [], false, now);
    expect(review.steps.join(" ")).toContain("Match the invoice");
    expect(review.steps.join(" ")).toContain("Do not send a WhatsApp");
    expect(review.steps.join(" ")).toContain("Refresh the invoice");
    expect(review.sends_message).toBe(false);
  });
  it("retains reply, DND and uncertain-delivery checks on the human path", () => {
    const review = paymentHumanHandoff({ ...invoice, reply_needs_human: true, contact_dnd: true }, [{ ...first, state: "unknown" }], false, now);
    expect(review.steps.join(" ")).toContain("Read the client’s reply");
    expect(review.steps.join(" ")).toContain("Do not message");
    expect(review.reminder_plan.kind).toBe("stopped");
    const unknown = paymentHumanHandoff(invoice, [{ ...first, state: "unknown" }], false, now);
    expect(unknown.steps.join(" ")).toContain("reconciled");
  });
  it("does not tell Eimear to chase a settled invoice or send a third automatic reminder", () => {
    const paid = paymentHumanHandoff({ ...invoice, state: "paid" }, [], false, now);
    expect(paid.required).toBe(false);
    expect(paid.steps).toEqual(["No payment chase is needed for this saved invoice status."]);
    expect(paid.summary).toContain("No further reminder is planned");
    expect(paid.summary).not.toContain("Eimear to review");
    const max = paymentHumanHandoff({ ...invoice, reminder_count: 2 }, [], false, now);
    expect(max.steps.join(" ")).toContain("no third automatic reminder");
  });
  it("does not infer a send plan before history has been read", () =>
    expect(paymentNextStep(invoice, null).kind).toBe("unloaded"));
  it("plans Friday failures for Monday without describing them as scheduled", () => {
    const next = paymentNextStep(invoice, [], now);
    expect(next).toMatchObject({
      kind: "planned",
      step: "first",
      planned_at: "2026-11-09T09:00:00.000Z",
      overdue: false,
    });
    expect(next.detail).toContain("must be checked again");
  });
  it("anchors the sole follow-up to the actual confirmed first send", () => {
    expect(
      paymentNextStep({ ...invoice, reminder_count: 1 }, [first], now),
    ).toMatchObject({ step: "second", planned_at: "2026-11-12T09:00:00.000Z" });
    expect(
      paymentReminderDueAt(
        invoice.first_failed_at,
        "second",
        "2026-11-12T10:00:00Z",
      ),
    ).toBe("2026-11-16T09:00:00.000Z");
  });
  it("hands over after two recorded reminders", () =>
    expect(
      paymentNextStep({ ...invoice, reminder_count: 2 }, [first]).title,
    ).toBe("Eimear takes over"));
  it.each(["unknown", "failed", "requested", "reserved"])(
    "stops an uncertain %s attempt",
    (state) => {
      expect(paymentNextStep(invoice, [{ ...first, state }], now).kind).toBe(
        "review",
      );
    },
  );
  it("requires a verified send timestamp even when status says sent", () => {
    expect(
      paymentNextStep({ ...invoice, reminder_count: 1 }, [
        { ...first, state: "sent", receipt_verified: false },
      ]).kind,
    ).toBe("review");
    expect(
      paymentNextStep({ ...invoice, reminder_count: 1 }, [
        { ...first, verified_sent_at: null },
      ]).kind,
    ).toBe("review");
  });
  it("stops mismatched counts and duplicate first reminders", () => {
    expect(paymentNextStep(invoice, [first]).kind).toBe("review");
    expect(
      paymentNextStep({ ...invoice, reminder_count: 1 }, [
        first,
        { ...first, id: "a2" },
      ]).kind,
    ).toBe("review");
  });
  it.each(["reply_needs_human", "manual_pause", "contact_dnd"])(
    "keeps %s stopped even with no history loaded",
    (field) => {
      expect(paymentNextStep({ ...invoice, [field]: true }, null).kind).toBe(
        "stopped",
      );
    },
  );
  it.each(["paid", "void", "cancelled"])(
    "does not plan another reminder for %s",
    (state) => {
      expect(
        paymentNextStep({ ...invoice, state } as PaymentCase, []).kind,
      ).toBe("settled");
    },
  );
  it("does not invent failure timing or treat unknown state as unpaid", () => {
    expect(
      paymentNextStep({ ...invoice, first_failed_at: null }, []).kind,
    ).toBe("review");
    expect(paymentNextStep({ ...invoice, state: "unknown" }, []).kind).toBe(
      "review",
    );
  });
  it("makes missing permission and overdue timing explicit without granting eligibility", () => {
    const next = paymentNextStep(
      { ...invoice, whatsapp_opt_in: false },
      [],
      Date.parse("2026-11-10T12:00:00Z"),
    );
    expect(next.overdue).toBe(true);
    expect(next.detail).toContain("permission still needs verifying");
    expect(next).not.toHaveProperty("eligible");
  });
});

describe("payment receipt wording", () => {
  it.each(["sent", "delivered"])("does not present an unverified %s status as a successful send", (state) => {
    expect(paymentAttemptDeliveryLabel({ ...first, state, receipt_verified: false })).toContain("not verified");
    expect(paymentAttemptDeliveryLabel({ ...first, state, verified_sent_at: null })).toContain("not verified");
    expect(paymentAttemptDeliveryLabel({ ...first, state, verified_sent_at: "invalid" })).toContain("not verified");
  });
  it("distinguishes a verified send from confirmed delivery", () => {
    expect(paymentAttemptDeliveryLabel({ ...first, state: "sent" })).toBe("Send confirmed · delivery not confirmed");
    expect(paymentAttemptDeliveryLabel(first)).toBe("Delivery confirmed");
    expect(paymentAttemptDeliveryLabel({ ...first, state: "reserved" })).toBe("Prepared · not sent");
    expect(paymentAttemptDeliveryLabel({ ...first, state: "unknown" })).toContain("check before retrying");
  });
  it("requires history before repeating a collapsed card's successful status", () => {
    expect(paymentReminderSummary({ ...invoice, latest_delivery: "delivered" }, null)).toBe("Reminder result saved · open history to check");
    expect(paymentReminderSummary({ ...invoice, latest_delivery: "delivered" }, [first])).toBe("Delivery confirmed");
    expect(paymentReminderSummary({ ...invoice, latest_delivery: "delivered" }, [{ ...first, receipt_verified: false }])).toContain("not verified");
  });
  it("does not hide case/history disagreements behind a successful label", () => {
    expect(paymentReminderSummary({ ...invoice, latest_delivery: "delivered" }, [])).toBe("Reminder records need checking");
    expect(paymentReminderSummary({ ...invoice, reminder_count: 1, latest_delivery: null }, [])).toBe("Reminder records need checking");
    expect(paymentReminderSummary({ ...invoice, latest_delivery: "unknown" }, [first])).toBe("Reminder records need checking");
    expect(paymentReminderSummary({ ...invoice, latest_delivery: null }, [])).toBe("No reminder result recorded");
  });
  it("links to the exact saved Stripe merchant and invoice without accepting arbitrary URLs", () => {
    const source = { ...invoice, stripe_account_id: "acct_MerchantA", invoice_id: "in_InvoiceA" };
    expect(paymentInvoiceSourceUrl(source)).toBe("https://dashboard.stripe.com/acct_MerchantA/invoices/in_InvoiceA");
    expect(paymentInvoiceSourceUrl({ ...source, stripe_account_id: "acct_MerchantB" })).toContain("/acct_MerchantB/");
    expect(paymentInvoiceSourceUrl({ ...source, stripe_account_id: "https://example.com" })).toBeNull();
    expect(paymentInvoiceSourceUrl({ ...source, invoice_id: "in_InvoiceA?redirect=example.com" })).toBeNull();
  });
});
