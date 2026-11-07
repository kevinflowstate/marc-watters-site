import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
assert.match(process.env.NEXT_PUBLIC_SUPABASE_URL, /abmmlybdqwzujcysagvf/);
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const original = await db
  .from("client_profiles")
  .select(
    "id,user_id,business_name,next_action,next_action_due,last_login,users!client_profiles_user_id_fkey(email)",
  )
  .eq("id", process.env.OPS_SMOKE_CLIENT_ID)
  .single();
assert.ok(original.data);
assert.equal(original.data.users.email, "cbb-ops-client@example.invalid");
const c = original.data,
  password = randomBytes(32).toString("base64url");
assert.equal(
  (await db.auth.admin.updateUserById(c.user_id, { password })).error,
  null,
);
const cookies = [];
const client = createServerClient(
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
  (await client.auth.signInWithPassword({ email: c.users.email, password }))
    .error,
  null,
);
const marker = "Synthetic private Ops action " + randomBytes(8).toString("hex");
try {
  assert.equal(
    (
      await db
        .from("client_profiles")
        .update({ next_action: marker })
        .eq("id", c.id)
    ).error,
    null,
  );
  for (const columns of ["*", "next_action", "payment_status"]) {
    const result = await client
      .from("client_profiles")
      .select(columns)
      .eq("id", c.id);
    assert.ok(["42501", "42P17"].includes(result.error?.code));
  }
  const legacyRead = await client
    .from("client_profiles")
    .select("id,business_name")
    .eq("id", c.id);
  // The old non-live project's users policy self-references users and raises 42P17.
  // Catalog proof is recorded separately; don't mislabel that baseline as a direct-read pass.
  if (legacyRead.error) assert.equal(legacyRead.error.code, "42P17");
  for (const input of [
    { next_action: "Injected fixture" },
    { payment_status: "current" },
  ])
    assert.ok(
      ["42501", "42P17"].includes(
        (await client.from("client_profiles").update(input).eq("id", c.id))
          .error?.code,
      ),
    );
  const header = {
    cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; "),
  };
  const settings = await fetch("http://127.0.0.1:3087/api/portal/settings", {
    method: "POST",
    headers: { ...header, "content-type": "application/json" },
    body: JSON.stringify({ businessName: c.business_name }),
  });
  assert.equal(settings.status, 200);
  for (const path of ["/api/portal/me", "/api/portal/dashboard"]) {
    const r = await fetch("http://127.0.0.1:3087" + path, { headers: header });
    const data = await r.json();
    assert.equal(r.status, 200, JSON.stringify(data));
    assert.ok(data.profile);
    for (const k of [
      "next_action",
      "next_action_due",
      "payment_status",
      "onboarding_stage",
    ])
      assert.equal(k in data.profile, false);
    assert.equal(JSON.stringify(data).includes(marker), false);
  }
  const ops = await fetch(`http://127.0.0.1:3087/api/ops/clients/${c.id}`, {
    headers: { authorization: `Bearer ${process.env.OPS_API_TOKEN}` },
  });
  assert.equal(ops.status, 200);
  assert.equal((await ops.json()).client.next_action, marker);
  console.log(
    JSON.stringify({
      pass: true,
      checks: [
        "direct client cannot read/write new Ops fields",
        "legacy client settings API remains available",
        "portal me/dashboard exclude internal signals and notes",
        "authenticated Ops API retains private action",
      ],
      legacyDirectRead: {
        verified: !legacyRead.error,
        errorCode: legacyRead.error?.code || null,
        note: legacyRead.error
          ? "Pre-existing recursive users policy on old non-live project; see profile-rls-inventory.json and profile-column-privileges.json"
          : null,
      },
      externalMessages: 0,
    }),
  );
} finally {
  await db
    .from("client_profiles")
    .update({
      next_action: c.next_action,
      next_action_due: c.next_action_due,
      last_login: c.last_login,
    })
    .eq("id", c.id);
  await client.auth.signOut();
}
