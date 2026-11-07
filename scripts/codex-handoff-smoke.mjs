import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

assert.equal(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  "https://abmmlybdqwzujcysagvf.supabase.co",
  "Non-live fixture database only",
);
assert.equal(process.env.OPS_REPORT_SEND_ENABLED, "false");
assert.equal(process.env.OPS_NOTIFICATIONS_ENABLED, "false");
const base = process.env.OPS_BASE_URL || "http://127.0.0.1:3087";
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const headers = {
  authorization: `Bearer ${process.env.OPS_API_TOKEN}`,
  "content-type": "application/json",
};
const client = new Client({
  name: "cbb-codex-handoff-check",
  version: "1.0.0",
});
let fixture;
try {
  const result = await db
    .from("ops_reports")
    .insert({
      week_start: "2098-12-01",
      status: "draft",
      data: { fixture: true },
      narrative_md: "",
      generated_narrative_md: "",
    })
    .select()
    .single();
  assert.equal(result.error, null, "Dedicated fixture date must be unused");
  fixture = result.data;
  const path = `${base}/api/ops/reports/${fixture.id}`;
  assert.equal((await fetch(path)).status, 401);
  await client.connect(
    new StreamableHTTPClientTransport(new URL(`${base}/api/mcp`), {
      requestInit: { headers },
    }),
  );
  const tools = (await client.listTools()).tools;
  assert.ok(tools.some((t) => t.name === "get_report"));
  assert.ok(tools.some((t) => t.name === "submit_report_draft"));
  const read = await client.callTool({
    name: "get_report",
    arguments: { id: fixture.id },
  });
  assert.ok(!read.isError);
  const report = JSON.parse(read.content.find((c) => c.type === "text").text);
  assert.equal(report.narrative_md, "");
  const submit = await client.callTool({
    name: "submit_report_draft",
    arguments: {
      id: fixture.id,
      expected_updated_at: report.updated_at,
      narrative_md: "Synthetic Codex report for human review.",
    },
  });
  assert.ok(!submit.isError, JSON.stringify(submit));
  const saved = (await (await fetch(path, { headers })).json()).report;
  assert.equal(saved.narrative_md, "Synthetic Codex report for human review.");
  assert.equal(saved.status, "draft");
  assert.equal(saved.reviewed_by, null);
  assert.equal(saved.sent_at, null);
  const stale = await fetch(path, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      expected_updated_at: report.updated_at,
      narrative_md: "Stale replacement",
    }),
  });
  assert.equal(stale.status, 409);
  const forbidden = await fetch(path, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      expected_updated_at: saved.updated_at,
      narrative_md: "Prepared",
      action: "send",
    }),
  });
  assert.equal(forbidden.status, 400);
  const legacy = await fetch(
    `${base}/api/ops/lessons/11111111-1111-4111-8111-111111111111`,
    { method: "POST", headers, body: JSON.stringify({ action: "ingest" }) },
  );
  assert.equal(legacy.status, 409);
  assert.match((await legacy.json()).error, /not enabled/);
  console.log(
    JSON.stringify({
      pass: true,
      tools: tools.length,
      checks: [
        "unauthenticated read denied",
        "MCP get_report",
        "MCP submit_report_draft",
        "REST saved-text readback",
        "unapproved and unsent",
        "stale replacement rejected",
        "send instruction rejected",
        "legacy worker disabled",
      ],
    }),
  );
} finally {
  await client.close();
  if (fixture) {
    const removed = await db
      .from("ops_reports")
      .delete()
      .eq("id", fixture.id)
      .eq("week_start", "2098-12-01");
    assert.equal(removed.error, null);
  }
}
