import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Check if the current request is from an admin user.
 * Returns { authorized: true } if admin, or { authorized: false, status, error }.
 *
 * When no session exists (common in preview/demo mode where middleware
 * doesn't enforce login), we allow access since the middleware layer
 * handles route protection in production.
 */
export async function requireAdmin(): Promise<
  { authorized: true } | { authorized: false; status: number; error: string }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // No session - reject unauthenticated requests
  if (!user) {
    return { authorized: false, status: 401, error: "Not authenticated" };
  }

  // Use admin client to bypass RLS for role lookup
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { authorized: false, status: 403, error: "Not authorized" };
  }

  return { authorized: true };
}
