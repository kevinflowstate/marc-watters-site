import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeAttachments } from "@/lib/attachments";
import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

async function getAllowedModuleIds(admin: ReturnType<typeof createAdminClient>, clientId: string) {
  const moduleIds = new Set<string>();

  // Modules linked through active plan phases
  const { data: plans } = await admin
    .from("business_plans")
    .select("id")
    .eq("client_id", clientId)
    .eq("status", "active");

  if (plans && plans.length > 0) {
    const planIds = plans.map((p) => p.id);
    const { data: phases } = await admin
      .from("business_plan_phases")
      .select("id")
      .in("plan_id", planIds);

    if (phases && phases.length > 0) {
      const phaseIds = phases.map((p) => p.id);
      const { data: links } = await admin
        .from("phase_training_links")
        .select("content_id")
        .in("phase_id", phaseIds);

      if (links && links.length > 0) {
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

  // Modules explicitly assigned to the client
  const { data: assignedModules } = await admin
    .from("client_modules")
    .select("module_id")
    .eq("client_id", clientId);

  for (const row of assignedModules || []) {
    if (row.module_id) moduleIds.add(row.module_id);
  }

  return moduleIds;
}

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

  if (!profile) {
    return NextResponse.json({ error: "Client profile not found" }, { status: 404 });
  }

  // Enforce that module is either plan-linked or explicitly assigned to this client
  const allowedModuleIds = await getAllowedModuleIds(admin, profile.id);
  if (!allowedModuleIds.has(id)) {
    return NextResponse.json({ error: "Not assigned to this module" }, { status: 403 });
  }

  // Get module with content (only if published)
  const { data: mod } = await admin
    .from("training_modules")
    .select("*, content:module_content(*)")
    .eq("id", id)
    .eq("is_published", true)
    .single();

  if (!mod) {
    return NextResponse.json({ error: "Module not found" }, { status: 404 });
  }

  const normalizedModule = mod
    ? {
        ...mod,
        content: (mod.content || []).map((lesson: Record<string, unknown>) => ({
          ...lesson,
          attachments: normalizeAttachments(lesson.attachments),
        })),
      }
    : null;

  // Get progress
  const progress: Record<string, boolean> = {};
  const { data: progressData } = await admin
    .from("content_progress")
    .select("content_id, completed")
    .eq("client_id", profile.id);

  if (progressData) {
    progressData.forEach((p: { content_id: string; completed: boolean }) => {
      progress[p.content_id] = p.completed;
    });
  }

  return NextResponse.json({
    module: normalizedModule,
    progress,
    profileId: profile.id,
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: moduleId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { contentId, completed, profileId } = await request.json();

  if (!contentId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const { data: profile } = await admin
    .from("client_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Client profile not found" }, { status: 404 });
  }

  // Keep backward compatibility with existing client payloads while enforcing ownership
  if (profileId && profileId !== profile.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Enforce module access parity with GET endpoint
  const allowedModuleIds = await getAllowedModuleIds(admin, profile.id);
  if (!allowedModuleIds.has(moduleId)) {
    return NextResponse.json({ error: "Not assigned to this module" }, { status: 403 });
  }

  // Ensure content item belongs to this module
  const { data: lesson } = await admin
    .from("module_content")
    .select("id")
    .eq("id", contentId)
    .eq("module_id", moduleId)
    .single();

  if (!lesson) {
    return NextResponse.json({ error: "Invalid lesson for this module" }, { status: 400 });
  }

  if (completed) {
    const { error } = await admin.from("content_progress").upsert({
      client_id: profile.id,
      content_id: contentId,
      completed: true,
      completed_at: new Date().toISOString(),
    }, { onConflict: "client_id,content_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await admin
      .from("content_progress")
      .update({ completed: false, completed_at: null })
      .eq("client_id", profile.id)
      .eq("content_id", contentId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
