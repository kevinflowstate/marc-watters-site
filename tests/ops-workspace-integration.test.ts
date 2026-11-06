import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OpsArtifact } from "../lib/ops/action-types";
import type { OpsTask } from "../lib/ops/types";

const state = vi.hoisted(() => ({
  env: {} as Record<string, string>,
  authorised: true,
  failures: new Set<string>(),
  rows: {} as Record<string, Record<string, unknown>[]>,
  saved: new Map<string, Record<string, unknown>>(),
  rpcError: null as null | { code: string; message: string },
  saveThenFail: false,
  calls: [] as { table: string; start?: number; end?: number }[],
  rpcCalls: [] as { name: string; args: Record<string, unknown> }[],
  taskRead: vi.fn<() => Promise<OpsTask[]>>(),
  artifactRead: vi.fn<() => Promise<OpsArtifact[]>>(),
  paymentRead: vi.fn(async () => []),
  reportRead: vi.fn(async () => []),
}));

vi.mock("@/lib/env", () => ({ getEnv: (key: string) => state.env[key] }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: () => ({ success: true }) }));
vi.mock("@/lib/admin-auth", () => ({
  requireAdmin: async () =>
    state.authorised
      ? { authorised: true, authorized: true }
      : { authorized: false, error: "Unauthenticated", status: 401 },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: { id: "00000000-0000-4000-8000-000000000001" } },
      }),
    },
  }),
}));
vi.mock("@/lib/ops/tasks", async (importOriginal) => {
  const original = await importOriginal<typeof import("../lib/ops/tasks")>();
  return { ...original, listTasks: state.taskRead };
});
vi.mock("@/lib/ops/actions", () => ({ listArtifacts: state.artifactRead }));
vi.mock("@/lib/ops/payment-cases", () => ({
  listPaymentCases: state.paymentRead,
}));
vi.mock("@/lib/ops/reports", () => ({ listReports: state.reportRead }));
vi.mock("@/lib/ops/artifact-execution", () => ({
  automationControls: () => ({
    content_scheduling: false,
    lesson_publication: false,
    payment_reminders: false,
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from(table: string) {
      const call: { table: string; start?: number; end?: number } = { table };
      state.calls.push(call);
      const filters: Array<[string, unknown]> = [];
      const orders: Array<[string, boolean]> = [];
      let start = 0,
        end = Infinity,
        single = false;
      const q = {
        select() {
          return q;
        },
        maybeSingle() {
          single = true;
          return q;
        },
        eq(key: string, value: unknown) {
          filters.push([key, value]);
          return q;
        },
        is(key: string, value: unknown) {
          filters.push([key, value]);
          return q;
        },
        order(key: string, options: { ascending?: boolean } = {}) {
          orders.push([key, options.ascending !== false]);
          return q;
        },
        limit(size: number) {
          end = size - 1;
          return q;
        },
        range(from: number, to: number) {
          start = from;
          end = to;
          call.start = from;
          call.end = to;
          return q;
        },
        then(
          resolve: (result: {
            data: Record<string, unknown>[] | Record<string, unknown> | null;
            error: null | { message: string };
          }) => unknown,
        ) {
          if (state.failures.has(table))
            return Promise.resolve(
              resolve({
                data: null,
                error: { message: "Simulated source unavailable" },
              }),
            );
          const data = (state.rows[table] || [])
            .filter((row) =>
              filters.every(([key, value]) => {
                if (key === "client.archived_at")
                  return (
                    (row.client as { archived_at?: unknown } | undefined)
                      ?.archived_at == null
                  );
                return value === null ? row[key] == null : row[key] === value;
              }),
            )
            .sort((a, b) => {
              for (const [key, ascending] of orders) {
                const c = String(a[key] ?? "").localeCompare(
                  String(b[key] ?? ""),
                );
                if (c) return ascending ? c : -c;
              }
              return 0;
            })
            .slice(start, end + 1);
          return Promise.resolve(
            resolve({ data: single ? data[0] || null : data, error: null }),
          );
        },
      };
      return q;
    },
    async rpc(name: string, args: Record<string, unknown>) {
      state.rpcCalls.push({ name, args });
      if (state.rpcError) return { data: null, error: state.rpcError };
      const doc = args.p_document as Record<string, unknown>;
      const key = String(doc.run_key);
      const existing = state.saved.get(key);
      if (existing) {
        if (
          existing.content_hash !== args.p_hash ||
          existing.submitted_by !== args.p_actor
        )
          return {
            data: null,
            error: { code: "P0001", message: "Run key already used" },
          };
        return { data: existing, error: null };
      }
      const row = {
        ...doc,
        id: `result-${state.saved.size + 1}`,
        content_hash: args.p_hash,
        submitted_by: args.p_actor,
        received_at: "2026-11-06T13:00:00Z",
      };
      state.saved.set(key, row);
      if (state.saveThenFail) {
        state.saveThenFail = false;
        return {
          data: null,
          error: { code: "08006", message: "Connection lost before readback" },
        };
      }
      return { data: row, error: null };
    },
  }),
}));

