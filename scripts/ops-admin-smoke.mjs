import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServerClient } from "@supabase/ssr";
const base = process.env.OPS_BASE_URL || "http://127.0.0.1:3087";
assert.match(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  /abmmlybdqwzujcysagvf/,
  "Run only against permitted non-live project",
);
const account = JSON.parse(
    await readFile(process.env.OPS_TEST_ACCOUNT, "utf8"),
  ),
  cookies = [];
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
const { error } = await auth.auth.signInWithPassword(account);
assert.equal(error, null);
async function call(path, method = "GET", body) {
  const r = await fetch(base + path, {
    method,
    headers: {
      cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; "),
      "content-type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const d = await r.json();
  assert.ok(r.ok, JSON.stringify(d));
  return d;
}
assert.equal((await fetch(base + "/api/admin/work")).status, 401);
const ref = "ops-smoke:" + Date.now();
const data = {
  kind: "approval",
  title: "Review synthetic lesson cuts",
  detail:
    "Synthetic fixture for the CBB work queue. Review the opening housekeeping segment.",
  area: "lessons",
  external_ref: ref,
  links: [{ label: "Lesson recordings", url: "/admin/training/recordings" }],
};
const { task } = await call("/api/admin/work", "POST", data);
assert.equal((await call("/api/admin/work", "POST", data)).task.id, task.id);
assert.equal(
  (
    await call("/api/admin/work/" + task.id, "POST", {
      decision: "approved",
      note: "Fixture approved",
    })
  ).task.status,
  "approved",
);
const rejection = (
  await call("/api/admin/work", "POST", {
    ...data,
    title: "Review draft caption",
    external_ref: ref + ":reject",
  })
).task;
assert.equal(
  (
    await call("/api/admin/work/" + rejection.id, "POST", {
      decision: "rejected",
      note: "Please add the practical example",
    })
  ).task.status,
  "rejected",
);
assert.equal(
  (await call("/api/admin/work/" + task.id, "PATCH", { status: "done" })).task
    .status,
  "done",
);
assert.ok((await call("/api/admin/work")).tasks.some((t) => t.id === task.id));
await call("/api/admin/work", "POST", {
  ...data,
  title: "Review weekly content plan",
  external_ref: "ops-ui-fixture",
  area: "content",
  due_at: new Date().toISOString(),
});
console.log(
  JSON.stringify({
    pass: true,
    checks: [
      "unauthenticated 401",
      "create",
      "idempotent repeated POST",
      "approve",
      "reject with note",
      "complete",
      "list",
    ],
    taskIds: [task.id, rejection.id],
  }),
);
