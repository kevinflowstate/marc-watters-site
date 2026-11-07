import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ admin: vi.fn(), transfer: vi.fn() }));
vi.mock("@/lib/ops/http", () => ({
  adminActor: state.admin,
  respond: async (fn: () => Promise<unknown>) => {
    try { return Response.json(await fn()); }
    catch { return Response.json({ error: "Access denied" }, { status: 401 }); }
  },
}));
vi.mock("@/lib/ops/lesson-upload", () => ({ prepareLessonTransfer: state.transfer }));
import { POST } from "../app/api/admin/ops/lesson-media/upload/route";
beforeEach(() => vi.resetAllMocks());
describe("private lesson transfer route", () => {
  it("authenticates before issuing any storage grant", async () => {
    state.admin.mockRejectedValue(new Error("no session"));
    const result = await POST(new Request("https://portal.test/api/admin/ops/lesson-media/upload", { method: "POST", body: "{}" }));
    expect(result.status).toBe(401);
    expect(state.transfer).not.toHaveBeenCalled();
  });
  it("never caches a temporary path token and passes only the submitted body", async () => {
    state.admin.mockResolvedValue("admin");
    state.transfer.mockResolvedValue({ upload_token: "temporary-token", publication_enabled: false });
    const input = { action: "upload", sha256: "a".repeat(64), bytes: 4096 };
    const result = await POST(new Request("https://portal.test/api/admin/ops/lesson-media/upload", { method: "POST", body: JSON.stringify(input) }));
    expect(state.transfer).toHaveBeenCalledWith(input);
    expect(result.headers.get("Cache-Control")).toBe("private, no-store");
    expect((await result.json()).publication_enabled).toBe(false);
  });
});
