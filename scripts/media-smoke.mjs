import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
assert.match(process.env.NEXT_PUBLIC_SUPABASE_URL, /abmmlybdqwzujcysagvf/);
const proof = JSON.parse(
    (
      await readFile(
        "/Volumes/CodexDev/Projects/cbb-ops-build/evidence/f-smoke.json",
        "utf8",
      )
    )
      .trim()
      .split("\n")
      .at(-1),
  ),
  base = "http://127.0.0.1:3087",
  db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  ),
  account = JSON.parse(
    await readFile(
      "/Volumes/CodexDev/Projects/cbb-ops-build/.test-account.json",
      "utf8",
    ),
  );
async function login(email, password) {
  const cookies = [];
  const auth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookies,
        setAll: (xs) => {
          for (const x of xs) {
            const i = cookies.findIndex((c) => c.name === x.name);
            if (i < 0) cookies.push(x);
            else cookies[i] = x;
          }
        },
      },
    },
  );
  assert.equal(
    (await auth.auth.signInWithPassword({ email, password })).error,
    null,
  );
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}
const adminCookie = await login(account.email, account.password),
  profile = await db
    .from("client_profiles")
    .select("user_id,users(email)")
    .eq("id", process.env.OPS_SMOKE_CLIENT_ID)
    .single();
assert.equal(profile.error, null);
assert.equal(profile.data.users.email, "cbb-ops-client@example.invalid");
const password = randomBytes(24).toString("base64url");
assert.equal(
  (await db.auth.admin.updateUserById(profile.data.user_id, { password }))
    .error,
  null,
);
const clientCookie = await login(profile.data.users.email, password),
  path = base + "/api/media/lesson/" + proof.recordingId;
assert.equal((await fetch(path, { redirect: "manual" })).status, 401);
assert.equal(
  (await fetch(path, { headers: { cookie: adminCookie }, redirect: "manual" }))
    .status,
  302,
);
assert.equal(
  (await fetch(path, { headers: { cookie: clientCookie }, redirect: "manual" }))
    .status,
  403,
);
const draftModule = await db
  .from("training_modules")
  .select("*")
  .eq("id", proof.moduleId)
  .single();
assert.equal(draftModule.error, null);
assert.equal(draftModule.data.is_published, false);
assert.match(draftModule.data.title, /Ops fixture/);
try {
  const r = await fetch(base + "/api/admin/training/modules", {
    method: "PUT",
    headers: { cookie: adminCookie, "content-type": "application/json" },
    body: JSON.stringify({
      id: proof.moduleId,
      title: "Call replay — Ops fixture",
      is_published: true,
    }),
  });
  assert.equal(r.status, 200, await r.text());
  const lesson = await db
    .from("lesson_recordings")
    .select("status")
    .eq("id", proof.recordingId)
    .single();
  assert.equal(lesson.data.status, "published");
  const response = await fetch(path, {
    headers: { cookie: clientCookie },
    redirect: "manual",
  });
  assert.equal(response.status, 302);
  const range = await fetch(response.headers.get("location"), {
    headers: { Range: "bytes=0-1023" },
  });
  assert.equal(range.status, 206);
  assert.equal((await range.arrayBuffer()).byteLength, 1024);
  const task = await db
    .from("ops_tasks")
    .select("status")
    .eq("external_ref", "lesson-publish:" + proof.recordingId)
    .single();
  assert.equal(task.data.status, "done");
  const training = await fetch(base + "/api/admin/training", {
    headers: { cookie: adminCookie },
  });
  assert.equal(training.status, 200);
  assert.ok(
    (await training.json()).modules.some(
      (m) =>
        m.id === proof.moduleId &&
        m.content.some((c) => c.id === proof.contentId),
    ),
  );
} finally {
  const restored = await db
    .from("training_modules")
    .update({ title: draftModule.data.title, is_published: false })
    .eq("id", proof.moduleId);
  assert.equal(restored.error, null);
}
assert.equal(
  (await fetch(path, { headers: { cookie: clientCookie }, redirect: "manual" }))
    .status,
  403,
);
console.log(
  JSON.stringify({
    pass: true,
    checks: [
      "anonymous 401",
      "admin 302",
      "client denied draft",
      "existing admin publication sync",
      "assigned/global module client 302",
      "signed MP4 byte-range 206",
      "admin training content visible",
      "publish task completed",
      "unpublish restored, client 403",
    ],
  }),
);
