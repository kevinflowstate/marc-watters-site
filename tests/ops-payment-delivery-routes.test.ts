import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const handlers = vi.hoisted(() => ({ dispatch: vi.fn(), receipt: vi.fn() }));
vi.mock("@/lib/env", () => ({ getEnv: (key: string) => process.env[key] }));
vi.mock("@/lib/ops/payment-delivery", () => ({ claimPaymentDelivery: handlers.dispatch, recordPaymentDeliveryReceipt: handlers.receipt }));
import { POST as dispatch } from "../app/api/ops/payment-reminders/dispatch/route";
import { POST as receipt } from "../app/api/ops/payment-reminders/receipt/route";
beforeEach(() => {
  vi.stubEnv("OPS_PAYMENT_WORKFLOW_SECRET", "synthetic-workflow-secret");
  handlers.dispatch.mockReset(); handlers.receipt.mockReset();
  handlers.dispatch.mockResolvedValue({ authorised_send: false }); handlers.receipt.mockResolvedValue({ received: true });
});
afterEach(() => vi.unstubAllEnvs());
describe.each([["dispatch", dispatch, handlers.dispatch], ["receipt", receipt, handlers.receipt]] as const)("payment %s authentication", (_name, handler, mock) => {
  it("rejects missing or incorrect credentials before parsing the body", async () => {
    const result = await handler(new Request("https://preview.invalid/api", { method: "POST", headers: { "x-payment-workflow-secret": "wrong" }, body: "not JSON" }));
    expect(result.status).toBe(401); expect(mock).not.toHaveBeenCalled();
  });
  it("passes only the authenticated request body to its handler", async () => {
    const body = { workflow_run_id: "synthetic-run-0001", context_token: "a".repeat(64) };
    const result = await handler(new Request("https://preview.invalid/api", { method: "POST", headers: { "x-payment-workflow-secret": "synthetic-workflow-secret", "Content-Type": "application/json" }, body: JSON.stringify(body) }));
    expect(result.status).toBe(200); expect(mock).toHaveBeenCalledWith(body);
  });
});
