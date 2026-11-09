import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ scope: vi.fn(), transfer: vi.fn() }));
vi.mock("@/lib/ops/http", () => ({
  respond: async (fn: () => Promise<unknown>) => {
    try { return Response.json(await fn()); }
    catch (error) { return Response.json({ error: "denied" }, { status: (error as { status?: number }).status ?? 401 }); }
  },
}));
vi.mock("@/lib/ops/scoped-auth", () => ({ requireOpsScope: state.scope }));
vi.mock("@/lib/ops/lesson-upload", () => ({ prepareLessonTransfer: state.transfer }));
import { POST } from "../app/api/ops/lesson-media/upload/route";
const url = "https://portal.test/api/ops/lesson-media/upload";
beforeEach(() => vi.resetAllMocks());
describe("scoped lesson transfer route", () => {
  it("requires the lessons:upload scope before issuing any grant", async () => {
    state.scope.mockImplementation(() => { throw Object.assign(new Error("forbidden"), { status: 403 }); });
    const result = await POST(new Request(url, { method: "POST", body: "{}" }));
    expect(result.status).toBe(403);
    expect(state.transfer).not.toHaveBeenCalled();
    expect(state.scope).toHaveBeenCalledWith(expect.any(Request), "lessons:upload");
  });
  it("refuses readback through the scoped connection", async () => {
    state.scope.mockReturnValue({ id: "codex", actor: "integration:codex", scopes: ["lessons:upload"] });
    const input = { action: "readback", sha256: "b".repeat(64), bytes: 4096 };
    const result = await POST(new Request(url, { method: "POST", body: JSON.stringify(input) }));
    expect(result.status).toBe(403);
    expect(state.transfer).not.toHaveBeenCalled();
  });
  it("passes only the submitted body and never caches the grant", async () => {
    state.scope.mockReturnValue({ id: "codex", actor: "integration:codex", scopes: ["lessons:upload"] });
    state.transfer.mockResolvedValue({ upload_token: "temporary-token", publication_enabled: false });
    const input = { action: "upload", sha256: "b".repeat(64), bytes: 700 * 1024 ** 2 };
    const result = await POST(new Request(url, { method: "POST", body: JSON.stringify(input) }));
    expect(state.transfer).toHaveBeenCalledWith(input);
    expect(result.headers.get("Cache-Control")).toBe("private, no-store");
    expect((await result.json()).publication_enabled).toBe(false);
  });
});
