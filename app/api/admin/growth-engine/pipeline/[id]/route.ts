import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireGrowthManager } from "@/lib/growth-engine";
import { cleanDealPatch, DEAL_COLUMNS, isStage, toDeal } from "@/lib/growth-engine-pipeline";

const BUCKET = "cbb-growth-engine";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireGrowthManager();
  if (!viewer.authorized) return NextResponse.json({ error: viewer.error }, { status: viewer.status });
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const admin = createAdminClient();
  const { data: current } = await admin.from("cbb_growth_pipeline").select("stage").eq("id", id).maybeSingle();
  if (!current) return NextResponse.json({ error: "Lead not found." }, { status: 404 });

  const now = new Date().toISOString();
  const update: Record<string, unknown> = { ...cleanDealPatch(body), updated_at: now, updated_by: viewer.userId };
  if ("stage" in body) {
    if (!isStage(body.stage)) return NextResponse.json({ error: "Unknown stage." }, { status: 400 });
    update.stage = body.stage;
    if (body.stage !== current.stage) update.stage_changed_at = now;
  }
  if ("position" in body && typeof body.position === "number" && Number.isFinite(body.position)) {
    update.position = body.position;
  }
  const { data, error } = await admin.from("cbb_growth_pipeline").update(update).eq("id", id).select(DEAL_COLUMNS).single();
  if (error || !data) return NextResponse.json({ error: "The lead could not be saved." }, { status: 500 });
  return NextResponse.json({ deal: toDeal(data as Record<string, unknown>) });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireGrowthManager();
  if (!viewer.authorized) return NextResponse.json({ error: viewer.error }, { status: viewer.status });
  const { id } = await params;
  const admin = createAdminClient();
  const { data: current } = await admin.from("cbb_growth_pipeline").select("proposal_file_path").eq("id", id).maybeSingle();
  if (!current) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  const { error } = await admin.from("cbb_growth_pipeline").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "The lead could not be removed." }, { status: 500 });
  if (current.proposal_file_path) await admin.storage.from(BUCKET).remove([current.proposal_file_path]);
  return NextResponse.json({ ok: true });
}
