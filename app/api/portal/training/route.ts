import { createAdminClient } from "@/lib/supabase/admin";
import { getAccessibleModuleIds } from "@/lib/portal-training-access";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createAdminClient();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Get client profile
  const { data: profile } = await admin
    .from("client_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ modules: [] });
  }

  const moduleIds = await getAccessibleModuleIds(admin, profile.id);

  if (moduleIds.size === 0) {
    return NextResponse.json({ modules: [] });
  }

  // Only return published modules that this client can access
  const { data: modules } = await admin
    .from("training_modules")
    .select("*, content:module_content(*)")
    .eq("is_published", true)
    .in("id", [...moduleIds])
    .order("order_index");

  return NextResponse.json({ modules: modules || [] });
}
