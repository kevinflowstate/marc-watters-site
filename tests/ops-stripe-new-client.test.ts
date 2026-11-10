import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/ops/onboarding", () => ({ startOnboarding: vi.fn() }));
vi.mock("@/lib/ops/tasks", () => ({ createTask: vi.fn() }));

import { onboardFromPayment } from "@/lib/ops/stripe-new-client";

const account = { alias: "mrw", account_id: "acct_1", api_key: "k", webhook_secret: "s", livemode: true, label: "MRW Management Ltd" };
const now = new Date("2026-11-10T12:00:00Z");
const invoice = (over: Record<string, unknown> = {}) => ({
  object: "invoice", id: "in_new", customer: "cus_1", customer_email: "New@Client.com", customer_name: "Pat Builder",
  amount_paid: 150000, currency: "gbp", ...over,
});
const checkout = (over: Record<string, unknown> = {}) => ({
  object: "checkout.session", id: "cs_1", payment_status: "paid", mode: "payment", amount_total: 99700, currency: "gbp",
  customer_details: { email: "pay@link.com", name: "Sam Joiner" }, ...over,
});
const deps = (client: unknown, history: { id: string; amount_paid: number }[] = []) => {
  const start = vi.fn(async (..._a: unknown[]) => ({}));
  const raiseTask = vi.fn(async (..._a: unknown[]) => ({}) as never);
  const fetch = vi.fn(async (..._a: unknown[]) => Response.json({ data: history }));
  return { start, raiseTask, fetch: fetch as unknown as typeof globalThis.fetch, findClient: vi.fn(async () => client as never), now, fetchMock: fetch };
};

describe("new client from a Stripe payment", () => {
  it("starts the checklist for a client added in the last 30 days", async () => {
    const d = deps({ id: "c1", onboarding_stage: "none", archived_at: null, created_at: "2026-11-01T00:00:00Z" });
    expect(await onboardFromPayment(account, "invoice.paid", invoice(), d)).toMatchObject({ action: "checklist_started" });
    expect(d.findClient).toHaveBeenCalledWith("new@client.com");
    expect(d.start).toHaveBeenCalledWith("c1");
    expect(d.raiseTask).not.toHaveBeenCalled();
  });

  it("does nothing for an older client paying again", async () => {
    const d = deps({ id: "c1", onboarding_stage: "none", archived_at: null, created_at: "2026-08-01T00:00:00Z" });
    expect(await onboardFromPayment(account, "checkout.session.completed", checkout(), d)).toEqual({ action: "existing_client" });
    expect(d.start).not.toHaveBeenCalled();
    expect(d.raiseTask).not.toHaveBeenCalled();
  });

  it("gives Eimear one task when a payment link payer is not in the portal", async () => {
    const d = deps(null);
    expect(await onboardFromPayment(account, "checkout.session.completed", checkout(), d)).toEqual({ action: "setup_task" });
    const task = d.raiseTask.mock.calls[0][0] as Record<string, unknown>;
    expect(task).toMatchObject({ assignee: "eimear", area: "onboarding", title: "New client paid · Sam Joiner" });
    expect(String(task.detail)).toContain("£997.00");
    expect(String(task.external_ref)).toMatch(/^onboarding-stripe:[a-f0-9]{32}$/);
  });

  it("skips a non-portal customer whose earlier invoice was already paid", async () => {
    const d = deps(null, [{ id: "in_old", amount_paid: 50000 }, { id: "in_new", amount_paid: 150000 }]);
    expect(await onboardFromPayment(account, "invoice.paid", invoice(), d)).toEqual({ action: "existing_customer" });
    expect(d.raiseTask).not.toHaveBeenCalled();
  });

  it("ignores unpaid checkouts, subscription checkouts (their invoice handles it) and zero payments", async () => {
    const d = deps(null);
    expect((await onboardFromPayment(account, "checkout.session.completed", checkout({ payment_status: "unpaid" }), d)).action).toBe("ignored");
    expect((await onboardFromPayment(account, "checkout.session.completed", checkout({ mode: "subscription" }), d)).action).toBe("ignored");
    expect((await onboardFromPayment(account, "invoice.paid", invoice({ amount_paid: 0 }), d)).action).toBe("ignored");
    expect(d.findClient).not.toHaveBeenCalled();
  });

  it("strips markup from the payer's name", async () => {
    const d = deps(null);
    await onboardFromPayment(account, "checkout.session.completed", checkout({ customer_details: { email: "x@y.com", name: "<b>Eve</b>" } }), d);
    expect((d.raiseTask.mock.calls[0][0] as Record<string, unknown>).title).toBe("New client paid · bEve/b");
  });
});
