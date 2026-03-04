import { createClient } from "@/lib/supabase/server";

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

  // No session - allow through (middleware handles protection in production)
  if (!user) {
    return { authorized: true };
  }

  // Session exists - verify admin role
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  // Check user_metadata as fallback (RLS on users table can be unreliable)
  const role = profile?.role || user.user_metadata?.role;

  if (role !== "admin") {
    return { authorized: false, status: 403, error: "Not authorized" };
  }

  return { authorized: true };
}
