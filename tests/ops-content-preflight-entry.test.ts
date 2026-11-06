import { beforeEach, describe, expect, it, vi } from "vitest";
const adminActor = vi.hoisted(() => vi.fn());
const preflight = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ops/http", () => ({
  adminActor,
  respond: async (fn: () => Promise<unknown>) => {
    try {
      return Response.json(await fn());
    } catch {
      return Response.json({ error: "Access denied" }, { status: 401 });
    }
  },
}));
vi.mock("@/lib/ops/artifact-execution", () => ({
  preflightPreparedContent: preflight,
}));
import { POST } from "../app/api/admin/ops/artifacts/[id]/preflight/route";
describe("content readiness authentication", () => {
  beforeEach(() => {
    adminActor.mockReset();
    preflight.mockReset();
  });
  const request = () =>
    new Request(
      "https://preview.example/api/admin/ops/artifacts/id/preflight",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: 1, manifest_hash: "a".repeat(64) }),
      },
    );
  it("requires an authenticated admin before reading prepared work or provider connections", async () => {
    adminActor.mockRejectedValue(new Error("Not signed in"));
    expect(
      (
        await POST(request(), {
          params: Promise.resolve({ id: "prepared-id" }),
        })
      ).status,
    ).toBe(401);
    expect(preflight).not.toHaveBeenCalled();
  });
  it("passes only the saved item reference and body to read checks after authentication", async () => {
    adminActor.mockResolvedValue("admin-id");
    preflight.mockResolvedValue({ dry_run: true, ready: false });
    expect(
      (
        await POST(request(), {
          params: Promise.resolve({ id: "prepared-id" }),
        })
      ).status,
    ).toBe(200);
    expect(preflight).toHaveBeenCalledWith("prepared-id", {
      version: 1,
      manifest_hash: "a".repeat(64),
    });
  });
});
