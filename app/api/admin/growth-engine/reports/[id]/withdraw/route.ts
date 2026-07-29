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
  if (!report) return NextResponse.json({ error: "Only published reports can be withdrawn." }, { status: 409 });
  await admin.from("cbb_growth_report_events").insert({
    report_id: id,
    event_type: "withdrawn",
    actor_user_id: viewer.userId,
    metadata: { reason: reason || null },
  });
  return NextResponse.json({ success: true });
}
