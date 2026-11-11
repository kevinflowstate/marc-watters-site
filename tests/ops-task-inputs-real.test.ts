import { describe, expect, it, vi } from "vitest";

// The real task validator runs; only the database call is replaced.
const rpc = vi.fn(async (_name: string, args: { p_data: Record<string, unknown> }) => ({ data: { id: "t", kind: "task", status: "open", ...args.p_data }, error: null }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }));
vi.mock("@/lib/ops/notify", () => ({ notifyOpsAdmins: vi.fn() }));
vi.mock("@/lib/ops/onboarding", () => ({ startOnboarding: vi.fn() }));

import { checkScheduledJobs, reportFileProblems, reportStepFailure } from "@/lib/ops/job-health";
import { onboardFromPayment } from "@/lib/ops/stripe-new-client";

describe("automated tasks pass the real task checks", () => {
  it("job health tasks are accepted", async () => {
    const r = await checkScheduledJobs(new Date("2026-11-10T19:00:00Z"), { results: async () => [] });
    expect(r.raised).toHaveLength(2);
    await reportFileProblems([{ trusted: true, name: "x.json", reason: "bad" }], new Date("2026-11-10T12:00:00Z"));
    expect(rpc).toHaveBeenCalledTimes(3);
    for (const call of rpc.mock.calls) expect(call[1].p_data).toMatchObject({ assignee: "flowstate", source: "system" });
  });

  it("a broken-step task is accepted (failures there are swallowed, so check the call happened)", async () => {
    rpc.mockClear();
    await reportStepFailure("portal-snapshot", "boom", new Date("2026-11-10T12:00:00Z"));
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("the new-client task is accepted", async () => {
    rpc.mockClear();
    const account = { alias: "mrw", account_id: "acct_1", api_key: "k", webhook_secret: "s", livemode: true, label: "MRW" };
    const r = await onboardFromPayment(
      account,
      "checkout.session.completed",
      { object: "checkout.session", id: "cs_1", payment_status: "paid", mode: "payment", amount_total: 1000, currency: "gbp", customer_details: { email: "a@b.com", name: "A" } },
      { findClient: async () => null },
    );
    expect(r.action).toBe("setup_task");
    expect(rpc.mock.calls[0][1].p_data).toMatchObject({ assignee: "eimear", source: "system", area: "onboarding" });
  });
});
