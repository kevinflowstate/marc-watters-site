import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanReportInput, requireGrowthManager } from "@/lib/growth-engine";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await requireGrowthManager();
  if (!viewer.authorized) {
    return NextResponse.json({ error: viewer.error }, { status: viewer.status });
  }

  const { id } = await params;
  const admin = createAdminClient();
  const { data: report, error } = await admin.from("cbb_growth_reports")
    .select("*").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: "Could not load the report." }, { status: 500 });
  if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });
  return NextResponse.json({ report });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await requireGrowthManager();
  if (!viewer.authorized) {
    return NextResponse.json({ error: viewer.error }, { status: viewer.status });
  }

  const { id } = await params;
  const input = cleanReportInput(await request.json().catch(() => null));
  if (!input.title) return NextResponse.json({ error: "Report title is required." }, { status: 400 });

  const admin = createAdminClient();
  const { data: report, error } = await admin.from("cbb_growth_reports").update({
    title: input.title,
    period_start: input.periodStart,
    period_end: input.periodEnd,
    executive_summary: input.executiveSummary,
    strategic_takeaway: input.strategicTakeaway,
    progress_update: input.progressUpdate,
    next_priorities: input.nextPriorities,
    metrics: input.metrics,
    updated_by: viewer.userId,
    updated_at: new Date().toISOString(),
  }).eq("id", id).eq("status", "draft").select("*").maybeSingle();

  if (error) return NextResponse.json({ error: "Could not save the report." }, { status: 500 });
  if (!report) {
    return NextResponse.json(
      { error: "Published reports are read-only or the report was not found." },
      { status: 409 },
    );
  }
  return NextResponse.json({ report });
}
