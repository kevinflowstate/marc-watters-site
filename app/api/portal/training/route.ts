import { createAdminClient } from "@/lib/supabase/admin";
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

  // Get this client's active business plan phase IDs
  const { data: plans } = await admin
    .from("business_plans")
    .select("id")
    .eq("client_id", profile.id)
    .eq("status", "active");

  if (!plans || plans.length === 0) {
    return NextResponse.json({ modules: [] });
  }

  const planIds = plans.map(p => p.id);

  const { data: phases } = await admin
    .from("business_plan_phases")
    .select("id")
    .in("plan_id", planIds);

  if (!phases || phases.length === 0) {
    return NextResponse.json({ modules: [] });
  }

  const phaseIds = phases.map(p => p.id);

  // Get linked content IDs from phase_training_links
  const { data: links } = await admin
    .from("phase_training_links")
    .select("content_id")
    .in("phase_id", phaseIds);

  if (!links || links.length === 0) {
    return NextResponse.json({ modules: [] });
  }

  // Get the module IDs for those content items
  const contentIds = [...new Set(links.map(l => l.content_id))];

  const { data: contentItems } = await admin
    .from("module_content")
    .select("module_id")
    .in("id", contentIds);

  if (!contentItems || contentItems.length === 0) {
    return NextResponse.json({ modules: [] });
  }

  const moduleIds = [...new Set(contentItems.map(c => c.module_id))];

  // Only return published modules that are linked in this client's business plan
  const { data: modules } = await admin
    .from("training_modules")
    .select("*, content:module_content(*)")
    .eq("is_published", true)
    .in("id", moduleIds)
    .order("order_index");

  return NextResponse.json({ modules: modules || [] });
}
