import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // In preview mode, user may be null - try to get first client for demo
  const admin = createAdminClient();

  let userId = user?.id;

  // If no auth session, pick the demo client for preview
  if (!userId) {
    const { data: demoUser } = await admin
      .from("users")
      .select("id")
      .eq("role", "client")
      .limit(1)
      .single();
    if (demoUser) userId = demoUser.id;
  }

  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Get user name
  const { data: userData } = await admin
    .from("users")
    .select("full_name")
    .eq("id", userId)
    .single();

  // Get client profile
  const { data: profile } = await admin
    .from("client_profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Client profile not found" }, { status: 404 });
  }

  // Get modules and checkins using profile.id
  const [modulesRes, checkinsRes] = await Promise.all([
    admin
      .from("client_modules")
      .select("*, module:training_modules(*)")
      .eq("client_id", profile.id),
    admin
      .from("checkins")
      .select("*")
      .eq("client_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  return NextResponse.json({
    userName: userData?.full_name || "",
    profile,
    modules: modulesRes.data || [],
    checkins: checkinsRes.data || [],
  });
}
