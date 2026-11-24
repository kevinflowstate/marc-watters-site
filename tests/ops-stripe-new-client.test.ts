import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/ops/onboarding", () => ({ startOnboarding: vi.fn() }));
vi.mock("@/lib/ops/tasks", () => ({ createTask: vi.fn() }));
vi.mock("@/lib/ops/client-activation", () => ({ activateClient: vi.fn() }));

import { onboardFromPayment } from "@/lib/ops/stripe-new-client";

const account = { alias: "mrw", account_id: "acct_1", api_key: "k", webhook_secret: "s", livemode: true, label: "MRW Management Ltd" };
const now = new Date("2026-11-10T12:00:00Z");
const invoice = (over: Record<string, unknown> = {}) => ({
  object: "invoice", id: "in_new", customer: "cus_1", customer_email: "New@Client.com", customer_name: "Pat Builder",
  amount_paid: 150000, currency: "gbp", created: 1762700000, ...over,
});
const checkout = (over: Record<string, unknown> = {}) => ({
  object: "checkout.session", id: "cs_1", payment_status: "paid", mode: "payment", amount_total: 99700, currency: "gbp",
  customer_details: { email: "pay@link.com", name: "Sam Joiner" }, ...over,
});
type Stripe = { invoices?: { id: string; amount_paid: number }[] | number; charges?: Record<string, unknown>[] | number };
const deps = (client: unknown, history: { id: string; amount_paid: number }[] = [], stripe: Stripe = {}, activation: unknown = created()) => {
  const start = vi.fn(async (..._a: unknown[]) => ({}));
  const raiseTask = vi.fn(async (..._a: unknown[]) => ({}) as never);
  const activate = vi.fn(async (..._a: unknown[]) => activation as never);
  const reply = (v: unknown) => (typeof v === "number" ? new Response("{}", { status: v }) : Response.json({ data: v }));
  const fetch = vi.fn(async (url: unknown) =>
    String(url).includes("/charges") ? reply(stripe.charges ?? []) : reply(stripe.invoices ?? history),
  );
  return { start, raiseTask, activate, fetch: fetch as unknown as typeof globalThis.fetch, findClient: vi.fn(async () => client as never), now, fetchMock: fetch };
};
function created(over: Record<string, unknown> = {}) {
  return { status: "created", userId: "u1", profileId: "p1", emailSent: true, setupUrl: null, ...over };
}
const detail = (d: ReturnType<typeof deps>) => String((d.raiseTask.mock.calls[0][0] as Record<string, unknown>).detail);

describe("new client from a Stripe payment", () => {
  it("leaves a cash or bank-transfer client in their existing contract flow when Stripe later reports an instalment", async () => {
    const d = deps(null);
    d.findClient.mockResolvedValue("manual_intake" as never);
    expect(await onboardFromPayment(account, "invoice.paid", invoice(), d)).toEqual({action:"manual_intake_in_progress"});
    expect(d.activate).not.toHaveBeenCalled();
    expect(d.start).not.toHaveBeenCalled();
    expect(d.raiseTask).not.toHaveBeenCalled();
  });
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

  it("adds a first-time invoice payer to the portal and starts their checklist", async () => {
    const d = deps(null);
    expect(await onboardFromPayment(account, "invoice.paid", invoice(), d)).toEqual({
      action: "client_added", client_id: "p1", email_sent: true, checklist_started: true,
    });
    expect(d.activate).toHaveBeenCalledWith("Pat Builder", "new@client.com");
    expect(d.start).toHaveBeenCalledWith("p1");
    expect(d.raiseTask).not.toHaveBeenCalled();
    const charges = d.fetchMock.mock.calls.map((c) => String(c[0])).find((u) => u.includes("/charges"));
    expect(charges).toContain("customer=cus_1");
    expect(charges).toContain("created%5Blt%5D=1762700000");
  });

  it("does not add someone who paid before by payment link", async () => {
    const d = deps(null, [], { charges: [{ status: "succeeded", paid: true, amount: 99700 }] });
    expect(await onboardFromPayment(account, "invoice.paid", invoice(), d)).toEqual({ action: "existing_customer" });
    expect(d.activate).not.toHaveBeenCalled();
    expect(d.raiseTask).not.toHaveBeenCalled();
  });

  it("falls back to Eimear's task when Stripe cannot confirm the history", async () => {
    for (const stripe of [{ invoices: 500 }, { charges: 403 }] as Stripe[]) {
      const d = deps(null, [], stripe);
      expect(await onboardFromPayment(account, "invoice.paid", invoice(), d)).toEqual({ action: "setup_task" });
      expect(d.activate).not.toHaveBeenCalled();
      expect(detail(d)).toContain("could not confirm");
    }
  });

  it("never adds a payer from a payment link, an archived client or an invoice with no name", async () => {
    const link = deps(null);
    await onboardFromPayment(account, "checkout.session.completed", checkout(), link);
    const archived = deps({ id: "c1", onboarding_stage: "none", archived_at: "2026-10-01T00:00:00Z", created_at: "2026-01-01T00:00:00Z" });
    expect(await onboardFromPayment(account, "invoice.paid", invoice(), archived)).toEqual({ action: "setup_task" });
    expect(detail(archived)).toContain("archived");
    const nameless = deps(null);
    expect(await onboardFromPayment(account, "invoice.paid", invoice({ customer_name: "" }), nameless)).toEqual({ action: "setup_task" });
    expect(detail(nameless)).toContain("no customer name");
    for (const d of [link, archived, nameless]) expect(d.activate).not.toHaveBeenCalled();
  });

  it("tells Eimear when an account already exists or adding stops part-way", async () => {
    const exists = deps(null, [], {}, { status: "exists" });
    expect(await onboardFromPayment(account, "invoice.paid", invoice(), exists)).toEqual({ action: "setup_task" });
    expect(detail(exists)).toContain("already exists");
    const partial = deps(null, [], {}, { status: "failed", error: "profile missing", userId: "u1" });
    await onboardFromPayment(account, "invoice.paid", invoice(), partial);
    expect(detail(partial)).toContain("part-way");
  });

  it("asks Eimear to check when the welcome email or checklist fails, without undoing the account", async () => {
    const d = deps(null, [], {}, created({ emailSent: false }));
    d.start.mockRejectedValueOnce(new Error("rpc down"));
    expect(await onboardFromPayment(account, "invoice.paid", invoice(), d)).toEqual({
      action: "client_added", client_id: "p1", email_sent: false, checklist_started: false,
    });
    const task = d.raiseTask.mock.calls[0][0] as Record<string, unknown>;
    expect(task.title).toBe("New client added · Pat Builder · needs a check");
    expect(String(task.detail)).toContain("welcome email did NOT send");
    expect(String(task.detail)).toContain("checklist did not start");
  });
});
