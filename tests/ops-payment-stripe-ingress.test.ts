import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => db }));
vi.mock("@/lib/env", () => ({ getEnv: (key: string) => process.env[key] }));
vi.mock("@/lib/ops/tasks", () => ({
  OpsError: class extends Error {
    constructor(message: string, public status = 400) { super(message); }
  },
  record: (input: unknown) => {
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new Error("JSON object required");
    return input as Record<string, unknown>;
  },
  uuid: (input: string) => input,
}));

import { receiveStripePaymentEvent } from "../lib/ops/payment-cases";
import { readStripePaymentSnapshot, type StripePaymentAccount } from "../lib/ops/payment-stripe";

const now = new Date("2026-11-06T12:00:00Z");
const accounts: Record<string, StripePaymentAccount> = {
  first: { alias: "first", account_id: "acct_FixtureA", api_key: "fixture-key-a", webhook_secret: "fixture-secret-a", livemode: false },
  second: { alias: "second", account_id: "acct_FixtureB", api_key: "fixture-key-b", webhook_secret: "fixture-secret-b", livemode: false },
};
const invoice = (extra: Record<string, unknown> = {}) => ({
  id: "in_FixtureSame", object: "invoice", livemode: false, status: "open",
  amount_remaining: 10000, currency: "gbp", customer: "cus_Fixture",
  ...extra,
});
const subscription = (extra: Record<string, unknown> = {}) => ({
  id: "sub_Fixture", object: "subscription", livemode: false,
  status: "active", pause_collection: null, ...extra,
});
function signedEvent(account: StripePaymentAccount, extra: Record<string, unknown> = {}) {
  const raw = JSON.stringify({
    id: "evt_FixtureSame", type: "invoice.payment_failed", livemode: false,
    created: Math.floor(now.getTime() / 1000),
    data: { object: { id: "in_FixtureSame", object: "invoice" } }, ...extra,
  });
  const time = Math.floor(Date.now() / 1000);
  const digest = createHmac("sha256", account.webhook_secret).update(`${time}.${raw}`).digest("hex");
  return { raw, signature: `t=${time},v1=${digest}` };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  vi.stubEnv("OPS_STRIPE_PAYMENT_ACCOUNTS_JSON", JSON.stringify(accounts));
  db.rpc.mockReset().mockResolvedValue({ data: { duplicate: false }, error: null });
  db.from.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("signed invoice intake", () => {
  it("keeps identical invoice and event IDs separate across both merchants", async () => {
    const request = vi.fn(async (url: string, init?: RequestInit) => {
      const account = Object.values(accounts).find(a => (init?.headers as Record<string, string>).Authorization === `Bearer ${a.api_key}`)!;
      return Response.json(url.endsWith("/account") ? { id: account.account_id } : invoice());
    });
    vi.stubGlobal("fetch", request);
    for (const account of Object.values(accounts)) {
      const event = signedEvent(account);
      await receiveStripePaymentEvent(account.alias, event.raw, event.signature);
    }
    const snapshots = db.rpc.mock.calls.map(call => call[1]);
    expect(snapshots.map(s => s.p_snapshot.stripe_account_id)).toEqual(["acct_FixtureA", "acct_FixtureB"]);
    expect(snapshots.map(s => s.p_external)).toEqual([
      "acct_FixtureA:evt_FixtureSame:in_FixtureSame",
      "acct_FixtureB:evt_FixtureSame:in_FixtureSame",
    ]);
    expect(snapshots.every(s => s.p_snapshot.contact_id === undefined)).toBe(true);
    expect(request).toHaveBeenCalledTimes(4);
  });

  it("uses current paid status for a late failure and the same ledger key for a replay", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => Response.json(
      url.endsWith("/account") ? { id: "acct_FixtureA" } : invoice({ status: "paid", amount_remaining: 0 }),
    )));
    const event = signedEvent(accounts.first, { created: Math.floor(now.getTime() / 1000) - 86400 });
    await receiveStripePaymentEvent("first", event.raw, event.signature);
    await receiveStripePaymentEvent("first", event.raw, event.signature);
    expect(db.rpc.mock.calls.map(call => call[1].p_snapshot.state)).toEqual(["paid", "paid"]);
    expect(db.rpc.mock.calls[0][1].p_external).toBe(db.rpc.mock.calls[1][1].p_external);
    expect(db.rpc.mock.calls[0][1].p_occurred).toBe("2026-11-05T12:00:00.000Z");
  });

  it("rejects another merchant signature, explicit account or live/test mode before provider reads", async () => {
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    const wrongSecret = signedEvent(accounts.second);
    await expect(receiveStripePaymentEvent("first", wrongSecret.raw, wrongSecret.signature)).rejects.toThrow("Unauthorized");
    for (const fields of [{ account: "acct_FixtureB" }, { livemode: true }]) {
      const event = signedEvent(accounts.first, fields);
      await expect(receiveStripePaymentEvent("first", event.raw, event.signature)).rejects.toThrow("identity or mode");
    }
    expect(request).not.toHaveBeenCalled();
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("does not save or infer an invoice when authoritative Stripe readback fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.endsWith("/account")
      ? Response.json({ id: "acct_FixtureA" })
      : new Response("Unavailable", { status: 503 })));
    const event = signedEvent(accounts.first);
    await expect(receiveStripePaymentEvent("first", event.raw, event.signature)).rejects.toThrow("follow-up is blocked");
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it.each(Object.values(accounts))("limits subscription refresh to that merchant's stored invoices: $alias", async account => {
    const query = {
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), neq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [{ invoice_id: "in_FixtureSame" }], error: null }),
    };
    db.from.mockReturnValue(query);
    vi.stubGlobal("fetch", vi.fn(async (url: string) => Response.json(url.endsWith("/account")
      ? { id: account.account_id }
      : url.includes("/invoices/") ? invoice({ subscription: "sub_Fixture" })
        : subscription({ status: "paused" }))));
    const event = signedEvent(account, {
      type: "customer.subscription.updated",
      data: { object: { id: "sub_Fixture", object: "subscription" } },
    });
    await receiveStripePaymentEvent(account.alias, event.raw, event.signature);
    expect(query.eq.mock.calls).toEqual([
      ["stripe_account_id", account.account_id], ["subscription_id", "sub_Fixture"],
    ]);
    expect(query.neq).toHaveBeenCalledWith("state", "paid");
    expect(query.limit).toHaveBeenCalledWith(101);
    expect(db.rpc).toHaveBeenCalledWith("ops_record_payment_snapshot", expect.objectContaining({
      p_snapshot: expect.objectContaining({ stripe_account_id: account.account_id, state: "paused" }),
    }));
  });

  it("holds an oversized subscription backlog before partial provider reads or saves", async () => {
    const query = {
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), neq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: Array.from({ length: 101 }, (_, i) => ({ invoice_id: `in_Fixture${i}` })), error: null }),
    };
    db.from.mockReturnValue(query);
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    const event = signedEvent(accounts.first, {
      type: "customer.subscription.updated",
      data: { object: { id: "sub_Fixture", object: "subscription" } },
    });
    await expect(receiveStripePaymentEvent("first", event.raw, event.signature)).rejects.toThrow("reconcile the backlog");
    expect(request).not.toHaveBeenCalled();
    expect(db.rpc).not.toHaveBeenCalled();
  });
});

