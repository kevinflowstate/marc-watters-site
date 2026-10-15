import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { transform } from "esbuild";
import { defaultCheckinConfig } from "../lib/checkins";
import * as submission from "../lib/checkin-submission";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

const sid = "a6b7c8d9-0000-4000-8000-000000000001";
const receipt = { id: sid, week_number: 3, created_at: "2026-10-15T09:00:00Z" };
const answers = Object.fromEntries(defaultCheckinConfig.questions.map((q) => [q.id, q.type === "scale" ? "7" : q.options?.[0]?.value || "Synthetic answer"]));
let user: { id: string } | null;
let tables: Record<string, { data: unknown; error?: { code: string } }>;
let saveResult: { data: unknown; error: { code: string; message: string } | null };
const rpc = vi.fn(async (_name: string, _args: Record<string, unknown>) => saveResult);
let route: (request: Request) => Promise<Response>;

beforeEach(async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
  user = { id: "account-a" };
  tables = { client_profiles: { data: { id: "profile-a", archived_at: null } }, checkins: { data: null }, form_config: { data: { config: defaultCheckinConfig } } };
  saveResult = { data: receipt, error: null };
  rpc.mockClear();
  const admin = { from: (table: string) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => tables[table] }) }) }), rpc };
  // Execute the actual route with only auth/database boundaries substituted; no network or real data.
  const source = readFileSync(new URL("../app/api/portal/checkin/route.ts", import.meta.url), "utf8");
  const code = (await transform(source.replace(/^import .*;$/gm, "").replace("export async function POST", "async function POST"), { loader: "ts", target: "es2022" })).code;
  route = new Function("createAdminClient", "createClient", "NextResponse", "randomUUID", ...Object.keys(submission), "defaultCheckinConfig", "deriveCheckinMood", code + "; return POST;")(
    () => admin, async () => ({ auth: { getUser: async () => ({ data: { user } }) } }), NextResponse, randomUUID, ...Object.values(submission), defaultCheckinConfig,
    (responses: Record<string, string>) => responses.business_feeling || "good",
  );
});
const request = (extra = {}) => new Request("http://localhost/api/portal/checkin", { method: "POST", body: JSON.stringify({ userId: "account-a", submissionId: sid, responses: answers, mood: "great", ...extra }) });

describe("check-in route persistence acknowledgement", () => {
  it("returns the exact atomic receipt and authenticated profile", async () => {
    const response = await route(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, receipt });
    expect(rpc).toHaveBeenCalledWith("submit_checkin_atomic", expect.objectContaining({ p_client_id: "profile-a", p_submission_id: sid, p_responses: answers }));
  });
  it("preserves the frozen mood when configuration changes before an uncertain save", async () => {
    const response = await route(request({ mood: "good" }));
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("submit_checkin_atomic", expect.objectContaining({ p_mood: "good" }));
    tables.checkins = { data: { ...receipt, client_id: "profile-a", responses: answers, mood: "good" } };
    expect((await route(request({ mood: "good" }))).status).toBe(200);
  });
  it("never reports success when the profile or receipt read fails", async () => {
    for (const table of ["client_profiles", "checkins", "form_config"]) {
      const original = tables[table];
      tables[table] = { data: null, error: { code: "08006" } };
      expect((await route(request())).status).toBe(503);
      tables[table] = original;
    }
    expect(rpc).not.toHaveBeenCalled();
  });
  it("never treats a unique conflict as success or updates last_checkin separately", async () => {
    saveResult = { data: null, error: { code: "23505", message: "duplicate week" } };
    const response = await route(request());
    expect(response.status).toBe(503);
    expect(await response.json()).not.toHaveProperty("success");
  });
  it("rejects a false or malformed RPC acknowledgement", async () => {
    for (const data of [null, { success: true }, { ...receipt, id: "unrelated" }]) {
      saveResult = { data, error: null };
      expect((await route(request())).status).toBe(503);
    }
  });
  it("reconciles exact retries even after form configuration changes", async () => {
    tables.checkins = { data: { ...receipt, client_id: "profile-a", responses: answers, mood: "great" } };
    tables.form_config = { data: null, error: { code: "config_unavailable" } };
    expect((await route(request())).status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each(["responses", "client_id", "mood"])("rejects a retry with conflicting %s", async (field) => {
    tables.checkins = { data: { ...receipt, client_id: "profile-a", responses: answers, mood: "great", [field]: field === "responses" ? { wins: "old answers" } : "different" } };
    expect((await route(request())).status).toBe(409);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("rejects missing sessions, account switches and archived clients without saving", async () => {
    user = null;
    expect((await route(request())).status).toBe(401);
    user = { id: "account-b" };
    expect((await route(request())).status).toBe(401);
    user = { id: "account-a" };
    tables.client_profiles = { data: { id: "profile-a", archived_at: receipt.created_at } };
    expect((await route(request())).status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("reconciles invalid required answers before unlocking, and rejects non-string payloads", async () => {
    saveResult = { data: { cancelled: true }, error: null };
    expect((await route(request({ responses: { ...answers, overall_week_rating: " " } }))).status).toBe(400);
    expect(rpc).toHaveBeenCalledWith("submit_checkin_atomic", expect.objectContaining({ p_cancel: true }));
    rpc.mockClear();
    expect((await route(request({ responses: { overall_week_rating: 7 } }))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("returns an earlier persisted receipt if it wins the race with validation reconciliation", async () => {
    saveResult = { data: receipt, error: null };
    const response = await route(request({ responses: { ...answers, overall_week_rating: " " } }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, receipt });
  });
  it("only unlocks after a confirmed cancellation", async () => {
    saveResult = { data: { cancelled: true }, error: null };
    const response = await route(request({ responses: { ...answers, overall_week_rating: " " } }));
    expect(await response.json()).toMatchObject({ cancelled: true, config: defaultCheckinConfig });
    saveResult = { data: null, error: { code: "08006", message: "connection failed" } };
    expect((await route(request({ responses: { ...answers, overall_week_rating: " " } }))).status).toBe(503);
  });
  it("keeps compatibility with old forms without a submission ID", async () => {
    rpc.mockImplementationOnce(async (_name: string, args: Record<string, unknown>) => ({ data: { ...receipt, id: args.p_submission_id }, error: null }));
    const response = await route(request({ submissionId: undefined, userId: undefined }));
    expect(response.status).toBe(200);
    expect((await response.json()).receipt.id).not.toBe(sid);
  });
  it("never logs answer content on failures", async () => {
    saveResult = { data: null, error: { code: "XX000", message: "database failed" } };
    await route(request());
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("Synthetic answer");
  });
});
