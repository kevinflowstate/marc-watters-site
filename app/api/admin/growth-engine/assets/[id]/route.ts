import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireGrowthManager } from "@/lib/growth-engine";

const BUCKET = "cbb-growth-engine";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await requireGrowthManager();
  if (!viewer.authorized) return NextResponse.json({ error: viewer.error }, { status: viewer.status });
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body?.title === "string") updates.title = body.title.trim().slice(0, 180);
  if (typeof body?.clientVisible === "boolean") updates.published_at = body.clientVisible ? new Date().toISOString() : null;
  const admin = createAdminClient();
  const { data: asset, error } = await admin.from("cbb_growth_assets").update(updates).eq("id", id)
    .select("id, workspace_id, report_id, title, original_name, mime_type, size_bytes, published_at, created_at, updated_at").maybeSingle();
  if (error) return NextResponse.json({ error: "File could not be updated." }, { status: 500 });
  if (!asset) return NextResponse.json({ error: "File not found." }, { status: 404 });
  return NextResponse.json({ asset });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await requireGrowthManager();
  if (!viewer.authorized) return NextResponse.json({ error: viewer.error }, { status: viewer.status });
  const { id } = await params;
  const admin = createAdminClient();
  const { data: asset } = await admin.from("cbb_growth_assets").select("storage_path").eq("id", id).maybeSingle();
  if (!asset) return NextResponse.json({ error: "File not found." }, { status: 404 });
  const { error } = await admin.from("cbb_growth_assets").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "File could not be removed." }, { status: 500 });
  await admin.storage.from(BUCKET).remove([asset.storage_path]);
  return NextResponse.json({ success: true });
}
