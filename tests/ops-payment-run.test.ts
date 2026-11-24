import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addContactToWorkflow,
  ghlWhatsAppBlocked,
} from "@/lib/ops/ghl-workflow";
import { reserveNativeReminder } from "@/lib/ops/payment-preflight";
import { signPaymentRun, verifyPaymentRun } from "@/lib/ops/payment-run";
const run = {
  case_id: "12345678-1234-4123-8123-123456789012",
  contact_id: "contactFixture01",
  invoice_id: "in_Fixture",
  stripe_account_id: "acct_Fixture",
};
const entry =
  "https://services.leadconnectorhq.com/hooks/93GJEdsr0cT9el3OINXq/webhook-trigger/fixture";
beforeEach(() => vi.stubEnv("OPS_PAYMENT_WORKFLOW_SECRET", "fixture-only"));
afterEach(() => vi.unstubAllEnvs());
describe("invoice-bound workflow entry", () => {
  it("retains the original invoice and rejects altered context or another recipient", () => {
    const token = signPaymentRun(run);
    expect(verifyPaymentRun(token, run.contact_id)).toEqual(run);
    expect(() => verifyPaymentRun("x" + token, run.contact_id)).toThrow();
    expect(() => verifyPaymentRun(token, "contactFixture02")).toThrow();
  });
  it("sends no CRM credential to the correct location-scoped fixture trigger", async () => {
    const request = vi.fn<typeof fetch>(async () =>
      Response.json({ success: true }),
    );
    const options = {
      token: "fixture-only",
      workflowId: "fixture-workflow",
      fetch: request,
      paymentRun: run,
      eventStartTime: "2026-11-24T09:00:00Z",
    };
    vi.stubEnv(
      "OPS_PAYMENT_WORKFLOW_ENTRY_URL",
      entry.replace("93GJEdsr0cT9el3OINXq", "wrong-location"),
    );
    await expect(addContactToWorkflow(run.contact_id, options)).rejects.toThrow(
      "trigger",
    );
    expect(request).not.toHaveBeenCalled();
    vi.stubEnv("OPS_PAYMENT_WORKFLOW_ENTRY_URL", entry);
    await addContactToWorkflow(run.contact_id, options);
    const [url, init] = request.mock.calls[0];
    expect(url).toBe(entry);
    expect(init?.headers).toEqual({ "Content-Type": "application/json" });
    const data = JSON.parse(String(init?.body));
    expect(verifyPaymentRun(data.run_context, data.contact_id)).toEqual(run);
    expect(data.first_due_at).toBe(options.eventStartTime);
  });
  it("holds preflight while the switch is disabled", async () => {
    vi.stubEnv("OPS_PAYMENT_REMINDERS_ENABLED", "false");
    expect(await reserveNativeReminder({})).toEqual({ allow_send: false });
  });
  it("holds incomplete or blocked DND evidence", () => {
    expect(ghlWhatsAppBlocked({})).toBe(true);
    expect(
      ghlWhatsAppBlocked({
        dnd: false,
        dndSettings: { Whatsapp: { status: "active" } },
      }),
    ).toBe(true);
    expect(
      ghlWhatsAppBlocked({
        dnd: false,
        dndSettings: { Whatsapp: { status: "inactive" } },
      }),
    ).toBe(false);
  });
});
