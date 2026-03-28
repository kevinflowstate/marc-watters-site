import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createAdminClient();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userId = user.id;

  const { data: profile } = await admin
    .from("client_profiles")
    .select("id")
    .eq("user_id", userId)
    .single();

  // Check this module is linked in the client's business plan
  if (profile) {
    const { data: plans } = await admin
      .from("business_plans")
      .select("id")
      .eq("client_id", profile.id)
      .eq("status", "active");

    const planIds = (plans || []).map(p => p.id);
    let hasAccess = false;

    if (planIds.length > 0) {
      const { data: phases } = await admin
        .from("business_plan_phases")
        .select("id")
        .in("plan_id", planIds);

      const phaseIds = (phases || []).map(p => p.id);

      if (phaseIds.length > 0) {
        const { data: links } = await admin
          .from("phase_training_links")
          .select("content_id")
          .in("phase_id", phaseIds);

        if (links && links.length > 0) {
          const contentIds = links.map(l => l.content_id);
          const { data: contentItems } = await admin
            .from("module_content")
            .select("module_id")
            .in("id", contentIds)
            .eq("module_id", id);

          hasAccess = (contentItems || []).length > 0;
        }
      }
    }

    if (!hasAccess) {
      return NextResponse.json({ error: "Not assigned to this module" }, { status: 403 });
    }
  }

  // Get module with content (only if published)
  const { data: mod } = await admin
    .from("training_modules")
    .select("*, content:module_content(*)")
    .eq("id", id)
    .eq("is_published", true)
    .single();

  // Get progress
  const progress: Record<string, boolean> = {};
  if (profile) {
    const { data: progressData } = await admin
      .from("content_progress")
      .select("content_id, completed")
      .eq("client_id", profile.id);

    if (progressData) {
      progressData.forEach((p: { content_id: string; completed: boolean }) => {
        progress[p.content_id] = p.completed;
      });
    }
  }

  return NextResponse.json({
    module: mod,
    progress,
    profileId: profile?.id || null,
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { contentId, completed, profileId } = await request.json();

  if (!profileId || !contentId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Verify the profileId belongs to the authenticated user
  const { data: ownedProfile } = await admin
    .from("client_profiles")
    .select("id")
    .eq("id", profileId)
    .eq("user_id", user.id)
    .single();

  if (!ownedProfile) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (completed) {
    const { error } = await admin.from("content_progress").upsert({
      client_id: profileId,
      content_id: contentId,
      completed: true,
      completed_at: new Date().toISOString(),
    }, { onConflict: "client_id,content_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await admin
      .from("content_progress")
      .update({ completed: false, completed_at: null })
      .eq("client_id", profileId)
      .eq("content_id", contentId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
