import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { transformSync } from "esbuild";
import { describe, expect, it, vi } from "vitest";
const nativeRequire = createRequire(import.meta.url);
type Fn = (...args: unknown[]) => unknown;
class OpsError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
const helpers = {
  OpsError,
  record: (v: unknown) => {
    if (!v || typeof v !== "object" || Array.isArray(v))
      throw new OpsError("JSON object required");
    return v;
  },
};
function load(path: string, dependencies: Record<string, unknown>) {
  const code = transformSync(
    readFileSync(new URL(path, import.meta.url), "utf8"),
    { loader: "ts", format: "cjs", target: "es2022" },
  ).code;
  const m = { exports: {} as Record<string, Fn> };
  new Function("require", "module", "exports", code)(
    (name: string) => {
      if (name in dependencies) return dependencies[name];
      if (name.startsWith("node:") || name === "zod")
        return nativeRequire(name);
      throw Error(`Unexpected dependency: ${name}`);
    },
    m,
    m.exports,
  );
  return m.exports;
}
function harness() {
  const tokens = {
    report: "report-test-secret-token-12345678901234567890",
    task: "task-test-secret-token-123456789012345678901",
    artifact: "artifact-test-secret-token-1234567890123456789",
    legacy: "legacy-test-secret-token-1234567890123456789",
    portal: "portal-test-secret-token-1234567890123456789",
  };
  const scopeConfig = JSON.stringify([
    {
      id: "report",
      sha256: createHash("sha256").update(tokens.report).digest("hex"),
      scopes: ["reports:read"],
    },
    {
      id: "task",
      sha256: createHash("sha256").update(tokens.task).digest("hex"),
      scopes: ["tasks:write"],
    },
    {
      id: "artifact",
      sha256: createHash("sha256").update(tokens.artifact).digest("hex"),
      scopes: ["artifacts:read", "artifacts:write"],
    },
    {
      id: "portal",
      sha256: createHash("sha256").update(tokens.portal).digest("hex"),
      scopes: ["portal:read"],
    },
  ]);
  const env = {
    getEnv: (name: string) =>
      name === "OPS_API_TOKEN"
        ? tokens.legacy
        : name === "OPS_SCOPED_TOKENS_JSON"
          ? scopeConfig
          : undefined,
  };
  const scoped = load("../lib/ops/scoped-auth.ts", {
    "@/lib/env": env,
    "@/lib/rate-limit": { rateLimit: () => ({ success: true }) },
    "./tasks": helpers,
  });
  const access = load("../lib/ops/action-access.ts", {
    "@/lib/env": env,
    "./scoped-auth": scoped,
    "./tasks": helpers,
    "./auth": {
      secretMatches: (a: unknown, b: unknown) => a === b,
      requireOps: vi.fn(),
    },
  });
  const mutations = {
    createTask: vi.fn(async (input: unknown) => input),
    updateTask: vi.fn(async () => ({})),
    attachOutput: vi.fn(async () => ({})),
    completeTask: vi.fn(async () => ({})),
    decideTask: vi.fn(async () => ({})),
  };
  const dependencies: Record<string, unknown> = {
    "@/lib/ops/action-access": access,
    "@/lib/ops/scoped-auth": scoped,
    "@/lib/ops/tasks": {
      ...helpers,
      ...mutations,
      listTasks: vi.fn(async () => []),
    },
    "@/lib/ops/http": {
      respond: async (fn: () => Promise<unknown>) => {
        try {
          return Response.json(await fn());
        } catch (e) {
          return Response.json(
            { error: (e as Error).message },
            { status: e instanceof OpsError ? e.status : 500 },
          );
        }
      },
      taskFilters: () => ({}),
    },
  };
  const request = (token: keyof typeof tokens, body: unknown) =>
    new Request("http://localhost/api", {
      method: "POST",
      headers: {
        authorization: `Bearer ${tokens[token]}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  return { tokens, access, mutations, dependencies, request };
}

describe("narrow task preparation", () => {
  it("returns saved review notes only to an artifact reader", async () => {
    const h = harness();
    const decision = {
      artifact_id: "artifact-id",
      version: 2,
      manifest_hash: "a".repeat(64),
      decision: "rejected",
      note: "Use the updated lesson title.",
      created_at: "2026-11-05T22:00:00Z",
    };
    const history = vi.fn(async () => [decision]);
    const route = load("../app/api/ops/artifacts/[id]/route.ts", {
      ...h.dependencies,
      "@/lib/ops/actions": {
        getArtifact: vi.fn(async () => ({ id: "artifact-id" })),
        listArtifactItems: vi.fn(async () => []),
        getArtifactHistory: history,
      },
    });
    const context = { params: Promise.resolve({ id: "artifact-id" }) };
    const denied = (await route.GET(
      h.request("report", {}),
      context,
    )) as Response;
    expect(denied.status).toBe(403);
    expect(history).not.toHaveBeenCalled();
    const allowed = (await route.GET(
      h.request("artifact", {}),
      context,
    )) as Response;
    expect(allowed.status).toBe(200);
    expect((await allowed.json()).decisions).toEqual([decision]);
  });
  it("refuses completion, decisions, source impersonation and result replacement", () => {
    const h = harness();
    for (const body of [
      { status: "done" },
      { status: "approved" },
      { kind: "task" },
      { outputs: [] },
      { decision_note: "done" },
    ])
      expect(() => h.access.scopedTaskInput(body)).toThrow("cannot decide");
    for (const body of [
      { title: "x", status: "done" },
      { title: "x", source: "human" },
    ])
      expect(() => h.access.scopedTaskInput(body, true)).toThrow();
    expect(
      h.access.scopedTaskInput(
        {
          title: "Review draft",
          kind: "approval",
          status: "awaiting_approval",
        },
        true,
      ),
    ).toMatchObject({ source: "ai", status: "awaiting_approval" });
  });
  it("REST refuses a scoped completion or forged decision before any mutation", async () => {
    const h = harness(),
      route = load("../app/api/ops/tasks/[id]/route.ts", h.dependencies),
      context = { params: Promise.resolve({ id: "task-id" }) };
    const patch = (await route.PATCH(
      h.request("task", { status: "done" }),
      context,
    )) as Response;
    const decide = (await route.POST(
      h.request("task", { decision: "approved", note: "" }),
      context,
    )) as Response;
    expect(patch.status).toBe(403);
    expect(decide.status).toBe(403);
    expect(h.mutations.completeTask).not.toHaveBeenCalled();
    expect(h.mutations.decideTask).not.toHaveBeenCalled();
    expect(h.mutations.updateTask).not.toHaveBeenCalled();
    const append = (await route.POST(
      h.request("task", {
        output: { label: "Draft", url: "https://example.com/draft" },
      }),
      context,
    )) as Response;
    expect(append.status).toBe(200);
    expect(h.mutations.attachOutput).toHaveBeenCalledOnce();
  });
  it("preserves explicitly configured legacy operations separately", async () => {
    const h = harness(),
      route = load("../app/api/ops/tasks/[id]/route.ts", h.dependencies);
    const response = (await route.PATCH(
      h.request("legacy", { status: "done" }),
      { params: Promise.resolve({ id: "task-id" }) },
    )) as Response;
    expect(response.status).toBe(200);
    expect(h.mutations.completeTask).toHaveBeenCalledOnce();
  });
});

describe("per-request MCP scope visibility", () => {
  function mcpHarness() {
    const h = harness();
    type Registered = {
      schema: { parse: (input: unknown) => unknown };
      run: Fn;
    };
    const route = load("../app/api/mcp/route.ts", {
      ...h.dependencies,
      "mcp-handler": {
        createMcpHandler: (
          setup: (server: {
            registerTool: (
              name: string,
              definition: {
                inputSchema: { parse: (input: unknown) => unknown };
              },
              run: Fn,
            ) => void;
          }) => void,
        ) => {
          const tools = new Map<string, Registered>();
          setup({
            registerTool: (name, definition, run) =>
              tools.set(name, { schema: definition.inputSchema, run }),
          });
          return async (request: Request) => {
            const body = await request.json();
            if (body.method === "tools/list")
              return Response.json({ tools: [...tools.keys()] });
            const tool = tools.get(body.name);
            if (!tool)
              return Response.json(
                { error: "Tool unavailable" },
                { status: 404 },
              );
            try {
              return Response.json(
                await tool.run(tool.schema.parse(body.arguments)),
              );
            } catch (e) {
              return Response.json(
                { error: (e as Error).message },
                { status: 400 },
              );
            }
          };
        },
      },
      "@/lib/ops/types": {
        areas: ["content", "reporting"],
        assignees: ["marc", "eimear"],
        statuses: ["open", "approved", "done"],
      },
      "@/lib/ops/clients": {
        getClient: vi.fn(),
        listClientsNeedingAttention: vi.fn(),
      },
      "@/lib/ops/lessons": {
        getLesson: vi.fn(),
        listLessons: vi.fn(),
        proposeCuts: vi.fn(),
      },
      "@/lib/ops/reports": {
        createReportDraft: vi.fn(),
        getReport: vi.fn(async () => ({ status: "draft" })),
        submitReportDraft: vi.fn(),
      },
      "@/lib/ops/onboarding": {
        updateClientSignals: vi.fn(),
        onboardingStages: ["invited"],
      },
      "@/lib/ops/portal-monitor": {
        listPortalClients: vi.fn(async () => ({ clients: [], coverage: { end_of_collection: true } })),
        readPortalCollection: vi.fn(async () => ({ items: [], coverage: { end_of_collection: true } })),
      },
      "@/lib/ops/actions": {
        listArtifacts: vi.fn(async () => []),
        getArtifact: vi.fn(async () => ({
          id: "11111111-1111-4111-8111-111111111111",
          version: 1,
        })),
        listArtifactItems: vi.fn(async () => []),
        getArtifactHistory: vi.fn(async () => [
          {
            decision: "rejected",
            note: "Use the updated image.",
            version: 1,
            created_at: "2026-11-05T22:00:00Z",
          },
        ]),
        submitArtifact: vi.fn(),
      },
    });
    return { ...h, route };
  }
  it("advertises only tools granted to each concurrent request", async () => {
    const h = mcpHarness();
    const responses = (await Promise.all([
      h.route.POST(h.request("report", { method: "tools/list" })),
      h.route.POST(h.request("artifact", { method: "tools/list" })),
    ])) as Response[];
    expect(await responses[0].json()).toEqual({ tools: ["get_report"] });
    expect(await responses[1].json()).toEqual({
      tools: ["list_artifacts", "get_artifact", "submit_artifact"],
    });
    const forbidden = (await h.route.POST(
      h.request("report", {
        method: "tools/call",
        name: "create_report_draft",
        arguments: {},
      }),
    )) as Response;
    expect(forbidden.status).toBe(404);
  });
  it("never offers lifecycle/provider mutations to a tasks writer", async () => {
    const h = mcpHarness(),
      response = (await h.route.POST(
        h.request("task", { method: "tools/list" }),
      )) as Response;
    expect(await response.json()).toEqual({
      tools: [
        "create_task",
        "update_task",
        "request_approval",
        "attach_output",
      ],
    });
    const completion = (await h.route.POST(
      h.request("task", {
        method: "tools/call",
        name: "update_task",
        arguments: {
          id: "11111111-1111-4111-8111-111111111111",
          updates: { status: "done" },
        },
      }),
    )) as Response;
    expect(completion.status).toBe(400);
    expect(h.mutations.updateTask).not.toHaveBeenCalled();
  });
  it("offers only the two read tools to a portal reader", async () => {
    const h = mcpHarness();
    const response = await h.route.POST(h.request("portal", { method: "tools/list" })) as Response;
    expect(await response.json()).toEqual({
      tools: ["list_portal_clients", "read_portal_client_collection"],
    });
    const result = await h.route.POST(h.request("portal", {
      method: "tools/call", name: "read_portal_client_collection",
      arguments: { id: "11111111-1111-4111-8111-111111111111", collection: "messages", limit: 100 },
    })) as Response;
    const payload = await result.json();
    expect(JSON.parse(payload.content[0].text)).toEqual({ items: [], coverage: { end_of_collection: true } });
    const denied = await h.route.POST(h.request("portal", {
      method: "tools/call", name: "create_task", arguments: {},
    })) as Response;
    expect(denied.status).toBe(404);
  });
  it("returns saved review feedback through permitted MCP artifact detail", async () => {
    const h = mcpHarness();
    const response = (await h.route.POST(
      h.request("artifact", {
        method: "tools/call",
        name: "get_artifact",
        arguments: { id: "11111111-1111-4111-8111-111111111111" },
      }),
    )) as Response;
    const result = await response.json();
    const detail = JSON.parse(result.content[0].text);
    expect(detail.decisions).toEqual([
      expect.objectContaining({
        decision: "rejected",
        note: "Use the updated image.",
        version: 1,
        created_at: "2026-11-05T22:00:00Z",
      }),
    ]);
  });
});
