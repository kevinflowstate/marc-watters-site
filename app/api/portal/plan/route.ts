import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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

  const { data: profile } = await admin
    .from("client_profiles")
    .select("id")
    .eq("user_id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "No profile" }, { status: 404 });
  }

  // Get active business plan
  const { data: plan } = await admin
    .from("business_plans")
    .select("*")
    .eq("client_id", profile.id)
    .eq("status", "active")
    .limit(1)
    .single();

  if (!plan) {
    return NextResponse.json({ plan: null, phases: [] });
  }

  // Get phases
  const { data: phases } = await admin
    .from("business_plan_phases")
    .select("*")
    .eq("plan_id", plan.id)
    .order("order_index");

  if (!phases || phases.length === 0) {
    return NextResponse.json({ plan, phases: [] });
  }

  // Get items for all phases
  const phaseIds = phases.map((p: { id: string }) => p.id);
  const { data: items } = await admin
    .from("business_plan_items")
    .select("*")
    .in("phase_id", phaseIds)
    .order("order_index");

  // Get linked training content for all phases
  const { data: links } = await admin
    .from("phase_training_links")
    .select("phase_id, content_id")
    .in("phase_id", phaseIds);

  // Get the actual content details for linked trainings
  const contentIds = [...new Set((links || []).map((l: { content_id: string }) => l.content_id))];
  let contentLookup: Record<string, { id: string; title: string; content_type: string; duration_minutes: number; module_id: string; moduleName: string }> = {};

  if (contentIds.length > 0) {
    const { data: contentItems } = await admin
      .from("module_content")
      .select("id, title, content_type, duration_minutes, module_id")
      .in("id", contentIds);

    // Get module names
    const moduleIds = [...new Set((contentItems || []).map((c: { module_id: string }) => c.module_id))];
    const { data: modules } = await admin
      .from("training_modules")
      .select("id, title")
      .in("id", moduleIds);

    const moduleMap: Record<string, string> = {};
    (modules || []).forEach((m: { id: string; title: string }) => { moduleMap[m.id] = m.title; });

    (contentItems || []).forEach((c: { id: string; title: string; content_type: string; duration_minutes: number; module_id: string }) => {
      contentLookup[c.id] = { ...c, moduleName: moduleMap[c.module_id] || "" };
    });
  }

  // Build phases with items and linked trainings
  const phasesWithData = phases.map((phase: { id: string }) => ({
    ...phase,
    items: (items || []).filter((item: { phase_id: string }) => item.phase_id === phase.id),
    linkedTrainings: (links || [])
      .filter((l: { phase_id: string }) => l.phase_id === phase.id)
      .map((l: { content_id: string }) => contentLookup[l.content_id])
      .filter(Boolean),
  }));

  return NextResponse.json({ plan, phases: phasesWithData });
}
