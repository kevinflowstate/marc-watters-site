import type { SupabaseClient } from "@supabase/supabase-js";

/** Exact, case-insensitive match for ilike: escape the LIKE wildcards. */
export function exactIlike(value: string) {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Link a pipeline lead to Marc's portal client when the email matches. */
export async function matchClientByEmail(admin: SupabaseClient, email: string) {
  const normalized = email.trim().toLowerCase();
  if (!EMAIL.test(normalized)) return null;
  const { data: user } = await admin.from("users").select("id").ilike("email", exactIlike(normalized)).maybeSingle();
  if (!user) return null;
  const { data: client } = await admin.from("client_profiles").select("id").eq("user_id", user.id).maybeSingle();
  return client?.id ?? null;
}