import { getWorkspace } from "../lib/ops/workspace-feed";
import {
  listWorkspaceResults,
  submitWorkspaceResult,
  validateWorkspaceResult,
} from "../lib/ops/workspace-results";
import { canonicalJson } from "../lib/ops/action-validation";
import {
  GET as resultGet,
  POST as resultPost,
} from "../app/api/ops/workspace-results/route";
import { GET as adminGet } from "../app/api/admin/workspace/route";

const tokens = {
  read: "workspace-read-test-credential-12345678901234567890",
  write: "workspace-write-test-credential-1234567890123456789",
  portal: "portal-only-test-credential-1234567890123456789012",
  unknown: "unknown-test-credential-12345678901234567890123456",
};
const valid = {
  run_key: "daily:2026-11-06:v1",
  kind: "daily_brief",
  title: "Today’s priorities",
  summary: "Review the diary and client replies.",
  body: "Three items need a human review. Nothing was sent.",
  outcome: "partial",
  coverage: "Drive and calendar checked; accounting not connected.",
  observed_at: "2026-11-06T09:00:00Z",
  links: [
    {
      label: "Private source",
      url: "https://docs.google.com/document/d/example/edit",
    },
  ],
};
const request = (token?: string, body?: unknown) =>
  new Request("https://preview.invalid/api/ops/workspace-results", {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      "content-type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

beforeEach(() => {
  state.authorised = true;
  state.failures.clear();
  state.saved.clear();
  state.rows = {};
  state.calls = [];
  state.rpcCalls = [];
  state.rpcError = null;
  state.saveThenFail = false;
  state.taskRead.mockReset().mockResolvedValue([]);
  state.artifactRead.mockReset().mockResolvedValue([]);
  state.paymentRead.mockReset().mockResolvedValue([]);
  state.reportRead.mockReset().mockResolvedValue([]);
  state.env = {
    NEXT_PUBLIC_SUPABASE_URL: "https://abmmlybdqwzujcysagvf.supabase.co",
    OPS_SCOPED_TOKENS_JSON: JSON.stringify([
      {
        id: "workspace-read",
        sha256: createHash("sha256").update(tokens.read).digest("hex"),
        scopes: ["workspace:read"],
      },
      {
        id: "workspace-write",
        sha256: createHash("sha256").update(tokens.write).digest("hex"),
        scopes: ["workspace:write"],
      },
      {
        id: "portal-only",
        sha256: createHash("sha256").update(tokens.portal).digest("hex"),
        scopes: ["portal:read"],
      },
    ]),
  };
});

describe("workspace partial-source coverage", () => {
  it("keeps healthy-source work while exposing failed message and training checks", async () => {
    state.rows.client_profiles = [
      {
        id: "c1",
        user: { full_name: "Example Client" },
        last_login: "2026-09-01",
        last_checkin: "2026-09-01",
      },
    ];
    state.rows.checkins = [
      {
        id: "check1",
        client_id: "c1",
        created_at: "2026-11-05",
        admin_reply: null,
      },
    ];
    state.failures.add("inbox_messages");
    state.failures.add("client_modules");
    state.artifactRead.mockResolvedValue([
      {
        id: "a1",
        kind: "content",
        status: "draft",
        version: 1,
        title: "Review real carousel",
        updated_at: "2026-11-06",
      } as OpsArtifact,
    ]);
    const result = await getWorkspace();
    expect(result.checks.find((c) => c.key === "messages")).toMatchObject({
      ok: false,
      count: null,
    });
    expect(result.checks.find((c) => c.key === "training")).toMatchObject({
      ok: false,
      count: null,
    });
    expect(result.checks.find((c) => c.key === "checkins")).toMatchObject({
      ok: true,
      count: 1,
    });
    expect(result.cards.some((c) => c.id === "artifact:a1")).toBe(true);
    expect(result.cards.some((c) => c.detail.includes("check-in"))).toBe(true);
    expect(
      result.cards.some((c) => c.detail.includes("No recorded visit")),
    ).toBe(false);
    expect(result.scheduler).toBe("not_verified");
    expect(Object.values(result.controls).every((v) => v === false)).toBe(true);
  });
  it("distinguishes an unavailable task store from an empty healthy source", async () => {
    state.taskRead.mockRejectedValue(new Error("Task database unavailable"));
    const result = await getWorkspace();
    expect(result.tasks).toEqual([]);
    expect(result.checks.find((c) => c.key === "tasks")).toMatchObject({
      ok: false,
      count: null,
    });
    expect(result.checks.find((c) => c.key === "payments")).toMatchObject({
      ok: true,
      count: 0,
    });
  });
  it("reads the second page of client records and suppresses archived clients", async () => {
    state.rows.client_profiles = Array.from({ length: 1002 }, (_, i) => ({
      id: `c${String(i).padStart(4, "0")}`,
      archived_at: i === 1001 ? "2026-11-01" : null,
      user: { full_name: `Example ${i}` },
      last_login: "2026-11-06",
      last_checkin: "2026-11-06",
    }));
    const result = await getWorkspace();
    expect(result.checks.find((c) => c.key === "clients")).toMatchObject({
      ok: true,
      count: 1001,
    });
    expect(state.calls.filter((c) => c.table === "client_profiles")).toEqual([
      { table: "client_profiles", start: 0, end: 999 },
      { table: "client_profiles", start: 1000, end: 1999 },
    ]);
  });
  it("authenticates the admin route before reading any workspace data", async () => {
    state.authorised = false;
    const response = await adminGet();
    expect(response.status).toBe(401);
    expect(state.calls).toEqual([]);
    expect(state.taskRead).not.toHaveBeenCalled();
  });
});

describe("scoped workspace result routes", () => {
  it.each([undefined, tokens.unknown])(
    "rejects unauthenticated or unknown reads before accessing the database",
    async (token) => {
      expect((await resultGet(request(token))).status).toBe(401);
      expect(state.calls).toEqual([]);
    },
  );
  it("keeps source-reading and result-writing permissions separate", async () => {
    expect((await resultGet(request(tokens.portal))).status).toBe(403);
    expect((await resultPost(request(tokens.read, valid))).status).toBe(403);
    expect((await resultGet(request(tokens.write))).status).toBe(403);
    expect(state.calls).toEqual([]);
    expect(state.rpcCalls).toEqual([]);
  });
  it("allows a read-only connection to inspect results without performing a mutation", async () => {
    expect((await resultGet(request(tokens.read))).status).toBe(200);
    expect(state.rpcCalls).toEqual([]);
  });
  it("can read back an exact older result without depending on the latest-five list", async () => {
    const id = "00000000-0000-4000-8000-000000000123";
    state.rows.ops_workspace_results = [
      { ...valid, id, received_at: "2026-11-06T09:01:00Z" },
    ];
    const r = await resultGet(
      new Request(
        `https://preview.invalid/api/ops/workspace-results?id=${id}`,
        { headers: { authorization: `Bearer ${tokens.read}` } },
      ),
    );
    expect(r.status).toBe(200);
    expect((await r.json()).result.id).toBe(id);
  });
  it("does not grant writes or expose unknown records via exact-id readback", async () => {
    const id = "00000000-0000-4000-8000-000000000124";
    expect(
      (
        await resultGet(
          new Request(
            `https://preview.invalid/api/ops/workspace-results?id=${id}`,
            { headers: { authorization: `Bearer ${tokens.read}` } },
          ),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await resultGet(
          new Request(
            `https://preview.invalid/api/ops/workspace-results?id=${id}`,
            { headers: { authorization: `Bearer ${tokens.write}` } },
          ),
        )
      ).status,
    ).toBe(403);
  });
  it("allows only validated unapproved result payloads through the write connection", async () => {
    expect(
      (await resultPost(request(tokens.write, { ...valid, approved: true })))
        .status,
    ).toBe(400);
    expect(state.rpcCalls).toEqual([]);
    const response = await resultPost(request(tokens.write, valid));
    expect(response.status).toBe(200);
    expect(state.rpcCalls[0]).toMatchObject({
      name: "ops_submit_workspace_result",
      args: { p_actor: "integration:workspace-write" },
    });
    expect((await response.json()).result).toMatchObject({
      outcome: "partial",
      run_key: valid.run_key,
    });
  });
  it("rejects malformed JSON and oversized handoffs without a write", async () => {
    const headers = {
      authorization: `Bearer ${tokens.write}`,
      "content-type": "application/json",
    };
    expect(
      (
        await resultPost(
          new Request("https://preview.invalid/api/ops/workspace-results", {
            method: "POST",
            headers,
            body: "{",
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await resultPost(
          request(tokens.write, { ...valid, body: "x".repeat(70000) }),
        )
      ).status,
    ).toBe(413);
    expect(state.rpcCalls).toEqual([]);
  });
});

describe("immutable result persistence and recovery", () => {
  it("uses a canonical hash so identical retries return the same saved row", async () => {
    const first = await submitWorkspaceResult(
      valid,
      "integration:workspace-write",
    );
    const replay = await submitWorkspaceResult(
      { ...valid, title: ` ${valid.title} ` },
      "integration:workspace-write",
    );
    expect(replay.id).toBe(first.id);
    expect(state.saved.size).toBe(1);
    expect(state.rpcCalls[0].args.p_hash).toBe(
      createHash("sha256")
        .update(canonicalJson(validateWorkspaceResult(valid)))
        .digest("hex"),
    );
  });
  it("rejects changed content or another credential reusing the same run key", async () => {
    await submitWorkspaceResult(valid, "integration:workspace-write");
    await expect(
      submitWorkspaceResult(
        { ...valid, summary: "Changed meaning" },
        "integration:workspace-write",
      ),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      submitWorkspaceResult(valid, "integration:another-writer"),
    ).rejects.toMatchObject({ status: 409 });
    expect(state.saved.size).toBe(1);
    expect(state.saved.get(valid.run_key)?.summary).toBe(valid.summary);
  });
  it("returns an uncertain service failure rather than encouraging a new key after a lost readback", async () => {
    state.saveThenFail = true;
    await expect(
      submitWorkspaceResult(valid, "integration:workspace-write"),
    ).rejects.toMatchObject({ status: 503 });
    expect(state.saved.size).toBe(1);
    const replay = await submitWorkspaceResult(
      valid,
      "integration:workspace-write",
    );
    expect(replay.id).toBe("result-1");
    expect(state.saved.size).toBe(1);
  });
  it("does not describe an unrelated database failure as a content conflict", async () => {
    state.rpcError = { code: "08006", message: "Database unavailable" };
    await expect(
      submitWorkspaceResult(valid, "integration:workspace-write"),
    ).rejects.toMatchObject({ status: 503 });
    expect(state.saved.size).toBe(0);
  });
});

describe("latest result failure visibility", () => {
  it("shows a newer failed check ahead of an older success, even when the old result was imported later", async () => {
    state.rows.ops_workspace_results = [
      {
        ...valid,
        id: "old-success",
        outcome: "complete",
        observed_at: "2026-11-05T09:00:00Z",
        received_at: "2026-11-06T13:10:00Z",
      },
      {
        ...valid,
        id: "new-failure",
        outcome: "failed",
        observed_at: "2026-11-06T09:00:00Z",
        received_at: "2026-11-06T09:01:00Z",
      },
    ];
    const rows = await listWorkspaceResults();
    expect(rows.find((r) => r.kind === "daily_brief")).toMatchObject({
      id: "new-failure",
      outcome: "failed",
    });
  });
  it("keeps the latest result for every job when another job has many results", async () => {
    state.rows.ops_workspace_results = [
      ...Array.from({ length: 20 }, (_, i) => ({
        ...valid,
        id: `daily-${i}`,
        observed_at: `2026-11-${String(i + 1).padStart(2, "0")}T09:00:00Z`,
        received_at: "2026-11-06T09:01:00Z",
      })),
      {
        ...valid,
        id: "weekly-1",
        kind: "weekly_report",
        observed_at: "2026-10-29T09:00:00Z",
        received_at: "2026-10-29T09:01:00Z",
      },
    ];
    const rows = await listWorkspaceResults();
    expect(rows.filter((r) => r.kind === "daily_brief")).toHaveLength(5);
    expect(rows.find((r) => r.kind === "weekly_report")?.id).toBe("weekly-1");
  });
});
