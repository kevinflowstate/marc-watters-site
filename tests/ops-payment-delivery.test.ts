import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  attempt: {} as Record<string, unknown>,
  payment: {} as Record<string, unknown>,
  contact: {} as Record<string, unknown>,
  snapshotState: "unpaid",
  rules: {} as Record<string, unknown>,
  claimCount: 0,
  claimed: false,
  reads: 0,
  providerReads: 0,
  receipt: vi.fn(),
}));
vi.mock("@/lib/env", () => ({ getEnv: (key: string) => key === "OPS_PAYMENT_RULES_JSON" ? JSON.stringify(fixture.rules) : process.env[key] }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      fixture.reads++;
      let hash: unknown;
      const query = { select: () => query, eq: (_key: string, value: unknown) => { hash = value; return query; },
        maybeSingle: async () => ({ data: hash === fixture.attempt.context_token_hash ? { ...fixture.attempt } : null, error: null }) };
      return query;
    },
    rpc: async (name: string) => {
      if (name !== "ops_claim_payment_dispatch") throw Error("Unexpected database write");
      fixture.claimCount++;
      if (fixture.claimed) return { data: { authorised_send: false, reason: "Already claimed" }, error: null };
      fixture.claimed = true;
      return { data: { authorised_send: true }, error: null };
    },
  }),
}));
vi.mock("@/lib/ops/payment-cases", async (original) => {
  const actual = await original<typeof import("../lib/ops/payment-cases")>();
  return {
    ...actual,
    getPaymentCase: async () => ({ payment_case: { ...fixture.payment }, attempts: [{ ...fixture.attempt }], events: [] }),
    readGhlPaymentContact: async () => { fixture.providerReads++; return fixture.contact; },
    savePaymentSnapshot: async (snapshot: Record<string, unknown>) => { Object.assign(fixture.payment, snapshot); },
    recordGhlPaymentCaseEvent: fixture.receipt,
  };
});
vi.mock("@/lib/ops/payment-stripe", () => ({
  stripePaymentAccountById: (id: string) => ({ account_id: id }),
  readStripePaymentSnapshot: async () => {
    fixture.providerReads++;
    return { state: fixture.snapshotState, source_verified_at: new Date().toISOString() };
  },
}));
import { claimPaymentDelivery, recordPaymentDeliveryReceipt } from "../lib/ops/payment-delivery";

