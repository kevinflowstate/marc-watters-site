import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
type Row = Record<string, unknown>;
const dbState = vi.hoisted(() => ({ payment: {} as Row, attempts: [] as Row[], reservations: 0 }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({
  from(table: string) {
    const filters: Array<(row: Row) => boolean> = [];
    const rows = () => (table === "ops_payment_cases" ? [dbState.payment] : table === "ops_payment_attempts" ? dbState.attempts : []).filter((row) => filters.every((predicate) => predicate(row)));
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { filters.push((row) => row[key] === value); return query; },
      in: (key: string, values: unknown[]) => { filters.push((row) => values.includes(row[key])); return query; },
      order: () => query, limit: () => query,
      maybeSingle: async () => ({ data: rows()[0] || null, error: null }),
      then: (resolve: (value: { data: Row[]; error: null }) => unknown) => Promise.resolve(resolve({ data: rows(), error: null })),
    };
    return query;
  },
  async rpc(name: string, args: Row) {
    if (name === "ops_record_payment_snapshot") {
      Object.assign(dbState.payment, args.p_snapshot);
      return { data: { duplicate: false, case: dbState.payment }, error: null };
    }
    if (name !== "ops_reserve_payment_delivery") throw Error("Unexpected payment write");
    dbState.reservations++;
    const attempt = {
      id: `00000000-0000-4000-8000-${String(dbState.reservations).padStart(12, "0")}`,
      case_id: args.p_case, step_key: args.p_step, template_id: args.p_template, workflow_run_id: args.p_run,
      context_token_hash: args.p_context_hash, state: "reserved", receipt_verified: false,
      dispatch_claimed_at: null, verified_sent_at: null, created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 120000).toISOString(),
    };
    dbState.attempts.push(attempt);
    const { context_token_hash: _hash, ...safeAttempt } = attempt;
    void _hash;
    return { data: { authorised_send: true, attempt: safeAttempt }, error: null };
  },
}) }));
vi.mock("@/lib/ops/payment-stripe", () => ({
  stripePaymentAccountById: () => ({ account_id: "acct_fixture" }),
  readStripePaymentSnapshot: async () => ({ ...dbState.payment, source_verified_at: new Date().toISOString() }),
}));
import { paymentReminderPreflight, paymentReminderPreflightForContact } from "../lib/ops/payment-cases";
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-06T09:01:00Z"));
  dbState.payment = { id: "00000000-0000-4000-8000-000000000099", stripe_account_id: "acct_fixture", invoice_id: "in_fixture",
    state: "unpaid", contact_id: "contactFixture0001", whatsapp_opt_in: true,
    first_failed_at: "2026-11-05T12:00:00Z", source_verified_at: new Date().toISOString(),
    updated_at: new Date().toISOString(), manual_pause: false, reply_needs_human: false, contact_dnd: false, hosted_invoice_url: null };
  dbState.attempts = []; dbState.reservations = 0;
  vi.stubEnv("OPS_PAYMENT_REMINDERS_ENABLED", "true"); vi.stubEnv("OPS_GHL_PAYMENT_TOKEN", "synthetic-read-only");
  vi.stubEnv("OPS_PAYMENT_RULES_JSON", JSON.stringify({ enabled: true, revision: "fixture-v1", approved_by: "Synthetic admin", approved_at: "2026-11-05",
    location_id: "93GJEdsr0cT9el3OINXq", timezone: "Europe/London", max_reminders: 2,
    allowed_local_hours: { start: 9, end: 10 }, timing: { first: "next_working_day", followup_calendar_days: 3, local_hour: 9 },
    steps: [{ key: "first", template_id: "template-first", body_template: "Hi {{first_name}}, reply here." },
      { key: "second", template_id: "template-second", body_template: "Hi {{first_name}}, still unpaid." }] }));
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.endsWith("/locations/93GJEdsr0cT9el3OINXq")) return Response.json({ location: { id: "93GJEdsr0cT9el3OINXq", name: "MRW Management LTD" } });
    if (url.endsWith("/contacts/contactFixture0001")) return Response.json({ contact: { id: "contactFixture0001", locationId: "93GJEdsr0cT9el3OINXq", firstName: "James", dnd: false } });
    throw Error("Only mocked read-only location/contact requests are permitted");
  }));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("native workflow first-reservation context", () => {
  it("issues its own handoff identity without requiring a native enrollment field", async () => {
    const result = await paymentReminderPreflightForContact("contactFixture0001", { step_key: "first" });
    expect(result).toMatchObject({ authorised_send: false, reserved: true });
    expect(result.context_token).toMatch(/^[a-f0-9]{64}$/);
    expect(result.workflow_run_id).toMatch(/^[a-f0-9-]{36}$/);
    expect(result.attempt).not.toHaveProperty("context_token_hash");
    expect(dbState.reservations).toBe(1);
  });
  it("holds a duplicated first preflight after a lost response; it never gives a replacement token", async () => {
    await paymentReminderPreflightForContact("contactFixture0001", { step_key: "first" });
    const retried = await paymentReminderPreflightForContact("contactFixture0001", { step_key: "first" });
    expect(retried.authorised_send).toBe(false);
    expect(retried).not.toHaveProperty("context_token");
    expect(dbState.reservations).toBe(1);
  });
  it("requires the original invoice and server-issued identity for the second step", async () => {
    const first = await paymentReminderPreflightForContact("contactFixture0001", { step_key: "first" });
    Object.assign(dbState.attempts[0], { state: "sent", dispatch_claimed_at: "2026-11-03T09:00:00Z", receipt_verified: true, verified_sent_at: "2026-11-03T09:00:00Z" });
    dbState.payment.first_failed_at = "2026-11-02T12:00:00Z";
    expect(await paymentReminderPreflightForContact("contactFixture0001", { step_key: "second", workflow_run_id: first.workflow_run_id })).toMatchObject({ authorised_send: false });
    expect(await paymentReminderPreflight(String(dbState.payment.id), { step_key: "second" })).toMatchObject({ authorised_send: false });
    expect(await paymentReminderPreflight(String(dbState.payment.id), { step_key: "second", workflow_run_id: "different-handoff-id" })).toMatchObject({ authorised_send: false });
    const followup = await paymentReminderPreflight(String(dbState.payment.id), { step_key: "second", workflow_run_id: first.workflow_run_id });
    expect(followup).toMatchObject({ reserved: true, authorised_send: false, workflow_run_id: first.workflow_run_id });
    expect(followup.context_token).not.toBe(first.context_token);
    expect(dbState.reservations).toBe(2);
  });
});
