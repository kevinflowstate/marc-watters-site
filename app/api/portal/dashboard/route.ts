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

  const userId = user.id;

  const { data: userData } = await admin
    .from("users")
    .select("full_name")
    .eq("id", userId)
    .single();

  const { data: profile } = await admin
    .from("client_profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Client profile not found" }, { status: 404 });
  }

  // Update last_login timestamp
  await admin
    .from("client_profiles")
    .update({ last_login: new Date().toISOString() })
    .eq("id", profile.id);

  const [modulesRes, checkinsRes, planRes, formConfigRes, recentModulesRes, contentProgressRes] = await Promise.all([
    admin
      .from("training_modules")
      .select("*, content:module_content(*)")
      .eq("is_published", true)
      .order("order_index"),
    admin
      .from("checkins")
      .select("*")
      .eq("client_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(5),
    admin
      .from("business_plans")
      .select("*")
      .eq("client_id", profile.id)
      .eq("status", "active")
      .limit(1)
      .single(),
    admin
      .from("form_config")
      .select("*")
      .eq("form_type", "checkin")
      .single(),
    // Recently added modules (for What's New) - modules added in last 14 days
    admin
      .from("training_modules")
      .select("id, title, created_at")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(3),
    // Content progress for training completion tracking
    admin
      .from("content_progress")
      .select("content_id, completed")
      .eq("client_id", profile.id)
      .eq("completed", true),
  ]);

  // Get business plan phases and items if plan exists
  let planPhases: unknown[] = [];
  if (planRes.data) {
    const { data: phases } = await admin
      .from("business_plan_phases")
      .select("*")
      .eq("plan_id", planRes.data.id)
      .order("order_index");

    if (phases && phases.length > 0) {
      const phaseIds = phases.map((p: { id: string }) => p.id);
      const { data: items } = await admin
        .from("business_plan_items")
        .select("*")
        .in("phase_id", phaseIds)
        .order("order_index");

      planPhases = phases.map((phase: { id: string }) => ({
        ...phase,
        items: (items || []).filter((item: { phase_id: string }) => item.phase_id === phase.id),
      }));
    }
  }

  // Build a set of completed content IDs for training progress
  const completedContentIds = new Set(
    (contentProgressRes.data || []).map((p: { content_id: string }) => p.content_id)
  );

  // Count total lessons and completed lessons across all modules
  const allLessons = (modulesRes.data || []).flatMap(
    (m: { content?: { id: string }[] }) => (m.content || []).map((c: { id: string }) => c.id)
  );
  const totalLessons = allLessons.length;
  const completedLessons = allLessons.filter((id: string) => completedContentIds.has(id)).length;

  return NextResponse.json({
    userName: userData?.full_name || "",
    profile,
    modules: modulesRes.data || [],
    checkins: checkinsRes.data || [],
    businessPlan: planRes.data || null,
    planPhases,
    checkinDay: formConfigRes.data?.config?.checkin_day || "monday",
    recentModules: recentModulesRes.data || [],
    trainingProgress: {
      completedLessons,
      totalLessons,
    },
  });
}
