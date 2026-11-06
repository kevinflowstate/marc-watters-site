import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createHash, createHmac } from "node:crypto";
import { transformSync } from "esbuild";
import { describe, expect, it, vi } from "vitest";
import type { PaymentCase, PaymentRules } from "../lib/ops/payment-policy";

const nativeRequire = createRequire(import.meta.url);
class OpsError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
function record(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new OpsError("JSON object required");
  return value as Record<string, unknown>;
}
function load(name: string, mocks: Record<string, unknown> = {}) {
  const code = transformSync(
    readFileSync(
      new URL("../lib/ops/" + name + ".ts", import.meta.url),
      "utf8",
    ),
    { loader: "ts", format: "cjs", target: "es2022" },
  ).code;
  const m = { exports: {} as Record<string, (...args: unknown[]) => any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
  const require = (path: string): unknown => {
    if (path in mocks) return mocks[path];
    if (path === "./tasks")
      return { OpsError, record, uuid: (value: unknown) => value };
    if (path.startsWith("node:")) return nativeRequire(path);
    if (path === "@/lib/env") return { getEnv: () => undefined };
    if (path === "./payment-policy") return load("payment-policy");
    if (path === "./payment-display") return load("payment-display");
    if (path === "./payment-stripe") return {};
    if (path === "@/lib/supabase/admin")
      return {
        createAdminClient: () => {
          throw Error("Unexpected database access");
        },
      };
    throw Error("Unexpected dependency " + path);
  };
  new Function("require", "module", "exports", code)(require, m, m.exports);
  return m.exports;
}
const policy = load("payment-policy"),
  stripe = load("payment-stripe");
const now = new Date("2026-11-05T12:00:00Z");
const c: PaymentCase = {
  id: "case-id",
  stripe_account_id: "acct_A",
  invoice_id: "in_A",
  invoice_number: "CBB-2026-001",
  stripe_customer_id: "cus_A",
  subscription_id: null,
  contact_id: "contactId",
  contact_email: "demo@example.invalid",
  customer_name: "Demo",
  client_id: null,
  state: "unpaid",
  amount_minor: 10000,
  currency: "GBP",
  hosted_invoice_url: "https://invoice.stripe.com/i/abc",
  first_failed_at: "2026-11-01T12:00:00Z",
  source_verified_at: now.toISOString(),
  manual_pause: false,
  reply_needs_human: false,
  contact_dnd: false,
  whatsapp_opt_in: true,
  latest_delivery: null,
  reminder_count: 0,
  task_id: null,
  updated_at: now.toISOString(),
};
const rules: PaymentRules = {
  enabled: true,
  revision: "reviewed-1",
  approved_by: "demo-admin",
  approved_at: "2026-11-01T12:00:00Z",
  location_id: "93GJEdsr0cT9el3OINXq",
  timezone: "Europe/London",
  max_reminders: 2,
  timing: {
    first: "next_working_day",
    followup_calendar_days: 3,
    local_hour: 9,
  },
  allowed_local_hours: { start: 9, end: 17 },
  steps: [
    {
      key: "first",
      template_id: "approved-first",
      body_template: "Hi {{name}}, please check {{payment_link}}",
    },
    {
      key: "second",
      template_id: "approved-second",
      body_template: "Please check {{payment_link}}",
    },
  ],
};

describe("invoice reminder rules", () => {
  it.each([
    ["2026-11-06T16:00:00Z", "first", null, "2026-11-09T09:00:00.000Z"],
    ["2026-11-07T12:00:00Z", "first", null, "2026-11-09T09:00:00.000Z"],
    ["2026-11-05T23:30:00Z", "first", null, "2026-11-06T09:00:00.000Z"],
    ["2026-10-23T16:00:00Z", "first", null, "2026-10-26T09:00:00.000Z"],
    ["2026-03-27T08:00:00Z", "first", null, "2026-03-30T08:00:00.000Z"],
    [
      "2026-11-01T12:00:00Z",
      "second",
      "2026-11-09T09:00:00Z",
      "2026-11-12T09:00:00.000Z",
    ],
    [
      "2026-11-01T12:00:00Z",
      "second",
      "2026-11-05T15:00:00Z",
      "2026-11-09T09:00:00.000Z",
    ],
    [
      "2026-03-01T12:00:00Z",
      "second",
      "2026-03-27T09:00:00Z",
      "2026-03-30T08:00:00.000Z",
    ],
    [
      "2026-10-01T12:00:00Z",
      "second",
      "2026-10-21T08:00:00Z",
      "2026-10-26T09:00:00.000Z",
    ],
  ])(
    "calculates London calendar timing: %s / %s",
    (failed, step, firstSent, expected) =>
      expect(policy.paymentReminderDueAt(failed, step, firstSent)).toBe(
        expected,
      ),
  );
  it("requires the verified first-send time and exactly two agreed steps", () => {
    expect(
      policy.paymentReminderDueAt(c.first_failed_at, "second", null),
    ).toBeNull();
    const first = {
      id: "attempt",
      step_key: "first",
      state: "sent",
      provider_message_id: "message",
      created_at: "2026-11-02T09:00:00Z",
      receipt_verified: false,
      verified_sent_at: "2026-11-02T09:00:00Z",
    };
    expect(
      policy.reminderEligibility(c, [first], rules, "second", now).eligible,
    ).toBe(false);
    expect(
      policy.reminderEligibility(
        c,
        [{ ...first, receipt_verified: true, verified_sent_at: null }],
        rules,
        "second",
        now,
      ).eligible,
    ).toBe(false);
    const recent = {
      ...first,
      receipt_verified: true,
      verified_sent_at: "2026-11-04T09:00:00Z",
    };
    const result = policy.reminderEligibility(
      c,
      [recent],
      rules,
      "second",
      now,
    );
    expect(result.eligible).toBe(false);
    expect(result.due_at).toBe("2026-11-09T09:00:00.000Z");
    expect(() => policy.paymentRules({ ...rules, max_reminders: 3 })).toThrow();
    expect(() =>
      policy.paymentRules({
        ...rules,
        timing: { ...rules.timing, followup_calendar_days: 2 },
      }),
    ).toThrow();
  });
  const replyBody =
    "Hi {{first_name}}, it's Eimear from Construction Business Blueprint. A payment on your account hasn't gone through. Please reply here and I'll help you get it sorted.";
  it("supports the approved reply-first body without invoice variables or a payment link", () => {
    const simple = {
      ...rules,
      max_reminders: 2,
      steps: [{ ...rules.steps[0], body_template: replyBody }, rules.steps[1]],
    };
    expect(policy.paymentRules(simple).steps[0].body_template).toBe(replyBody);
    expect(
      policy.reminderEligibility(
        { ...c, hosted_invoice_url: null },
        [],
        simple,
        "first",
        now,
      ).eligible,
    ).toBe(true);
    for (const body of [
      "Hi {{unknown}}, reply here.",
      "Hi {{first_name}, reply here.",
      "Hi {first_name}}, reply here.",
    ])
      expect(() =>
        policy.paymentRules({
          ...simple,
          steps: [{ ...simple.steps[0], body_template: body }, simple.steps[1]],
        }),
      ).toThrow();
  });
  it("renders native first_name from the fresh CRM contact, preserving an invoice-only link when requested", () => {
    const simple = policy.renderPaymentReminder(
      {
        ...c,
        customer_name: "Stripe Different Name",
        hosted_invoice_url: null,
      },
      replyBody,
      { firstName: "James" },
    );
    expect(simple.body).toContain("Hi James,");
    expect(simple.body).not.toContain("Stripe Different Name");
    expect(simple.payment_link).toBeNull();
    expect(() =>
      policy.renderPaymentReminder(c, replyBody, { firstName: "" }),
    ).toThrow("CRM first name");
    expect(() =>
      policy.renderPaymentReminder(
        { ...c, hosted_invoice_url: null },
        "Check {{payment_link}}",
        {},
      ),
    ).toThrow("payment link");
    expect(
      policy.renderPaymentReminder(
        c,
        "Invoice {{invoice_reference}}: {{payment_link}}",
        {},
      ).body,
    ).toBe("Invoice CBB-2026-001: https://invoice.stripe.com/i/abc");
  });
  it("selects only a single bound unpaid case for a contact-triggered reminder", () => {
    expect(policy.singleBoundPaymentCase([c], c.contact_id).case_id).toBe(c.id);
    expect(
      policy.singleBoundPaymentCase(
        [c, { ...c, id: "second-merchant-invoice" }],
        c.contact_id,
      ).eligible,
    ).toBe(false);
    expect(
      policy.singleBoundPaymentCase([{ ...c, state: "unknown" }], c.contact_id)
        .eligible,
    ).toBe(false);
    expect(
      policy.singleBoundPaymentCase([{ ...c, state: "paid" }], c.contact_id)
        .eligible,
    ).toBe(false);
    expect(
      policy.singleBoundPaymentCase(
        [c, { ...c, id: "other-person", contact_id: "other" }],
        c.contact_id,
      ).case_id,
    ).toBe(c.id);
  });
  it("requires explicit approved rule/template configuration", () => {
    expect(policy.paymentRules(rules)).toEqual(rules);
    for (const altered of [
      { ...rules, enabled: false },
      { ...rules, approved_by: "" },
      { ...rules, location_id: "other" },
      { ...rules, steps: [rules.steps[0], rules.steps[0]] },
      {
        ...rules,
        steps: [{ ...rules.steps[0], template_id: "" }, rules.steps[1]],
      },
    ])
      expect(() => policy.paymentRules(altered)).toThrow();
  });
  it("permits a due first reminder only with fresh paid-source/contact/permission checks", () => {
    expect(
      policy.reminderEligibility(c, [], rules, "first", now).eligible,
    ).toBe(true);
    for (const altered of [
      { ...c, contact_id: null },
      { ...c, whatsapp_opt_in: false },
      { ...c, source_verified_at: "2026-11-04T12:00:00Z" },
      { ...c, hosted_invoice_url: "https://example.com/pay" },
    ])
      expect(
        policy.reminderEligibility(altered, [], rules, "first", now).eligible,
      ).toBe(false);
  });
  it.each(["paid", "void", "uncollectible", "paused", "cancelled", "unknown"])(
    "never reminds a %s invoice",
    (state) =>
      expect(
        policy.reminderEligibility({ ...c, state }, [], rules, "first", now)
          .eligible,
      ).toBe(false),
  );
  it.each(["manual_pause", "reply_needs_human", "contact_dnd"])(
    "stops on %s",
    (key) =>
      expect(
        policy.reminderEligibility(
          { ...c, [key]: true },
          [],
          rules,
          "first",
          now,
        ).eligible,
      ).toBe(false),
  );
  it("blocks duplicates, unknown/failed delivery and skipped prior steps", () => {
    const attempt = {
      id: "attempt-id",
      step_key: "first",
      state: "sent",
      provider_message_id: "message-id",
      created_at: "2026-11-02T09:00:00Z",
      receipt_verified: true,
      verified_sent_at: "2026-11-02T09:00:00Z",
    };
    expect(
      policy.reminderEligibility(c, [attempt], rules, "first", now).eligible,
    ).toBe(false);
    expect(
      policy.reminderEligibility(c, [], rules, "second", now).eligible,
    ).toBe(false);
    expect(
      policy.reminderEligibility(c, [attempt], rules, "second", now).eligible,
    ).toBe(true);
    for (const state of ["reserved", "requested", "failed", "unknown"])
      expect(
        policy.reminderEligibility(
          c,
          [{ ...attempt, state }],
          rules,
          "second",
          now,
        ).eligible,
      ).toBe(false);
  });
  it("uses London DST and agreed sending hours", () => {
    const early = new Date("2026-07-01T07:30:00Z");
    expect(
      policy.reminderEligibility(
        {
          ...c,
          source_verified_at: early.toISOString(),
          first_failed_at: "2026-06-01T00:00:00Z",
        },
        [],
        rules,
        "first",
        early,
      ).eligible,
    ).toBe(false);
    const allowed = new Date("2026-07-01T08:30:00Z");
    expect(
      policy.reminderEligibility(
        {
          ...c,
          source_verified_at: allowed.toISOString(),
          first_failed_at: "2026-06-01T00:00:00Z",
        },
        [],
        rules,
        "first",
        allowed,
      ).eligible,
    ).toBe(true);
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

describe("verified WhatsApp receipts", () => {
  const cases = load("payment-cases"),
    body = "Hi Demo, check https://invoice.stripe.com/i/abc";
  const attempt = {
    provider_message_id: "message-id",
    contact_id: "contact-id",
    created_at: "2026-11-05T12:00:00Z",
    expires_at: "2026-11-05T12:02:00Z",
    expected_body_hash: createHash("sha256").update(body).digest("hex"),
  };
  const message = {
    id: "message-id",
    contactId: "contact-id",
    locationId: rules.location_id,
    direction: "outbound",
    messageType: "TYPE_WHATSAPP",
    status: "delivered",
    dateAdded: "2026-11-05T12:01:00Z",
    body,
  };
  it("distinguishes accepted/sent from delivery", () => {
    expect(cases.verifiedPaymentMessage(message, attempt)).toBe("delivered");
    expect(
      cases.verifiedPaymentMessage({ ...message, status: "sent" }, attempt),
    ).toBe("sent");
    expect(
      cases.verifiedPaymentMessage({ ...message, status: "pending" }, attempt),
    ).toBeNull();
  });
  it("rejects another contact, location, invoice body, message or time window", () => {
    for (const altered of [
      { ...message, contactId: "other" },
      { ...message, locationId: "other" },
      { ...message, body: body + "changed" },
      { ...message, id: "other" },
      { ...message, direction: "inbound" },
      { ...message, messageType: "TYPE_SMS" },
      { ...message, dateAdded: "2026-11-05T12:03:00Z" },
    ])
      expect(cases.verifiedPaymentMessage(altered, attempt)).toBeNull();
  });
  it("cannot grant a reminder while the send flag is off", async () =>
    expect(
      await cases.paymentReminderPreflight("not-even-read", {
        step_key: "first",
      }),
    ).toEqual({
      authorised_send: false,
      reason: "Payment reminders are disabled",
    }));
  it("does not even resolve a contact-triggered case while reminders are disabled", async () =>
    expect(
      await cases.paymentReminderPreflightForContact("contactDemo", {
        step_key: "first",
      }),
    ).toEqual({
      authorised_send: false,
      reason: "Payment reminders are disabled",
    }));
  it("refuses a CRM claim that an invoice was paid before touching data", async () =>
    await expect(
      cases.recordGhlPaymentCaseEvent({
        schema_version: 2,
        stripe_account_id: "acct_A",
        invoice_id: "in_A",
        location_id: rules.location_id,
        contact_id: "contactDemo",
        external_id: "event-id",
        event_type: "payment_succeeded",
        occurred_at: now.toISOString(),
      }),
    ).rejects.toThrow("invoice-scoped"));
});
