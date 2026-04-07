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

  // Collect modules linked through this client's active business plan phases
  const moduleIds = new Set<string>();

  const { data: plans } = await admin
    .from("business_plans")
    .select("id")
    .eq("client_id", profile.id)
    .eq("status", "active");

  if (plans && plans.length > 0) {
    const planIds = plans.map((p) => p.id);

    const { data: phases } = await admin
      .from("business_plan_phases")
      .select("id")
      .in("plan_id", planIds);

    if (phases && phases.length > 0) {
      const phaseIds = phases.map((p) => p.id);

      // Get linked content IDs from phase_training_links
      const { data: links } = await admin
        .from("phase_training_links")
        .select("content_id")
        .in("phase_id", phaseIds);

      if (links && links.length > 0) {
        // Get the module IDs for those content items
        const contentIds = [...new Set(links.map((l) => l.content_id))];
        const { data: contentItems } = await admin
          .from("module_content")
          .select("module_id")
          .in("id", contentIds);

        for (const item of contentItems || []) {
          if (item.module_id) moduleIds.add(item.module_id);
        }
      }
    }
  }

  // Also include modules explicitly assigned in admin bulk assign/new-client flows
  const { data: assignedModules } = await admin
    .from("client_modules")
    .select("module_id")
    .eq("client_id", profile.id);

  for (const row of assignedModules || []) {
    if (row.module_id) moduleIds.add(row.module_id);
  }

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