describe("authoritative snapshot freshness and subscription identity", () => {
  it("does not mark an older slow snapshot as newer just because its subscription finishes last", async () => {
    let releaseOldSubscription!: (value: Response) => void;
    let markOldSubscriptionRequested!: () => void;
    const oldSubscriptionRequested = new Promise<void>(resolve => { markOldSubscriptionRequested = resolve; });
    const oldRequest = vi.fn(async (url: string) => {
      if (url.endsWith("/account")) return Response.json({ id: "acct_FixtureA" });
      if (url.includes("/invoices/")) return Response.json(invoice({ subscription: "sub_Fixture" }));
      markOldSubscriptionRequested();
      return new Promise<Response>(resolve => { releaseOldSubscription = resolve; });
    });
    const oldRead = readStripePaymentSnapshot(accounts.first, "in_FixtureSame", oldRequest as typeof fetch);
    await oldSubscriptionRequested;
    vi.setSystemTime(new Date(now.getTime() + 1000));
    const newerRequest = vi.fn(async (url: string) => Response.json(url.endsWith("/account")
      ? { id: "acct_FixtureA" }
      : invoice({ status: "void" })));
    const newerRead = await readStripePaymentSnapshot(accounts.first, "in_FixtureSame", newerRequest as typeof fetch);
    vi.setSystemTime(new Date(now.getTime() + 10000));
    releaseOldSubscription(Response.json(subscription()));
    const olderRead = await oldRead;
    expect(olderRead.source_verified_at).toBe(now.toISOString());
    expect(newerRead.source_verified_at).toBe("2026-11-06T12:00:01.000Z");
    expect(olderRead.source_verified_at < newerRead.source_verified_at).toBe(true);
  });

  it.each([
    [{ id: "sub_Other" }, "identity or mode"],
    [{ object: "customer" }, "identity or mode"],
    [{ livemode: true }, "identity or mode"],
    [{ status: undefined }, "state is unavailable"],
    [{ status: "unexpected" }, "state is unavailable"],
  ])("blocks unverified subscription data: %j", async (extra, message) => {
    const request = vi.fn(async (url: string) => Response.json(url.endsWith("/account")
      ? { id: "acct_FixtureA" }
      : url.includes("/invoices/")
        ? invoice({ parent: { subscription_details: { subscription: "sub_Fixture" } } })
        : subscription(extra)));
    await expect(readStripePaymentSnapshot(accounts.first, "in_FixtureSame", request as typeof fetch)).rejects.toThrow(message);
  });

  it.each([
    ["paid", null, "paid"], ["void", null, "void"], ["uncollectible", null, "uncollectible"],
    ["open", { status: "paused" }, "paused"],
    ["open", { status: "active", pause_collection: { behavior: "void" } }, "paused"],
    ["open", { status: "canceled" }, "cancelled"],
    ["open", { status: "incomplete_expired" }, "cancelled"],
  ])("preserves closed/held state %s / %j", async (invoiceState, sub, expected) => {
    const request = vi.fn(async (url: string) => Response.json(url.endsWith("/account")
      ? { id: "acct_FixtureA" }
      : url.includes("/invoices/")
        ? invoice({ status: invoiceState, amount_remaining: invoiceState === "paid" ? 0 : 10000, subscription: "sub_Fixture" })
        : subscription(sub || {})));
    const result = await readStripePaymentSnapshot(accounts.first, "in_FixtureSame", request as typeof fetch);
    expect(result.state).toBe(expected);
    expect(request).toHaveBeenCalledTimes(sub ? 3 : 2);
  });
});
