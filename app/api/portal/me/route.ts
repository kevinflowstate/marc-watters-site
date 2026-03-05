import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Used by sidebar and settings to get current user info
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createAdminClient();

  let userId = user?.id;
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

  const { data: userData } = await admin
    .from("users")
    .select("full_name, avatar_url")
    .eq("id", userId)
    .single();

  const { data: profile } = await admin
    .from("client_profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  return NextResponse.json({
    userId,
    fullName: userData?.full_name || "",
    avatarUrl: userData?.avatar_url || null,
    profile: profile || null,
  });
}
