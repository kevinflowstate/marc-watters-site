import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ getEnv: (key: string) => process.env[key] }));
import {
  addContactToWorkflow,
  findContactsByEmail,
  removeContactFromWorkflow,
} from "../lib/ops/ghl-workflow";

const opts = (fetch: typeof globalThis.fetch) => ({
  token: "pit-test-token",
  workflowId: "5ef4aa6d-05f7-42e5-9c36-5c872f0ca2ed",
  fetch,
});
const call = (f: ReturnType<typeof vi.fn>) => f.mock.calls[0] as [string, RequestInit];

describe("CRM workflow calls", () => {
  it("searches Marc's location by exact email and re-checks the match locally", async () => {
    const f = vi.fn(async () => Response.json({ contacts: [
      { id: "contactAAAA1", email: "Client@Example.invalid" },
      { id: "contactBBBB2", email: "other@example.invalid" },
    ], total: 2 }));
    const found = await findContactsByEmail(" client@example.invalid ", opts(f));
    expect(found).toEqual([{ id: "contactAAAA1", email: "client@example.invalid" }]);
    const [url, init] = call(f);
    expect(url).toBe("https://services.leadconnectorhq.com/contacts/search");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ Authorization: "Bearer pit-test-token", Version: "2021-07-28" });
    expect(JSON.parse(String(init.body))).toEqual({
      locationId: "93GJEdsr0cT9el3OINXq", page: 1, pageLimit: 5,
      filters: [{ field: "email", operator: "eq", value: "client@example.invalid" }],
    });
  });
  it("adds and removes the contact on the configured workflow", async () => {
    const f = vi.fn<typeof fetch>(async () => Response.json({ succeeded: true }));
    await addContactToWorkflow("contactAAAA1", { ...opts(f), eventStartTime: "2026-11-09T09:00:00.000Z" });
    expect(JSON.parse(String(f.mock.calls[0][1]?.body))).toEqual({ eventStartTime: "2026-11-09T09:00:00+00:00" });
    await removeContactFromWorkflow("contactAAAA1", opts(f));
    const path = "https://services.leadconnectorhq.com/contacts/contactAAAA1/workflow/5ef4aa6d-05f7-42e5-9c36-5c872f0ca2ed";
    expect(f.mock.calls.map((c) => [c[0], c[1]?.method])).toEqual([[path, "POST"], [path, "DELETE"]]);
  });
  it("treats a 404 on removal as already out of the workflow, but surfaces other failures", async () => {
    expect(await removeContactFromWorkflow("contactAAAA1", opts(vi.fn(async () => new Response("", { status: 404 })))))
      .toEqual({ removed: false, not_in_workflow: true });
    await expect(addContactToWorkflow("contactAAAA1", opts(vi.fn(async () => new Response("", { status: 422 })))))
      .rejects.toThrow("422");
  });
  it("refuses to run without a token or workflow, and never puts the token in an error", async () => {
    vi.stubEnv("CBB_GHL_PIT_TOKEN", "");
    await expect(addContactToWorkflow("contactAAAA1", { workflowId: "5ef4aa6d-05f7" })).rejects.toThrow("not configured");
    const f = vi.fn(async () => new Response("", { status: 401 }));
    await expect(findContactsByEmail("a@b.co", opts(f))).rejects.not.toThrow("pit-test-token");
    vi.unstubAllEnvs();
  });
});
