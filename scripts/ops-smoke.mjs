import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
const base = process.env.OPS_BASE_URL || "http://127.0.0.1:3087",
  token = process.env.OPS_API_TOKEN;
assert.match(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  /abmmlybdqwzujcysagvf/,
  "Non-live only",
);
assert.ok(token);
const headers = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  },
  checks = [];
async function call(path, method = "GET", body) {
  assert.equal(
    (
      await fetch(base + path, {
        method,
        headers: { "content-type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
    ).status,
    401,
    path + " unauth",
  );
  const r = await fetch(base + path, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const d = await r.json();
  assert.ok(r.ok, JSON.stringify(d));
  checks.push(method + " " + path);
  return d;
}
const ref = "token-smoke:" + Date.now(),
  { task } = await call("/api/ops/tasks", "POST", {
    kind: "approval",
    title: "Token smoke approval",
    area: "other",
    external_ref: ref,
  });
assert.equal(
  (
    await call("/api/ops/tasks", "POST", {
      kind: "approval",
      title: "Token smoke approval",
      area: "other",
      external_ref: ref,
    })
  ).task.id,
  task.id,
);
await call("/api/ops/tasks");
await call("/api/ops/tasks/" + task.id, "PATCH", { assignee: "flowstate" });
await call("/api/ops/tasks/" + task.id, "POST", {
  decision: "approved",
  note: "Smoke check",
});
const clientId = process.env.OPS_SMOKE_CLIENT_ID,
  lessonId = process.env.OPS_SMOKE_LESSON_ID,
  jobId = process.env.OPS_SMOKE_JOB_ID;
const domain = process.env.OPS_SMOKE_DOMAIN === "true";
if (domain) {
  assert.ok(clientId && lessonId && jobId, "Fixture IDs required");
  await call("/api/ops/clients");
  await call("/api/ops/clients/" + clientId);
  await call("/api/ops/clients/" + clientId + "/onboarding", "POST", {
    stage: "invited",
  });
  await call("/api/ops/lessons");
  await call("/api/ops/lessons/" + lessonId);
  await call("/api/ops/render-jobs/" + jobId, "PATCH", {
    status: "running",
    progress: 10,
  });
  await call("/api/ops/reports");
  await call("/api/ops/reports", "POST", {});
}
assert.equal(
  (
    await fetch(base + "/api/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    })
  ).status,
  401,
);
const client = new Client({ name: "cbb-ops-smoke", version: "1.0.0" });
const transport = new StreamableHTTPClientTransport(
  new URL(base + "/api/mcp"),
  { requestInit: { headers } },
);
try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  const args = {
    create_task: {
      title: "MCP smoke work",
      area: "other",
      external_ref: ref + ":mcp",
    },
    list_tasks: {},
    update_task: { id: task.id, updates: { assignee: "eimear" } },
    request_approval: {
      title: "MCP review",
      area: "content",
      external_ref: ref + ":approval",
    },
    attach_output: {
      id: task.id,
      output: {
        label: "Fixture document",
        url: "https://example.com/fixture",
        type: "doc",
      },
    },
    get_client: { id: clientId },
    list_clients_needing_attention: {},
    get_lesson: { id: lessonId },
    list_lessons: {},
    propose_lesson_cuts: { id: lessonId, cuts: [] },
    create_report_draft: {},
    update_client_onboarding: { id: clientId, stage: "invited" },
  };
  let reportForMcp;
  for (const tool of tools) {
    assert.ok(tool.inputSchema);
    if (
      !domain &&
      ![
        "create_task",
        "list_tasks",
        "update_task",
        "request_approval",
        "attach_output",
      ].includes(tool.name)
    )
      continue;
    if (tool.name === "get_report") args[tool.name] = { id: reportForMcp.id };
    if (tool.name === "submit_report_draft")
      args[tool.name] = {
        id: reportForMcp.id,
        expected_updated_at: reportForMcp.updated_at,
        narrative_md: "Synthetic Codex handoff check — not for delivery.",
      };
    assert.ok(args[tool.name], tool.name);
    const r = await client.callTool({
      name: tool.name,
      arguments: args[tool.name],
    });
    const guarded =
      (tool.name === "propose_lesson_cuts" &&
        process.env.OPS_LEGACY_LESSON_PIPELINE_ENABLED !== "true") ||
      (tool.name === "submit_report_draft" &&
        (reportForMcp.status !== "draft" ||
          reportForMcp.send_claim_id ||
          (reportForMcp.narrative_md &&
            reportForMcp.narrative_md !==
              reportForMcp.generated_narrative_md)));
    assert.equal(
      Boolean(r.isError),
      Boolean(guarded),
      tool.name + ": " + JSON.stringify(r),
    );
    if (["create_report_draft", "get_report"].includes(tool.name))
      reportForMcp = JSON.parse(r.content.find((c) => c.type === "text").text);
    checks.push("MCP " + tool.name);
  }
} finally {
  await client.close();
}
console.log(JSON.stringify({ pass: true, domain, checks }));
