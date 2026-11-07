import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../app/api/ops/identity/route";

const token = "synthetic-cbb-identity-reader-000000000001";
const digest = createHash("sha256").update(token).digest("hex");
const request = () => new Request("https://preview.example/api/ops/identity", { headers: { Authorization: `Bearer ${token}` } });
beforeEach(() => {
  vi.stubEnv("OPS_SCOPED_TOKENS_JSON", JSON.stringify([{ id: "identity-test", sha256: digest, scopes: ["portal:read"] }]));
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abmmlybdqwzujcysagvf.supabase.co");
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "a".repeat(40));
});
afterEach(() => vi.unstubAllEnvs());
describe("scoped destination proof", () => {
  it("returns the exact preview identity without provider or database reads", async () => {
    const r = await GET(request());
    expect(r.status).toBe(200);
    expect(r.headers.get("Cache-Control")).toBe("no-store");
    const body = await r.json();
    expect(body.identity).toEqual({ application: "cbb-ops", environment: "isolated_preview", database_ref: "abmmlybdqwzujcysagvf", revision: "a".repeat(40) });
    expect(Object.keys(body.controls)).toHaveLength(6);
    expect(JSON.stringify(body)).not.toContain(token);
  });
  it("rejects anonymous and wrong-scope tokens without identity metadata", async () => {
    expect((await GET(new Request("https://preview.example/api/ops/identity"))).status).toBe(401);
    vi.stubEnv("OPS_SCOPED_TOKENS_JSON", JSON.stringify([{ id: "identity-test", sha256: digest, scopes: ["workspace:write"] }]));
    const r = await GET(request());
    expect(r.status).toBe(403);
    expect(await r.json()).not.toHaveProperty("identity");
  });
  it("cannot identify a production deployment as isolated preview", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect((await (await GET(request())).json()).identity.environment).toBe("production");
  });
  it("keeps another database and absent commit unverified", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://differentdatabase000.supabase.co");
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "");
    const body = await (await GET(request())).json();
    expect(body.identity.environment).toBe("unknown");
    expect(body.identity.revision).toBeNull();
  });
  it("rejects lookalike and credentialled database origins", async () => {
    for (const url of ["https://abmmlybdqwzujcysagvf.supabase.co.evil.test", "https://user:password@abmmlybdqwzujcysagvf.supabase.co", "http://abmmlybdqwzujcysagvf.supabase.co"]) {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url);
      expect((await (await GET(request())).json()).identity).toMatchObject({ database_ref: null, environment: "unknown" });
    }
  });
  it("reports an enabled switch so the helper can refuse a supposedly paused destination", async () => {
    vi.stubEnv("FLOWSTATE_PORTAL_SEND_ENABLED", "true");
    expect((await (await GET(request())).json()).controls.portal_sending).toBe(true);
  });
});
