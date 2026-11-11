import { PORTAL_PROFILE_COLUMNS } from "@/lib/portal-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { inactiveClientResponse } from "@/lib/client-lifecycle";

// Used by sidebar and settings to get current user info
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const admin = createAdminClient();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const inactiveResponse = await inactiveClientResponse(user.id);
  if (inactiveResponse) return inactiveResponse;

  const userId = user.id;

  const { data: userData } = await admin
    .from("users")
    .select("full_name, avatar_url, role")
    .eq("id", userId)
    .single();

  const { data: profile } = await admin
    .from("client_profiles")
    .select(PORTAL_PROFILE_COLUMNS)
    .eq("user_id", userId)
    .single();

  // Opening any portal page counts as activity, not only Home (Marc, 11 Nov 2026). Throttled to one write per 10 minutes.
  const lastLogin = profile?.last_login ? Date.parse(profile.last_login) : NaN;
  if (profile?.id && (userData?.role || "client") === "client" && !(Date.now() - lastLogin < 10 * 60_000)) {
    await admin.from("client_profiles").update({ last_login: new Date().toISOString() }).eq("id", profile.id);
  }

  return NextResponse.json({
    userId,
    fullName: userData?.full_name || "",
    avatarUrl: userData?.avatar_url || null,
    role: userData?.role || "client",
    profile: profile || null,
  });
}
