import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
const preflight = vi.hoisted(() => vi.fn());
const OpsError = vi.hoisted(() => class extends Error { constructor(message: string, public status = 400) { super(message); } });
vi.mock("@/lib/ops/payment-cases", () => ({ paymentReminderPreflightForContact: preflight }));
vi.mock("@/lib/ops/tasks", () => ({ OpsError, record: (v: unknown) => { if (!v || typeof v !== "object" || Array.isArray(v)) throw new OpsError("Object required"); return v; } }));
vi.mock("@/lib/ops/http", () => ({ respond: async (fn: () => Promise<unknown>) => { try { return Response.json(await fn()); } catch (e) { return Response.json({ error: (e as Error).message }, { status: e instanceof OpsError ? e.status : 500 }); } } }));
vi.mock("@/lib/ops/auth", () => ({ secretMatches: (a: string, b: string) => Boolean(a && b && a === b) }));
vi.mock("@/lib/env", () => ({ getEnv: (key: string) => process.env[key] }));
vi.mock("@/lib/ops/payment-policy", () => ({ MARC_PAYMENT_LOCATION: "93GJEdsr0cT9el3OINXq" }));
import { POST } from "../app/api/ops/payment-reminders/preflight/route";
describe("contact-triggered payment preflight", () => {
  beforeEach(() => { vi.stubEnv("OPS_PAYMENT_WORKFLOW_SECRET", "synthetic-payment-secret"); preflight.mockReset(); });
  afterEach(() => vi.unstubAllEnvs());
  const body = { location_id: "93GJEdsr0cT9el3OINXq", contact_id: "contactFixture0001", step_key: "first" };
  const req = (value: unknown, secret = "synthetic-payment-secret") => new Request("https://portal.example/api/ops/payment-reminders/preflight", { method: "POST", headers: { "Content-Type": "application/json", "x-payment-workflow-secret": secret }, body: JSON.stringify(value) });
  it("rejects missing credentials before resolving a client", async () => { expect((await POST(req(body, "wrong"))).status).toBe(401); expect(preflight).not.toHaveBeenCalled(); });
  it("rejects another account or injected payment data", async () => { expect((await POST(req({ ...body, location_id: "another" }))).status).toBe(400); expect((await POST(req({ ...body, authorised_send: true }))).status).toBe(400); expect(preflight).not.toHaveBeenCalled(); });
  it("returns the fail-closed result without sending or inventing an invoice", async () => { preflight.mockResolvedValue({ authorised_send: false, reason: "Multiple invoices need review" }); const r = await POST(req(body)); expect(r.status).toBe(200); expect(await r.json()).toMatchObject({ authorised_send: false }); expect(preflight).toHaveBeenCalledWith(body.contact_id, { step_key: "first" }); });
});
