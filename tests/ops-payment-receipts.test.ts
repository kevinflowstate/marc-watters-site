import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const receiptState = vi.hoisted(() => ({
  attempt: {} as Record<string, unknown>, message: {} as Record<string, unknown>,
  writes: [] as Record<string, unknown>[], failedRead: false,
  rpcResult: null as Record<string, unknown> | null,
}));
vi.mock("@/lib/env", () => ({ getEnv: (key: string) => key === "OPS_GHL_PAYMENT_TOKEN" ? "synthetic-read-only-token" : undefined }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({
  from: () => { const query = { select: () => query, eq: () => query,
    maybeSingle: async () => ({ data: receiptState.attempt, error: null }) }; return query; },
  rpc: async (_name: string, args: { p_event: Record<string, unknown> }) => {
    receiptState.writes.push(args.p_event);
    return { data: receiptState.rpcResult || { received: true, receipt: {
      verified: args.p_event.receipt_verified, state: args.p_event.delivery_state, sent_at: args.p_event.verified_sent_at,
    } }, error: null };
  },
}) }));
import { recordGhlPaymentCaseEvent } from "../lib/ops/payment-cases";

const now = "2026-11-06T09:01:00Z";
const context = { run: "workflow-fixture-0001", hash: "a".repeat(64) };
const event = () => ({ schema_version: 2, stripe_account_id: "acct_fixture", invoice_id: "in_fixture",
  location_id: "93GJEdsr0cT9el3OINXq", contact_id: "contactFixture0001", external_id: "receipt-fixture-event",
  event_type: "reminder_sent", occurred_at: now, attempt_id: "00000000-0000-4000-8000-000000000001",
  provider_message_id: "messageFixture0001" });
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(now));
  receiptState.writes = []; receiptState.failedRead = false; receiptState.rpcResult = null;
  receiptState.attempt = { id: event().attempt_id, case_id: "00000000-0000-4000-8000-000000000002",
    workflow_run_id: context.run, context_token_hash: context.hash, dispatch_claimed_at: "2026-11-06T09:00:30Z",
    contact_id: event().contact_id, location_id: event().location_id,
    created_at: "2026-11-06T09:00:00Z", expires_at: "2026-11-06T09:02:00Z",
    expected_body_hash: createHash("sha256").update("Hi James, reply here.").digest("hex"), provider_message_id: null };
  receiptState.message = { id: event().provider_message_id, contactId: event().contact_id,
    locationId: event().location_id, direction: "outbound", messageType: "TYPE_WHATSAPP",
    body: "Hi James, reply here.", dateAdded: "2026-11-06T09:00:45Z", status: "sent" };
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    if (init.method && init.method !== "GET") throw Error("No messaging writes allowed");
    if (receiptState.failedRead) throw Error("Synthetic provider unavailable");
    if (url.endsWith("/locations/" + event().location_id))
      return Response.json({ location: { id: event().location_id, name: "MRW Management LTD" } });
    if (url.endsWith("/conversations/messages/" + event().provider_message_id)) return Response.json(receiptState.message);
    throw Error("Unexpected provider URL");
  }));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("provider-verified payment receipts", () => {
  it("rejects legacy or altered run callbacks for a context-bound attempt", async () => {
    await expect(recordGhlPaymentCaseEvent(event())).rejects.toThrow("original workflow context");
    await expect(recordGhlPaymentCaseEvent(event(), { ...context, run: "another-run" })).rejects.toThrow("original workflow context");
    expect(fetch).not.toHaveBeenCalled(); expect(receiptState.writes).toHaveLength(0);
  });
  it("holds an unverified message ID without binding it permanently", async () => {
    receiptState.message.body = "Unrelated message";
    await recordGhlPaymentCaseEvent(event(), context);
    expect(receiptState.writes[0]).toMatchObject({ receipt_verified: false,
      provider_message_id: undefined, reported_provider_message_id: event().provider_message_id, delivery_state: null });
  });
  it("uses the actual provider status and sent time, regardless of the workflow's claim", async () => {
    receiptState.message.status = "delivered";
    await recordGhlPaymentCaseEvent(event(), context);
    expect(receiptState.writes[0]).toMatchObject({ receipt_verified: true, delivery_state: "delivered",
      provider_message_id: event().provider_message_id, verified_sent_at: "2026-11-06T09:00:45.000Z" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("records an unknown outcome when provider readback fails", async () => {
    receiptState.failedRead = true;
    await recordGhlPaymentCaseEvent(event(), context);
    expect(receiptState.writes[0]).toMatchObject({ receipt_verified: false, delivery_state: null, provider_message_id: undefined });
  });
  it("rejects a matching message created before the context's actual dispatch", async () => {
    receiptState.message.dateAdded = "2026-11-06T09:00:10Z";
    const result = await recordGhlPaymentCaseEvent(event(), context);
    expect(receiptState.writes[0]).toMatchObject({ receipt_verified: false, provider_message_id: undefined });
    expect(result.receipt.verified).toBe(false);
    receiptState.message.dateAdded = "2026-11-06T09:00:30Z";
    expect((await recordGhlPaymentCaseEvent(event(), context)).receipt.verified).toBe(true);
  });
  it("returns committed receipt truth on a replay, never an unpersisted fresh provider read", async () => {
    receiptState.rpcResult = { duplicate: true, case: { reminder_count: 0 }, receipt: { verified: false, state: null, sent_at: null } };
    expect((await recordGhlPaymentCaseEvent(event(), context)).receipt).toEqual({ verified: false, state: null, sent_at: null });
    receiptState.rpcResult = { duplicate: true, case: { reminder_count: 1 }, receipt: { verified: true, state: "delivered", sent_at: "2026-11-06T09:00:45Z" } };
    receiptState.failedRead = true;
    expect((await recordGhlPaymentCaseEvent(event(), context)).receipt).toEqual({ verified: true, state: "delivered", sent_at: "2026-11-06T09:00:45Z" });
    receiptState.rpcResult = { duplicate: true };
    expect((await recordGhlPaymentCaseEvent(event(), context)).receipt.verified).toBe(false);
  });
  it("rejects a future event before accessing provider or database writes", async () => {
    await expect(recordGhlPaymentCaseEvent({ ...event(), occurred_at: "2027-01-01T00:00:00Z" }, context)).rejects.toThrow("invoice-scoped");
    expect(fetch).not.toHaveBeenCalled(); expect(receiptState.writes).toHaveLength(0);
  });
});
