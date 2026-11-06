import { beforeEach, describe, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ admin: vi.fn(), stage: vi.fn(), read: vi.fn(), plan: vi.fn() }));
vi.mock("@/lib/ops/http", () => ({ adminActor: f.admin, respond: async (fn: () => Promise<unknown>) => {
  try { return Response.json(await fn()); } catch (e) { return Response.json({ error: (e as Error).message }, { status: Number((e as {status?:number}).status) || 401 }); }
} }));
vi.mock("@/lib/ops/content-media-staging", () => ({ stageContentImage: f.stage, readStagedContentImage: f.read, prepareContentDeliveryPack: f.plan }));
vi.mock("@/lib/env", () => ({ getEnv: (key: string) => key === "OPS_CONTENT_DELIVERY_ORIGIN" ? "https://operator-media.example.com" : undefined }));
import { GET, POST } from "../app/api/admin/ops/artifacts/[id]/media/[assetId]/route";
import { POST as plan } from "../app/api/admin/ops/artifacts/[id]/delivery-plan/route";
const hash = "a".repeat(64), context = { params: Promise.resolve({ id: "artifact", assetId: "slide-1" }) };
const url = `https://preview.example/api/media?version=1&manifest_hash=${hash}`;
beforeEach(() => { vi.resetAllMocks(); f.admin.mockResolvedValue("admin"); });
describe("admin-only private content routes", () => {
  it("refuses all reads, uploads and delivery proposals before touching storage without an admin", async () => {
    f.admin.mockRejectedValue(Error("Sign in"));
    expect((await GET(new Request(url), context)).status).toBe(401);
    expect((await POST(new Request(url, {method:"POST"}), context)).status).toBe(401);
    expect((await plan(new Request(url, {method:"POST"}), context)).status).toBe(401);
    expect(f.stage).not.toHaveBeenCalled(); expect(f.read).not.toHaveBeenCalled(); expect(f.plan).not.toHaveBeenCalled();
  });
  it("streams private bytes without caching or returning a signed media link", async () => {
    f.read.mockResolvedValue({ bytes: new Uint8Array([1,2,3]), mime_type: "image/png" });
    const r = await GET(new Request(url), context);
    expect([...new Uint8Array(await r.arrayBuffer())]).toEqual([1,2,3]);
    expect(r.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(r.headers.get("referrer-policy")).toBe("no-referrer");
    expect(r.headers.get("location")).toBeNull();
    expect(f.read).toHaveBeenCalledWith("artifact", {version:1,manifest_hash:hash}, "slide-1");
  });
  it("passes the original raw upload and requires a pinned snapshot", async () => {
    const request = new Request(url, {method:"POST",body:"bytes"});
    f.stage.mockResolvedValue({staged:true});
    expect((await POST(request, context)).status).toBe(200);
    expect(f.stage).toHaveBeenCalledWith("artifact", {version:1,manifest_hash:hash}, "slide-1", request);
    expect((await POST(new Request("https://preview.example/upload", {method:"POST"}), context)).status).not.toBe(200);
    expect(f.stage).toHaveBeenCalledTimes(1);
  });
  it("uses only the server-owned origin and refuses a caller-supplied host", async () => {
    const request = (body: unknown) => new Request(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
    f.plan.mockResolvedValue({requires_new_approval:true,public_copy_created:false});
    expect((await plan(request({version:1,manifest_hash:hash}),context)).status).toBe(200);
    expect(f.plan).toHaveBeenCalledWith("artifact",{version:1,manifest_hash:hash},"https://operator-media.example.com");
    expect((await plan(request({version:1,manifest_hash:hash,deliveryOrigin:"https://attacker.example.com"}),context)).status).not.toBe(200);
    expect(f.plan).toHaveBeenCalledTimes(1);
  });
});
