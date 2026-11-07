import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
assert.equal(
  new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,
  "abmmlybdqwzujcysagvf.supabase.co",
);
const base = process.env.OPS_BASE_URL || "http://127.0.0.1:3089";
assert.ok(
  new URL(base).hostname === "127.0.0.1" ||
    new URL(base).hostname.startsWith("marc-watters-site-"),
);
const account = JSON.parse(
  await readFile(process.env.OPS_TEST_ACCOUNT, "utf8"),
);
const credential = JSON.parse(
  await readFile(process.env.OPS_SCOPED_CREDENTIAL, "utf8"),
);
const jar = [];
const auth = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    cookies: {
      getAll: () => jar,
      setAll: (xs) => {
        for (const x of xs) {
          const i = jar.findIndex((c) => c.name === x.name);
          if (i < 0) jar.push(x);
          else jar[i] = x;
        }
      },
    },
  },
);
const signin = await auth.auth.signInWithPassword(account);
assert.equal(signin.error, null);
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const check = [];
async function call(
  path,
  body,
  mode = "admin",
  method = body ? "POST" : "GET",
) {
  const headers = { "Content-Type": "application/json" };
  if (mode === "admin")
    headers.cookie = jar.map((c) => `${c.name}=${c.value}`).join("; ");
  if (mode === "scoped") headers.authorization = `Bearer ${credential.token}`;
  const r = await fetch(base + path, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, data: await r.json() };
}
const fail = (s) => assert.equal(s.status, 200, JSON.stringify(s.data));
const resultKey = `qa-workspace:${randomUUID()}`;
let resultId;
const messageIds = [];
const artifactIds = [];
try {
  assert.equal((await call("/api/admin/workspace", null, "none")).status, 401);
  assert.equal(
    (await call("/api/ops/workspace-results", null, "none")).status,
    401,
  );
  const initial = await call("/api/admin/workspace");
  fail(initial);
  assert.equal(initial.data.mode, "preview");
  assert.ok(
    initial.data.checks.every((c) => c.ok),
    JSON.stringify(initial.data.checks),
  );
  assert.ok(Object.values(initial.data.controls).every((v) => v === false));
  check.push(
    "all ten sources read; outbound controls false; admin authentication",
  );
  const body = {
    run_key: resultKey,
    kind: "portal_check",
    title: "Synthetic handoff acceptance",
    summary: "Test record only",
    body: "This temporary result checks persistence, duplicate handling and failure visibility.",
    outcome: "partial",
    coverage: "Synthetic isolated preview; not a live-client check",
    observed_at: new Date().toISOString(),
    links: [],
  };
  const saved = await call("/api/ops/workspace-results", body, "scoped");
  fail(saved);
  resultId = saved.data.result.id;
  const repeats = await Promise.all([
    call("/api/ops/workspace-results", body, "scoped"),
    call("/api/ops/workspace-results", body, "scoped"),
  ]);
  repeats.forEach((r) => {
    fail(r);
    assert.equal(r.data.result.id, resultId);
  });
  assert.equal(
    (
      await call(
        "/api/ops/workspace-results",
        { ...body, summary: "Changed content" },
        "scoped",
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await call(
        "/api/ops/workspace-results",
        { ...body, run_key: resultKey + ":bad", status: "approved" },
        "scoped",
      )
    ).status,
    400,
  );
  const read = await call(
    "/api/ops/workspace-results?id=" + resultId,
    null,
    "scoped",
  );
  fail(read);
  assert.equal(read.data.result.content_hash, saved.data.result.content_hash);
  assert.equal(
    (await call("/api/ops/payment-cases", null, "scoped")).status,
    403,
  );
  check.push(
    "concurrent duplicate-safe result save; exact readback; changed replay rejected; no approval injection; wrong scope403",
  );
  const clientId = "ceea6388-7aeb-4fb8-a4ac-afecba7f6194";
  const c = await db
    .from("client_profiles")
    .select("id,user_id,user:users!client_profiles_user_id_fkey(full_name)")
    .eq("id", clientId)
    .single();
  assert.equal(c.error, null);
  assert.equal(c.data.user.full_name, "Synthetic CBB Client");
  const now = Date.now();
  async function message(role, offset) {
    const id = randomUUID();
    const r = await db
      .from("inbox_messages")
      .insert({
        id,
        client_id: clientId,
        sender_user_id:
          role === "client" ? c.data.user_id : signin.data.user.id,
        sender_role: role,
        message: "Synthetic workspace acceptance only",
        read_by_admin: true,
        created_at: new Date(now + offset).toISOString(),
      });
    assert.equal(r.error, null);
    messageIds.push(id);
  }
  await message("client", -3000);
  let w = await call("/api/admin/workspace");
  fail(w);
  assert.ok(
    w.data.cards.some((x) => x.signal_ids?.includes(`message:${clientId}`)),
  );
  await message("admin", -2000);
  w = await call("/api/admin/workspace");
  assert.ok(
    !w.data.cards.some((x) => x.signal_ids?.includes(`message:${clientId}`)),
  );
  await message("client", -1000);
  w = await call("/api/admin/workspace");
  assert.equal(
    w.data.cards.filter((x) => x.signal_ids?.includes(`message:${clientId}`))
      .length,
    1,
  );
  check.push(
    "read message still needs reply; reply clears; new client reply reopens once",
  );
  // Clone the genuine draft into a clearly synthetic acceptance-only revision; never decide the actual artwork.
  const art = await db
    .from("ops_artifacts")
    .select("*")
    .eq("id", "be4f9d27-b643-4a01-9f20-3eb276a7240f")
    .single();
  assert.equal(art.error, null);
  const proposal = {
    external_ref: `qa-artifact:${resultKey}`,
    kind: art.data.kind,
    action: art.data.action,
    title: "Synthetic workspace approval test",
    payload: art.data.payload,
    destination: art.data.destination,
    item_keys: art.data.item_keys,
  };
  const prepared = await call("/api/ops/artifacts", proposal, "scoped");
  fail(prepared);
  const a = prepared.data.artifact;
  artifactIds.push(a.id);
  const snapshot = { version: a.version, manifest_hash: a.manifest_hash };
  const reject = await call(`/api/admin/ops/artifacts/${a.id}/decision`, {
    ...snapshot,
    decision: "rejected",
    note: "Synthetic test: revise the cover",
  });
  fail(reject);
  const revised = await call(
    "/api/ops/artifacts",
    {
      ...proposal,
      payload: { ...proposal.payload, version: a.version + 1 },
      title: "Synthetic workspace approval test — revised",
      expected_version: a.version,
      expected_manifest_hash: a.manifest_hash,
    },
    "scoped",
  );
  fail(revised);
  const b = revised.data.artifact;
  artifactIds.push(b.id);
  assert.equal(b.version, a.version + 1);
  assert.equal(b.status, "draft");
  assert.equal(
    (
      await call(`/api/admin/ops/artifacts/${a.id}/decision`, {
        ...snapshot,
        decision: "approved",
      })
    ).status,
    409,
  );
  const approve = await call(`/api/admin/ops/artifacts/${b.id}/decision`, {
    version: b.version,
    manifest_hash: b.manifest_hash,
    decision: "approved",
  });
  fail(approve);
  const execute = await call(`/api/admin/ops/artifacts/${b.id}/execute`, {
    version: b.version,
    manifest_hash: b.manifest_hash,
  });
  assert.ok([409, 403, 503].includes(execute.status));
  const unchanged = await db
    .from("ops_artifacts")
    .select("status,claim_id")
    .eq("id", b.id)
    .single();
  assert.equal(unchanged.data.status, "approved");
  assert.equal(unchanged.data.claim_id, null);
  check.push(
    "changes requested; revision demands fresh approval; stale decision rejected; approved execution blocked before claim",
  );
  const final = await db
    .from("ops_artifacts")
    .select("status")
    .eq("id", art.data.id)
    .single();
  assert.equal(final.data.status, "draft");
  check.push("real artwork remains unapproved");
  console.log(
    JSON.stringify({ pass: true, checks: check, providerActions: 0 }),
  );
  if (process.env.OPS_EVIDENCE_PATH)
    await writeFile(
      process.env.OPS_EVIDENCE_PATH,
      JSON.stringify(
        {
          pass: true,
          checked_at: new Date().toISOString(),
          checks: check,
          providerActions: 0,
        },
        null,
        2,
      ),
    );
} finally {
  if (messageIds.length) {
    const r = await db.from("inbox_messages").delete().in("id", messageIds);
    assert.equal(r.error, null);
  }
  if (artifactIds.length) {
    for (const table of ["ops_artifact_decisions", "ops_artifact_items"]) {
      const r = await db.from(table).delete().in("artifact_id", artifactIds);
      assert.equal(r.error, null);
    }
    const r = await db.from("ops_artifacts").delete().in("id", artifactIds);
    assert.equal(r.error, null);
  }
  if (resultId) {
    const r = await db
      .from("ops_workspace_results")
      .delete()
      .eq("id", resultId);
    assert.equal(r.error, null);
  }
  await auth.auth.signOut({ scope: "local" });
}
