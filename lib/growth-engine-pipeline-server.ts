import type { SupabaseClient } from "@supabase/supabase-js";

const EMAIL = /^[^\s@*%]+@[^\s@*%]+\.[^\s@*%]+$/;

/** Lowercased, trimmed email, or "" when it isn't a plain email address. */
export function normalizeEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  return EMAIL.test(normalized) ? normalized : "";
}

/** Link a pipeline lead to Marc's portal client when the email matches exactly. */
export async function matchClientByEmail(admin: SupabaseClient, email: string) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const { data: user } = await admin.from("users").select("id").eq("email", normalized).maybeSingle();
  if (!user) return null;
  const { data: client } = await admin.from("client_profiles").select("id").eq("user_id", user.id).maybeSingle();
  return client?.id ?? null;
}
