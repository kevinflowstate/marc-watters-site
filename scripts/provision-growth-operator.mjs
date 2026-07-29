import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2]?.trim().toLowerCase();
const fullName = process.argv[3]?.trim() || "Flow State Operator";
const activationBaseUrl = process.env.ACTIVATION_BASE_URL?.replace(/\/$/, "");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!email || !activationBaseUrl || !supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Usage: ACTIVATION_BASE_URL=https://preview.example node scripts/provision-growth-operator.mjs email@example.com \"Full Name\"",
  );
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: listed, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listError) throw listError;

let authUser = listed.users.find((user) => user.email?.toLowerCase() === email);
if (!authUser) {
  const temporaryPassword = `Setup!${randomUUID().replaceAll("-", "")}aA1`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password: temporaryPassword,
    user_metadata: {
      full_name: fullName,
      role: "growth_operator",
      app_name: "marc-watters-portal",
      requires_password_setup: true,
    },
  });
  if (error) throw error;
  authUser = data.user;
} else {
  const { error } = await admin.auth.admin.updateUserById(authUser.id, {
    user_metadata: {
      ...authUser.user_metadata,
      full_name: fullName,
      role: "growth_operator",
      app_name: "marc-watters-portal",
      requires_password_setup: true,
    },
  });
  if (error) throw error;
}

const { error: profileError } = await admin.from("users").upsert({
  id: authUser.id,
  email,
  full_name: fullName,
  role: "growth_operator",
});
if (profileError) throw profileError;

const token = randomBytes(32).toString("base64url");
const tokenHash = createHash("sha256").update(token).digest("hex");
const { error: inviteError } = await admin.from("client_invites").upsert({
  user_id: authUser.id,
  email,
  full_name: fullName,
  token_hash: tokenHash,
  last_sent_at: new Date().toISOString(),
  used_at: null,
  used_ip: null,
  revoked_at: null,
}, { onConflict: "user_id" });
if (inviteError) throw inviteError;

const activationUrl = new URL("/activate", activationBaseUrl);
activationUrl.searchParams.set("token", token);

console.log(JSON.stringify({
  success: true,
  email,
  role: "growth_operator",
  activationUrl: activationUrl.toString(),
}));
