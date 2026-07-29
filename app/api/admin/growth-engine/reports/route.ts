import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanReportInput, requireGrowthManager } from "@/lib/growth-engine";

export async function POST(request: NextRequest) {
  const viewer = await requireGrowthManager();
  if (!viewer.authorized) {
    return NextResponse.json({ error: viewer.error }, { status: viewer.status });
  }

  const body = await request.json().catch(() => null);
  const clientId = body && typeof body.clientId === "string" ? body.clientId : "";
  const input = cleanReportInput(body);
  if (!clientId || !input.title) {
    return NextResponse.json({ error: "Client and report title are required." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: client } = await admin.from("client_profiles")
    .select("id, archived_at").eq("id", clientId).maybeSingle();
  if (!client || client.archived_at) {
    return NextResponse.json({ error: "Active client not found." }, { status: 404 });
  }

  const now = new Date().toISOString();
  const { data: workspace, error: workspaceError } = await admin
    .from("cbb_growth_workspaces")
    .upsert(
      { client_id: clientId, created_by: viewer.userId, updated_by: viewer.userId, updated_at: now },
      { onConflict: "client_id" },
    )
    .select("id")
    .single();
  if (workspaceError || !workspace) {
    return NextResponse.json({ error: "Could not prepare the client workspace." }, { status: 500 });
  }

  const { data: report, error } = await admin.from("cbb_growth_reports").insert({
    workspace_id: workspace.id,
    title: input.title,
    period_start: input.periodStart,
    period_end: input.periodEnd,
    executive_summary: input.executiveSummary,
    progress_update: input.progressUpdate,
    next_priorities: input.nextPriorities,
    metrics: input.metrics,
    status: "draft",
    created_by: viewer.userId,
    updated_by: viewer.userId,
  }).select("*").single();

  if (error || !report) {
    return NextResponse.json({ error: "Could not create the weekly report." }, { status: 500 });
  }
  return NextResponse.json({ report }, { status: 201 });
}
