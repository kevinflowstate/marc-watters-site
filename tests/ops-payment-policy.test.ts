import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ getEnv: () => undefined }));
vi.mock("@/lib/ops/tasks", () => ({
  OpsError: class extends Error {
    constructor(message: string, public status = 400) { super(message); }
  },
  record: (value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("JSON object required");
    return value as Record<string, unknown>;
  },
}));
import * as stripeModule from "../lib/ops/payment-stripe";
import { paymentReminderPlan, paymentReminderDueAt } from "../lib/ops/payment-policy";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stripe = stripeModule as any;
const now = new Date("2026-11-05T12:00:00Z");

describe("reminder timing: next working day 09:00 London, then exactly 48 hours", () => {
  it("puts a Thursday failure on Friday 09:00 and reminder 2 on Sunday 09:00", () => {
    const plan = paymentReminderPlan("2026-11-05T15:00:00Z");
    expect(plan).toMatchObject({
      first: "2026-11-06T09:00:00.000Z",
      second: "2026-11-08T09:00:00.000Z",
      second_on_weekend: true,
    });
  });
  it("moves Friday, Saturday and Sunday failures to Monday 09:00 and reminder 2 to Wednesday", () => {
    for (const failed of ["2026-11-06T10:00:00Z", "2026-11-07T10:00:00Z", "2026-11-08T23:30:00Z"]) {
      expect(paymentReminderDueAt(failed, "first")).toBe("2026-11-09T09:00:00.000Z");
      expect(paymentReminderDueAt(failed, "second")).toBe("2026-11-11T09:00:00.000Z");
    }
  });
  it("never sends reminder 1 on the failure day itself, even before 09:00", () => {
    expect(paymentReminderDueAt("2026-11-10T07:00:00Z", "first")).toBe("2026-11-11T09:00:00.000Z");
  });
  it("anchors reminder 2 to the time GHL reported reminder 1 as sent", () => {
    expect(paymentReminderDueAt("2026-11-05T15:00:00Z", "second", "2026-11-06T09:03:00Z")).toBe("2026-11-08T09:03:00.000Z");
  });
  it("keeps 09:00 London across the clocks change and uses London dates near midnight", () => {
    // BST: 09:00 London = 08:00 UTC. 23:30 UTC on Mon 26 Oct is still Monday in London (GMT).
    expect(paymentReminderDueAt("2026-10-22T12:00:00Z", "first")).toBe("2026-10-23T08:00:00.000Z");
    expect(paymentReminderDueAt("2026-10-26T23:30:00Z", "first")).toBe("2026-10-27T09:00:00.000Z");
    // Friday 23 Oct BST failure -> Monday 26 Oct 09:00 GMT.
    expect(paymentReminderDueAt("2026-10-23T12:00:00Z", "first")).toBe("2026-10-26T09:00:00.000Z");
  });
  it("returns nothing without a failure time", () => {
    expect(paymentReminderPlan(null)).toBeNull();
    expect(paymentReminderDueAt("2026-11-05T15:00:00Z", "third")).toBeNull();
  });
});

describe("Stripe payment authority", () => {
  it("verifies raw bytes and timestamp with the correct merchant secret", () => {
    const raw = '{"id":"evt_demo"}',
      t = Math.floor(now.getTime() / 1000),
      secret = "test-only-secret";
    const signature = createHmac("sha256", secret)
      .update(`${t}.${raw}`)
      .digest("hex");
    expect(() =>
      stripe.verifyStripePaymentSignature(
        raw,
        `t=${t},v1=${signature}`,
        secret,
        now.getTime(),
      ),
    ).not.toThrow();
    for (const [body, header, key, at] of [
      [raw, `t=${t},v1=${signature}`, "other", now.getTime()],
      [raw + " ", `t=${t},v1=${signature}`, secret, now.getTime()],
      [raw, `t=${t},v1=${signature}`, secret, now.getTime() + 301000],
      [raw, `t=${t},t=${t},v1=${signature}`, secret, now.getTime()],
    ])
      expect(() =>
        stripe.verifyStripePaymentSignature(body, header, key, at),
      ).toThrow();
  });
  it("keeps two merchant reads separate and reads current invoice state", async () => {
    for (const accountId of ["acct_A", "acct_B"]) {
      const request = vi.fn(async (url: string) =>
        Response.json(
          url.endsWith("/account")
            ? { id: accountId }
            : {
                id: "in_A",
                object: "invoice",
                livemode: false,
                status: "paid",
                amount_remaining: 0,
                currency: "gbp",
                customer: "cus_A",
                hosted_invoice_url: "https://invoice.stripe.com/i/abc",
              },
        ),
      );
      const result = await stripe.readStripePaymentSnapshot(
        {
          alias: accountId,
          account_id: accountId,
          api_key: "test-only",
          webhook_secret: "test-only",
          livemode: false,
        },
        "in_A",
        request,
      );
      expect(result.stripe_account_id).toBe(accountId);
      expect(result.state).toBe("paid");
      expect(request).toHaveBeenCalledTimes(2);
    }
  });
  it("refuses the wrong merchant before reading an invoice", async () => {
    const request = vi.fn(async () => Response.json({ id: "acct_wrong" }));
    await expect(
      stripe.readStripePaymentSnapshot(
        { account_id: "acct_A", api_key: "test-only", livemode: false },
        "in_A",
        request,
      ),
    ).rejects.toThrow("merchant identity");
    expect(request).toHaveBeenCalledOnce();
  });
  it("reads current subscription pause instead of chasing an open invoice", async () => {
    const request = vi.fn(async (url: string) =>
      Response.json(
        url.endsWith("/account")
          ? { id: "acct_A" }
          : url.includes("/subscriptions/")
            ? {
                id: "sub_A",
                object: "subscription",
                livemode: false,
                status: "active",
                pause_collection: { behavior: "void" },
              }
            : {
                id: "in_A",
                object: "invoice",
                livemode: false,
                status: "open",
                amount_remaining: 10000,
                currency: "gbp",
                parent: { subscription_details: { subscription: "sub_A" } },
              },
      ),
    );
    expect(
      (
        await stripe.readStripePaymentSnapshot(
          { account_id: "acct_A", api_key: "test-only", livemode: false },
          "in_A",
          request,
        )
      ).state,
    ).toBe("paused");
  });
});

