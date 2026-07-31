import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireGrowthManager } from "@/lib/growth-engine";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await requireGrowthManager();
  if (!viewer.authorized) {
    return NextResponse.json({ error: viewer.error }, { status: viewer.status });
  }
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 1000) : "";
  const now = new Date().toISOString();
  const admin = createAdminClient();
  const { data: report, error } = await admin.from("cbb_growth_reports").update({
    status: "withdrawn",
    withdrawn_at: now,
    withdrawn_by: viewer.userId,
    withdrawal_reason: reason || null,
    updated_by: viewer.userId,
    updated_at: now,
  }).eq("id", id).eq("status", "published").select("id").maybeSingle();
  if (error) return NextResponse.json({ error: "Report could not be withdrawn." }, { status: 500 });
  if (!report) {
    const { data: existing } = await admin.from("cbb_growth_reports").select("status").eq("id", id).maybeSingle();
    if (existing?.status !== "withdrawn") {
      return NextResponse.json({ error: "Only published reports can be withdrawn." }, { status: 409 });
    }
  }
  const { error: assetError } = await admin.from("cbb_growth_assets")
    .update({ published_at: null, updated_at: now })
    .eq("report_id", id);
  if (assetError) {
    return NextResponse.json(
      { error: "The report was unpublished, but its linked files could not be hidden. Retry unpublish to complete it." },
      { status: 500 },
    );
  }
  if (report) {
    await admin.from("cbb_growth_report_events").insert({
      report_id: id,
      event_type: "withdrawn",
      actor_user_id: viewer.userId,
      metadata: { reason: reason || null },
    });
  }
  return NextResponse.json({ success: true });
}
