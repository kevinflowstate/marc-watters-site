import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";
import { describe, expect, it, vi } from "vitest";
import { ContentPackError } from "../lib/ops/content-pack";

const actor = "22222222-2222-4222-8222-222222222222",
  id = "11111111-1111-4111-8111-111111111111";
class OpsError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
type Handler = (
  request: Request,
  context: {
    params: Promise<{ id: string; verificationId: string; key: string }>;
  },
) => Promise<Response>;
const cases = [
  ["automation/route.ts", "GET", "listArtifacts"],
  ["artifacts/[id]/route.ts", "GET", "getArtifactDetail"],
  ["artifacts/[id]/decision/route.ts", "POST", "decidePreparedArtifact"],
  ["artifacts/[id]/execute/route.ts", "POST", "executePreparedArtifact"],
  [
    "artifacts/[id]/items/[key]/reconcile/route.ts",
    "POST",
    "reconcilePreparedArtifact",
  ],
  ["artifacts/import-drive/route.ts", "POST", "readDriveContentPack"],
  ["lesson-media/verify/route.ts", "POST", "verifyStoredLessonMedia"],
  [
    "lesson-media/[verificationId]/preview/route.ts",
    "GET",
    "getVerifiedLessonMediaPreview",
  ],
  ["payment-cases/[id]/route.ts", "GET", "getPaymentCase"],
  ["payment-cases/[id]/binding/route.ts", "POST", "bindPaymentContact"],
];
function harness(file: string, authorised = true) {
  const auth = vi.fn(async () => {
    if (!authorised) throw new OpsError("Unauthenticated", 401);
    return actor;
  });
  const calls = {
    listArtifacts: vi.fn(async () => []),
    listPaymentCases: vi.fn(async () => []),
    automationControls: vi.fn(() => ({
      content_scheduling: false,
      lesson_publication: false,
      payment_reminders: false,
    })),
    getArtifactDetail: vi.fn(async () => ({
      artifact: { id },
      items: [],
      preview: {},
    })),
    getArtifactHistory: vi.fn(async () => [
      {
        id: "decision-id",
        artifact_id: id,
        version: 1,
        manifest_hash: "a".repeat(64),
        decision: "rejected",
        note: "Please change the first caption.",
        created_at: "2026-11-05T22:00:00Z",
      },
    ]),
    decidePreparedArtifact: vi.fn(async () => ({ id, status: "approved" })),
    executePreparedArtifact: vi.fn(async () => ({
      artifact: { id },
      items: [],
      continuation_required: false,
    })),
    reconcilePreparedArtifact: vi.fn(async () => ({
      artifact: { id },
      items: [],
    })),
    verifyStoredLessonMedia: vi.fn(async () => ({
      verification: { id: "verified" },
    })),
    getVerifiedLessonMediaPreview: vi.fn(async () => ({
      url: "https://private.example.com/temporary-signed-preview",
      verification: { id: "verified" },
    })),
    getPaymentCase: vi.fn(async () => ({
      payment_case: { id },
      attempts: [],
      events: [],
    })),
    bindPaymentContact: vi.fn(async () => ({ id })),
    readDriveContentPack: vi.fn(async () => ({
      pack: { location_id: "location", posts: [{ post_id: "post-1" }] },
      source: { file_id: "drive-file", version: "4", sha256: "a".repeat(64) },
    })),
    submitArtifact: vi.fn(async () => ({ id })),
    recordArtifactImport: vi.fn(async () => ({ file_id: "drive-file" })),
    validateArtifactDomain: vi.fn(),
  };
  const modules: Record<string, unknown> = {
    "@/lib/env": { getEnv: () => "server-only-drive-token" },
    "@/lib/ops/http": {
      adminActor: auth,
      respond: async (fn: () => Promise<unknown>) => {
        try {
          return Response.json(await fn());
        } catch (e) {
          return Response.json(
            { error: e instanceof Error ? e.message : "Error" },
            { status: e instanceof OpsError ? e.status : 500 },
          );
        }
      },
    },
    "@/lib/ops/actions": calls,
    "@/lib/ops/payment-cases": calls,
    "@/lib/ops/artifact-execution": calls,
    "@/lib/ops/lesson-publication": calls,
    "@/lib/ops/content-drive": calls,
    "@/lib/ops/content-pack": { ContentPackError },
    "@/lib/ops/tasks": {
      OpsError,
      record: (v: unknown) => {
        if (!v || typeof v !== "object" || Array.isArray(v))
          throw new OpsError("Object required");
        return v;
      },
    },
    "next/server": {
      NextResponse: {
        redirect: (url: string, status: number) =>
          new Response(null, { status, headers: { location: url } }),
      },
    },
  };
  const code = transformSync(
    readFileSync(
      new URL("../app/api/admin/ops/" + file, import.meta.url),
      "utf8",
    ),
    { loader: "ts", format: "cjs", target: "es2022" },
  ).code;
  const m = { exports: {} as Record<string, Handler> };
  new Function("require", "module", "exports", code)(
    (name: string) => {
      if (name in modules) return modules[name];
      throw Error("Unexpected dependency: " + name);
    },
    m,
    m.exports,
  );
  return { api: m.exports, auth, calls };
}
function request(method: string, body: unknown = {}) {
  return new Request("http://localhost/api/admin/ops/test", {
    method,
    ...(method === "POST"
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
}
const context = {
  params: Promise.resolve({ id, verificationId: id, key: "post-1" }),
};

describe("admin-only automation routes", () => {
  it.each(cases)(
    "authenticates before work: %s",
    async (file, method, operation) => {
      const h = harness(file, false),
        r = await h.api[method](request(method), context);
      expect(r.status).toBe(401);
      expect(h.auth).toHaveBeenCalledOnce();
      expect(h.calls[operation as keyof typeof h.calls]).not.toHaveBeenCalled();
      if (file === "automation/route.ts")
        expect(h.calls.listPaymentCases).not.toHaveBeenCalled();
      if (file === "artifacts/[id]/route.ts")
        expect(h.calls.getArtifactHistory).not.toHaveBeenCalled();
    },
  );
  it("gets artifacts/payment cases/boolean execution controls only after admin auth", async () => {
    const h = harness("automation/route.ts"),
      r = await h.api.GET(request("GET"), context);
    expect(await r.json()).toEqual({
      artifacts: [],
      payments: [],
      controls: {
        content_scheduling: false,
        lesson_publication: false,
        payment_reminders: false,
      },
    });
  });
  it("returns saved exact-version review feedback after admin authentication", async () => {
    const h = harness("artifacts/[id]/route.ts");
    const response = await h.api.GET(request("GET"), context);
    const result = await response.json();
    expect(h.calls.getArtifactHistory).toHaveBeenCalledWith(id);
    expect(result.decisions).toEqual([
      expect.objectContaining({
        artifact_id: id,
        version: 1,
        manifest_hash: "a".repeat(64),
        decision: "rejected",
        note: "Please change the first caption.",
        created_at: "2026-11-05T22:00:00Z",
      }),
    ]);
  });
  it.each([
    ["artifacts/[id]/decision/route.ts", "decidePreparedArtifact"],
    ["artifacts/[id]/execute/route.ts", "executePreparedArtifact"],
    ["payment-cases/[id]/binding/route.ts", "bindPaymentContact"],
  ])("passes the server actor to %s", async (file, operation) => {
    const h = harness(file),
      body = { version: 1, manifest_hash: "a".repeat(64) };
    await h.api.POST(request("POST", body), context);
    expect(h.calls[operation as keyof typeof h.calls]).toHaveBeenCalledWith(
      id,
      body,
      actor,
    );
  });
  it("returns an authenticated private no-store redirect for a verified lesson preview", async () => {
    const h = harness("lesson-media/[verificationId]/preview/route.ts"),
      r = await h.api.GET(request("GET"), context);
    expect(r.status).toBe(307);
    expect(r.headers.get("Cache-Control")).toContain("no-store");
    expect(r.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(h.calls.getVerifiedLessonMediaPreview).toHaveBeenCalledWith(id);
  });
  it("imports only a pinned Drive manifest using server credentials and saves separate provenance", async () => {
    const h = harness("artifacts/import-drive/route.ts"),
      body = {
        file_id: "drive-file",
        expected_version: "4",
        expected_sha256: "a".repeat(64),
        title: "Review content",
        external_ref: "content:week",
      };
    const r = await h.api.POST(request("POST", body), context);
    expect(r.status).toBe(200);
    expect(h.calls.readDriveContentPack).toHaveBeenCalledWith(
      {
        fileId: "drive-file",
        expectedVersion: "4",
        expectedSha256: "a".repeat(64),
      },
      { accessToken: "server-only-drive-token" },
    );
    expect(h.calls.recordArtifactImport).toHaveBeenCalledWith(
      id,
      {
        provider: "google_drive",
        file_id: "drive-file",
        version: "4",
        sha256: "a".repeat(64),
      },
      actor,
    );
  });
  it("rejects injected connection options before calling Drive", async () => {
    const h = harness("artifacts/import-drive/route.ts"),
      r = await h.api.POST(
        request("POST", {
          file_id: "drive-file",
          expected_version: "4",
          expected_sha256: "a".repeat(64),
          title: "Review",
          external_ref: "ref",
          accessToken: "untrusted-body-token",
        }),
        context,
      );
    expect(r.status).toBe(400);
    expect(h.calls.readDriveContentPack).not.toHaveBeenCalled();
    expect(h.calls.submitArtifact).not.toHaveBeenCalled();
  });
});
