import { describe, expect, it } from "vitest";
import {
  paymentNextStep,
  paymentReminderDueAt,
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
