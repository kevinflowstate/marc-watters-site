import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { transformSync } from "esbuild";
import { afterEach, describe, expect, it, vi } from "vitest";

const nativeRequire = createRequire(import.meta.url);
class OpsError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
const taskHelpers = {
  OpsError,
  record: (v: unknown) => {
    if (!v || typeof v !== "object" || Array.isArray(v))
      throw new OpsError("JSON object required");
    return v;
  },
  uuid: (v: unknown) => {
    if (typeof v !== "string" || !/^[a-f0-9-]{36}$/i.test(v))
      throw new OpsError("Valid id required");
    return v;
  },
};
type Module = Record<string, (...args: unknown[]) => unknown>;
function load(
  path: string,
  dependencies: Record<string, unknown> = {},
): Module {
  const code = transformSync(
    readFileSync(new URL(path, import.meta.url), "utf8"),
    { loader: "ts", format: "cjs", target: "es2022" },
  ).code;
  const m = { exports: {} as Module };
  const require = (name: string) => {
    if (name in dependencies) return dependencies[name];
    if (name === "./tasks") return taskHelpers;
    if (name === "./action-types") return {};
    if (name.startsWith("node:")) return nativeRequire(name);
    throw Error(`Unexpected dependency: ${name}`);
  };
  new Function("require", "module", "exports", code)(require, m, m.exports);
  return m.exports;
}
const validation = load("../lib/ops/action-validation.ts");
const sample = {
  external_ref: "content:2026-11-09:brief-a",
  kind: "content",
  action: "schedule_content",
  title: "Review next week's content",
  payload: {
    caption: "Prepared caption",
    media: [{ id: "asset-a", hash: "a".repeat(64) }],
    schedule: "2026-11-09T10:00:00Z",
  },
  destination: { location_id: "client-location", account_ids: ["account-a"] },
  item_keys: ["post-a", "post-b"],
};
afterEach(() => vi.unstubAllEnvs());

describe("immutable action proposals", () => {
  it("hashes reordered object keys identically without reordering approved lists", () => {
    const a = validation.artifactHash({
      a: 1,
      nested: { y: true, x: "a" },
      list: [1, 2],
    });
    expect(a).toBe(
      validation.artifactHash({
        list: [1, 2],
        nested: { x: "a", y: true },
        a: 1,
      }),
    );
    expect(a).not.toBe(
      validation.artifactHash({
        a: 1,
        nested: { y: true, x: "a" },
        list: [2, 1],
      }),
    );
  });
  it("changes approval identity for copy, media, time, destination, title or item order", () => {
    const prepared = validation.prepareArtifact(sample) as {
      manifest_hash: string;
    };
    for (const changed of [
      { ...sample, title: "A different title" },
      { ...sample, payload: { ...sample.payload, caption: "Changed copy" } },
      {
        ...sample,
        payload: {
          ...sample.payload,
          media: [{ id: "asset-a", hash: "b".repeat(64) }],
        },
      },
      {
        ...sample,
        payload: { ...sample.payload, schedule: "2026-11-09T11:00:00Z" },
      },
      { ...sample, destination: { location_id: "different-location" } },
      { ...sample, item_keys: ["post-b", "post-a"] },
    ])
      expect(
        (validation.prepareArtifact(changed) as { manifest_hash: string })
          .manifest_hash,
      ).not.toBe(prepared.manifest_hash);
  });
  it("rejects unhashable values and forged lifecycle/actor fields", () => {
    for (const payload of [
      { n: NaN },
      { n: Infinity },
      { missing: undefined },
      { date: new Date() },
      JSON.parse('{"__proto__":{"admin":true}}'),
    ])
      expect(() =>
        validation.prepareArtifact({ ...sample, payload }),
      ).toThrow();
    for (const field of [
      "status",
      "approved_by",
      "claim_id",
      "version",
      "manifest_hash",
      "receipt",
    ])
      expect(() =>
        validation.prepareArtifact({ ...sample, [field]: "forged" }),
      ).toThrow("Unsupported artifact field");
  });
  it("requires an exact previous snapshot for revisions and rejects duplicate items", () => {
    expect(() =>
      validation.prepareArtifact({ ...sample, expected_version: 1 }),
    ).toThrow("Exact artifact version");
    expect(() =>
      validation.prepareArtifact({
        ...sample,
        expected_manifest_hash: "a".repeat(64),
      }),
    ).toThrow("Exact artifact version");
    expect(() =>
      validation.prepareArtifact({ ...sample, item_keys: ["same", "same"] }),
    ).toThrow("unique");
    const changed = validation.prepareArtifact({
      ...sample,
      expected_version: 2,
      expected_manifest_hash: "a".repeat(64),
    }) as { expected: unknown };
    expect(changed.expected).toEqual({
      version: 2,
      manifest_hash: "a".repeat(64),
    });
  });
  it("rejects oversized preparation before persistence", () => {
    expect(() =>
      validation.prepareArtifact({
        ...sample,
        payload: { text: "x".repeat(270000) },
      }),
    ).toThrow("256 KiB");
  });
});