const contextToken = "a".repeat(64);
const contextHash = createHash("sha256").update(contextToken).digest("hex");
const context = { context_token: contextToken, workflow_run_id: "workflow-fixture-0001" };
const body = "Hi James, please reply about your payment.";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-06T09:01:00Z"));
  vi.stubEnv("OPS_PAYMENT_REMINDERS_ENABLED", "true");
  vi.stubGlobal("fetch", vi.fn(() => { throw Error("A payment test must never send or make a live request"); }));
  fixture.attempt = {
    id: "00000000-0000-4000-8000-000000000001", case_id: "00000000-0000-4000-8000-000000000002",
    step_key: "first", workflow_run_id: context.workflow_run_id, context_token_hash: contextHash,
    contact_id: "contactFixture0001", location_id: "93GJEdsr0cT9el3OINXq", template_id: "approved-fixture",
    rules_revision: "fixture-v1", expected_body_hash: createHash("sha256").update(body).digest("hex"),
    state: "reserved", created_at: "2026-11-06T09:00:00Z", expires_at: "2026-11-06T09:02:00Z",
    dispatch_claimed_at: null, receipt_verified: false, verified_sent_at: null,
  };
  fixture.payment = {
    id: fixture.attempt.case_id, stripe_account_id: "acct_fixture", invoice_id: "in_fixture",
    state: "unpaid", contact_id: fixture.attempt.contact_id, whatsapp_opt_in: true,
    manual_pause: false, reply_needs_human: false, contact_dnd: false,
    first_failed_at: "2026-11-05T12:00:00Z", source_verified_at: "2026-11-06T09:00:00Z",
    updated_at: "2026-11-06T09:00:00Z", hosted_invoice_url: null,
  };
  fixture.rules = {
    enabled: true, revision: "fixture-v1", approved_by: "Synthetic admin", approved_at: "2026-11-05",
    location_id: "93GJEdsr0cT9el3OINXq", timezone: "Europe/London", max_reminders: 2,
    allowed_local_hours: { start: 9, end: 10 },
    timing: { first: "next_working_day", followup_calendar_days: 3, local_hour: 9 },
    steps: [
      { key: "first", template_id: "approved-fixture", body_template: "Hi {{first_name}}, please reply about your payment." },
      { key: "second", template_id: "approved-second", body_template: "Please reply about your payment." },
    ],
  };
  fixture.contact = { firstName: "James", dnd: false };
  fixture.snapshotState = "unpaid";
  fixture.claimCount = 0; fixture.claimed = false; fixture.reads = 0; fixture.providerReads = 0;
  fixture.receipt.mockReset(); fixture.receipt.mockResolvedValue({ received: true });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("invoice-bound native reminder handoff", () => {
  it("does no source or database work while sending is paused", async () => {
    vi.stubEnv("OPS_PAYMENT_REMINDERS_ENABLED", "false");
    expect(await claimPaymentDelivery(context)).toMatchObject({ authorised_send: false });
    expect(fixture.reads + fixture.providerReads + fixture.claimCount).toBe(0);
  });
  it.each([
    { ...context, context_token: "b".repeat(64) },
    { ...context, workflow_run_id: "another-workflow-run" },
    { ...context, contact_id: "injectedContact" },
    { ...context, case_id: "injectedCase" },
  ])("rejects altered or caller-supplied invoice context", async (input) => {
    await expect(claimPaymentDelivery(input)).rejects.toThrow();
    expect(fixture.claimCount).toBe(0);
  });
  it("rechecks a payment settled since reservation and blocks the native action", async () => {
    fixture.snapshotState = "paid";
    expect(await claimPaymentDelivery(context)).toMatchObject({ authorised_send: false, reason: "Invoice is not confirmed unpaid" });
    expect(fixture.claimCount).toBe(0);
  });
  it.each(["manual_pause", "reply_needs_human", "contact_dnd"])("stops on a new %s", async (flag) => {
    fixture.payment[flag] = true;
    expect(await claimPaymentDelivery(context)).toMatchObject({ authorised_send: false });
    expect(fixture.claimCount).toBe(0);
  });
  it("holds changed names, templates, rule revisions and current DND", async () => {
    fixture.contact.firstName = "Someone else";
    expect(await claimPaymentDelivery(context)).toMatchObject({ authorised_send: false });
    fixture.contact.firstName = "James";
    fixture.rules.revision = "changed";
    expect(await claimPaymentDelivery(context)).toMatchObject({ authorised_send: false });
    fixture.rules.revision = "fixture-v1";
    fixture.contact.dnd = true;
    expect(await claimPaymentDelivery(context)).toMatchObject({ authorised_send: false });
    expect(fixture.claimCount).toBe(0);
  });
  it("never reissues an expired or already-dispatched permission", async () => {
    fixture.attempt.expires_at = "2026-11-06T09:00:30Z";
    expect(await claimPaymentDelivery(context)).toMatchObject({ authorised_send: false });
    fixture.attempt.expires_at = "2026-11-06T09:02:00Z";
    fixture.attempt.dispatch_claimed_at = "2026-11-06T09:00:30Z";
    expect(await claimPaymentDelivery(context)).toMatchObject({ authorised_send: false });
    expect(fixture.providerReads).toBe(0);
  });
  it("returns the exact saved destination/body once under competing requests and never sends", async () => {
    const results = await Promise.all([claimPaymentDelivery(context), claimPaymentDelivery(context)]);
    expect(results.filter((result) => result.authorised_send)).toHaveLength(1);
    expect(results.find((result) => result.authorised_send)).toMatchObject({
      contact_id: fixture.attempt.contact_id, template_id: "approved-fixture", rendered_body: body,
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("workflow receipt context", () => {
  const receipt = () => ({ ...context, event_id: "native-status-1", event_type: "reminder_sent",
    occurred_at: "2026-11-06T09:01:00Z", provider_message_id: "messageFixture0001" });
  it("rejects a receipt before the sender grant", async () => {
    await expect(recordPaymentDeliveryReceipt(receipt())).rejects.toThrow("not been handed");
    expect(fixture.receipt).not.toHaveBeenCalled();
  });
  it("reconstructs all invoice identities from the saved run, including while sending is paused", async () => {
    fixture.attempt.dispatch_claimed_at = "2026-11-06T09:00:30Z";
    vi.stubEnv("OPS_PAYMENT_REMINDERS_ENABLED", "false");
    await recordPaymentDeliveryReceipt(receipt());
    expect(fixture.receipt).toHaveBeenCalledWith(expect.objectContaining({
      stripe_account_id: "acct_fixture", invoice_id: "in_fixture", attempt_id: fixture.attempt.id,
      contact_id: fixture.attempt.contact_id, external_id: `delivery:${fixture.attempt.id}:native-status-1`,
    }), { run: context.workflow_run_id, hash: contextHash });
  });
  it("rejects injected identities, future times and receipts predating this run", async () => {
    fixture.attempt.dispatch_claimed_at = "2026-11-06T09:00:30Z";
    for (const input of [
      { ...receipt(), invoice_id: "in_someoneElse" },
      { ...receipt(), occurred_at: "2027-01-01T00:00:00Z" },
      { ...receipt(), occurred_at: "2026-11-06T08:00:00Z" },
    ]) await expect(recordPaymentDeliveryReceipt(input)).rejects.toThrow();
    expect(fixture.receipt).not.toHaveBeenCalled();
  });
  it("returns the next London calendar date only after an actual verified first send", async () => {
    fixture.attempt.dispatch_claimed_at = "2026-11-06T09:00:30Z";
    fixture.receipt.mockResolvedValue({
      case: { state: "unpaid", first_failed_at: "2026-11-05T12:00:00Z", manual_pause: false, reply_needs_human: false, contact_dnd: false },
      receipt: { verified: true, state: "sent", sent_at: "2026-11-06T09:00:45Z" },
    });
    expect(await recordPaymentDeliveryReceipt(receipt())).toMatchObject({ followup_due_at: "2026-11-09T09:00:00.000Z" });
    fixture.receipt.mockResolvedValue({ case: { state: "paid" }, receipt: { verified: true, state: "sent", sent_at: "2026-11-06T09:01:00Z" } });
    expect(await recordPaymentDeliveryReceipt(receipt())).toMatchObject({ followup_due_at: null });
    fixture.receipt.mockResolvedValue({ case: { state: "unpaid" }, receipt: { verified: false, state: null, sent_at: null } });
    expect(await recordPaymentDeliveryReceipt(receipt())).toMatchObject({ followup_due_at: null });
  });
});
