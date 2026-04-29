import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeAttachments } from "@/lib/attachments";
import { getAccessibleModuleIds } from "@/lib/portal-training-access";
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

  if (!profile) {
    return NextResponse.json({ error: "Client profile not found" }, { status: 404 });
  }

  // Enforce that module is either plan-linked or explicitly assigned to this client
  const allowedModuleIds = await getAccessibleModuleIds(admin, profile.id);
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

  return NextResponse.json({
    module: normalizedModule,
  });
}

export async function POST() {
  return NextResponse.json(
    { error: "Training completion is managed from the business plan." },
    { status: 410 },
  );
}