describe("scoped Codex access", () => {
  const token = "synthetic-secret-for-scope-test-123456789";
  const digest = createHash("sha256").update(token).digest("hex");
  function harness(scopes = ["artifacts:write"]) {
    const rate = vi.fn(() => ({ success: true }));
    const api = load("../lib/ops/scoped-auth.ts", {
      "@/lib/env": { getEnv: (name: string) => process.env[name] },
      "@/lib/rate-limit": { rateLimit: rate },
    });
    vi.stubEnv(
      "OPS_SCOPED_TOKENS_JSON",
      JSON.stringify([{ id: "marc-draft", sha256: digest, scopes }]),
    );
    return {
      api,
      rate,
      request: new Request("http://localhost/api", {
        headers: { authorization: `Bearer ${token}` },
      }),
    };
  }
  it("returns identity metadata only and limits each credential independently", () => {
    const h = harness();
    const result = h.api.requireOpsScope(h.request, "artifacts:write");
    expect(result).toEqual({
      id: "marc-draft",
      actor: "integration:marc-draft",
      scopes: ["artifacts:write"],
    });
    expect(JSON.stringify(result)).not.toContain(token);
    expect(h.rate).toHaveBeenCalledWith("ops-scoped:marc-draft", 120, 60000);
  });
  it("refuses a valid credential outside its scope and never falls back to the broad token", () => {
    const h = harness();
    expect(() => h.api.requireOpsScope(h.request, "reports:write")).toThrow(
      "cannot perform",
    );
    vi.stubEnv("OPS_SCOPED_TOKENS_JSON", "[]");
    vi.stubEnv("OPS_API_TOKEN", token);
    expect(() => h.api.requireOpsScope(h.request, "artifacts:write")).toThrow(
      "Unauthorized",
    );
  });
  it("does not permit approval/execution scopes or duplicate credential definitions", () => {
    const h = harness();
    for (const config of [
      [{ id: "bad", sha256: digest, scopes: ["artifacts:approve"] }],
      [{ id: "bad", sha256: digest, scopes: ["artifacts:execute"] }],
      [
        { id: "a", sha256: digest, scopes: ["artifacts:read"] },
        { id: "b", sha256: digest, scopes: ["payments:read"] },
      ],
    ])
      expect(() => h.api.readScopedCredentials(JSON.stringify(config))).toThrow(
        "not configured correctly",
      );
  });
  it("refuses missing or malformed authentication", () => {
    const h = harness();
    for (const authorization of [
      "",
      "Bearer short",
      `Bearer ${token.slice(0, 15)} ${token.slice(15)}`,
      "Basic dGVzdA==",
    ])
      expect(() =>
        h.api.requireOpsScope(
          new Request("http://localhost", { headers: { authorization } }),
          "artifacts:write",
        ),
      ).toThrow("Unauthorized");
  });
});

describe("atomic state transitions use database guards", () => {
  const id = "11111111-1111-4111-8111-111111111111",
    actor = "22222222-2222-4222-8222-222222222222",
    claim = "33333333-3333-4333-8333-333333333333";
  function harness(error: { message: string; code: string } | null = null) {
    const call = vi.fn(async () => ({ data: { id }, error }));
    const api = load("../lib/ops/actions.ts", {
      "@/lib/supabase/admin": { createAdminClient: () => ({ rpc: call }) },
      "./action-validation": validation,
    });
    return { api, call };
  }
  it("passes the exact approved snapshot and authenticated actor to the atomic claim", async () => {
    const h = harness();
    await h.api.claimArtifact(
      id,
      { version: 3, manifest_hash: "a".repeat(64) },
      actor,
    );
    expect(h.call).toHaveBeenCalledWith("ops_claim_artifact", {
      p_id: id,
      p_version: 3,
      p_hash: "a".repeat(64),
      p_actor: actor,
    });
  });
  it("propagates conflict/not-found outcomes and refuses a success without receipt", async () => {
    await expect(
      harness({ message: "Artifact changed", code: "40001" }).api.claimArtifact(
        id,
        { version: 1, manifest_hash: "a".repeat(64) },
        actor,
      ),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      harness({ message: "Artifact missing", code: "P0002" }).api.claimArtifact(
        id,
        { version: 1, manifest_hash: "a".repeat(64) },
        actor,
      ),
    ).rejects.toMatchObject({ status: 404 });
    const h = harness();
    expect(() =>
      h.api.recordArtifactItem(id, claim, "post-a", {
        status: "succeeded",
        receipt: {},
      }),
    ).toThrow("requires a receipt");
    expect(h.call).not.toHaveBeenCalled();
  });
  it("records uncertainty rather than converting it into failure or success", async () => {
    const h = harness();
    await h.api.recordArtifactItem(id, claim, "post-a", {
      status: "unknown",
      error: "Provider timeout; check before retrying",
    });
    expect(h.call).toHaveBeenCalledWith("ops_record_artifact_item", {
      p_id: id,
      p_claim: claim,
      p_item: "post-a",
      p_status: "unknown",
      p_receipt: null,
      p_error: "Provider timeout; check before retrying",
    });
  });
  it("rejects identity spoofing in approval bodies", () => {
    const h = harness();
    expect(() =>
      h.api.decideArtifact(
        id,
        {
          version: 1,
          manifest_hash: "a".repeat(64),
          decision: "approved",
          approved_by: actor,
        },
        actor,
      ),
    ).toThrow("Unsupported decision field");
    expect(h.call).not.toHaveBeenCalled();
  });
});
