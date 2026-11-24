import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { signPaymentRun } from "@/lib/ops/payment-run";
import { reserveNativeReminder } from "@/lib/ops/payment-preflight";
const f = vi.hoisted(() => ({
  rpc: vi.fn(),
  load: vi.fn(),
  contact: vi.fn(),
  stripe: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const q = { select: () => q, eq: () => q, maybeSingle: f.load };
      return q;
    },
    rpc: f.rpc,
  }),
}));
vi.mock("@/lib/ops/ghl-workflow", async (load) => ({
  ...(await load<typeof import("@/lib/ops/ghl-workflow")>()),
  getGhlContact: f.contact,
}));
vi.mock("@/lib/ops/payment-stripe", async (load) => ({
  ...(await load<typeof import("@/lib/ops/payment-stripe")>()),
  readStripePaymentSnapshot: f.stripe,
}));
const run = {
  contact_id: "contactFixture11",
  case_id: "b64f57f6-c2ad-40d0-9362-9b9e418f0130",
  invoice_id: "in_Test",
  stripe_account_id: "acct_Test",
};
const c = {
  ...run,
  state: "unpaid",
  whatsapp_opt_in: true,
  updated_at: "2026-11-24T09:00:00Z",
  stripe_customer_id: "cus_Test",
  first_failed_at: "2026-11-18T00:00:00Z",
};
const snapshot = {
  state: "unpaid",
  stripe_customer_id: "cus_Test",
  source_verified_at: "2026-11-24T10:00:00Z",
};
const preflight = () =>
  reserveNativeReminder({
    contact_id: run.contact_id,
    run_context: signPaymentRun(run),
    step: "first",
  });
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-24T10:00:01Z"));
  vi.clearAllMocks();
  vi.stubEnv("OPS_PAYMENT_REMINDERS_ENABLED", "true");
  vi.stubEnv("OPS_PAYMENT_WORKFLOW_SECRET", "fixture");
  vi.stubEnv(
    "OPS_STRIPE_PAYMENT_ACCOUNTS_JSON",
    JSON.stringify({
      mrw: {
        account_id: "acct_Test",
        api_key: "fake",
        webhook_secret: "fake",
        livemode: false,
      },
    }),
  );
  f.load.mockResolvedValue({ data: c });
  f.contact.mockResolvedValue({ dnd: false });
  f.stripe.mockResolvedValue(snapshot);
  f.rpc.mockResolvedValue({ data: true });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
describe("fresh eligibility before native send", () => {
  it("reserves once after live-source checks using original merchant/recipient and case revision", async () => {
    expect(await preflight()).toEqual({ allow_send: true });
    expect(f.rpc).toHaveBeenCalledWith(
      "ops_reserve_native_reminder",
      expect.objectContaining({
        p_account: run.stripe_account_id,
        p_contact: run.contact_id,
        p_invoice: run.invoice_id,
        p_case: run.case_id,
        p_expected: c.updated_at,
        p_observed: snapshot.source_verified_at,
        p_step: "first",
      }),
    );
    f.rpc.mockResolvedValue({ data: false });
    expect(await preflight()).toEqual({ allow_send: false });
  });
  it("exits on changed recipient, payment settlement, a human hold, missing recorded consent or opt-out", async () => {
    for (const details of [
      { stripe_customer_id: "cus_Other" },
      { state: "paid" },
    ]) {
      f.stripe.mockResolvedValue({ ...snapshot, ...details });
      expect(await preflight()).toEqual({ allow_send: false });
    }
    f.stripe.mockResolvedValue(snapshot);
    for (const details of [
      { manual_pause: true },
      { reply_needs_human: true },
      { whatsapp_opt_in: false },
    ]) {
      f.load.mockResolvedValue({ data: { ...c, ...details } });
      expect(await preflight()).toEqual({ allow_send: false });
    }
    f.load.mockResolvedValue({ data: c });
    f.contact.mockResolvedValue({ dnd: true });
    expect(await preflight()).toEqual({ allow_send: false });
    expect(f.rpc).not.toHaveBeenCalled();
  });
});
