import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanReportInput } from "@/lib/growth-engine";

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const configured = process.env.GROWTH_ENGINE_INGEST_SECRET?.trim() || "";
  const supplied = request.headers.get("x-growth-engine-secret")?.trim() || "";
  if (!configured || !supplied || !safeEqual(configured, supplied)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const input = cleanReportInput(body);
  const requestedClientId = typeof body?.clientId === "string" ? body.clientId.trim() : "";
  const locationId = typeof body?.ghlLocationId === "string" ? body.ghlLocationId.trim() : "";
  const sourceKey = typeof body?.sourceKey === "string" ? body.sourceKey.trim().slice(0, 160) : "";
  if ((!requestedClientId && !locationId) || !input.title || !sourceKey) {
    return NextResponse.json({ error: "Client mapping, sourceKey and report title are required." }, { status: 400 });
  }

  const admin = createAdminClient();
  let clientId = requestedClientId;
  if (!clientId) {
    const { data: connection } = await admin.from("cbb_growth_connections")
      .select("client_id").eq("ghl_location_id", locationId).maybeSingle();
    clientId = connection?.client_id || "";
  }
  if (!clientId) return NextResponse.json({ error: "Growth Engine client could not be mapped." }, { status: 404 });

  const [{ data: entitlement }, { data: client }] = await Promise.all([
    admin.from("client_entitlements")
      .select("status").eq("client_id", clientId).eq("entitlement_key", "cbb_growth_engine").maybeSingle(),
    admin.from("client_profiles").select("id").eq("id", clientId).is("archived_at", null).maybeSingle(),
  ]);
  if (!client || entitlement?.status !== "active") {
    return NextResponse.json({ error: "Growth Engine access is not active." }, { status: 409 });
  }
  const now = new Date().toISOString();
  const { data: workspace, error: workspaceError } = await admin.from("cbb_growth_workspaces")
    .upsert({ client_id: clientId, updated_at: now }, { onConflict: "client_id" })
    .select("id").single();
  if (workspaceError || !workspace) return NextResponse.json({ error: "Workspace could not be prepared." }, { status: 500 });

  const generationKey = `external:${clientId}:${sourceKey}`;
  const { data: existing } = await admin.from("cbb_growth_reports")
    .select("id, status").eq("generation_key", generationKey).maybeSingle();
  if (existing && existing.status !== "draft") {
    return NextResponse.json({ error: "That source report has already been published or withdrawn." }, { status: 409 });
  }
  const payload = {
    workspace_id: workspace.id,
    generation_key: generationKey,
    generation_source: "external",
    generation_metadata: {
      source: typeof body?.source === "string" ? body.source.slice(0, 100) : "automation",
    },
    title: input.title,
    period_start: input.periodStart,
    period_end: input.periodEnd,
    executive_summary: input.executiveSummary,
    strategic_takeaway: input.strategicTakeaway,
    progress_update: input.progressUpdate,
    next_priorities: input.nextPriorities,
    metrics: input.metrics,
    status: "draft",
    updated_at: now,
  };
  const query = existing
    ? admin.from("cbb_growth_reports").update(payload).eq("id", existing.id).eq("status", "draft")
    : admin.from("cbb_growth_reports").insert(payload);
  const { data: report, error } = await query.select("*").single();
  if (error || !report) return NextResponse.json({ error: "Draft could not be saved." }, { status: 500 });
  await admin.from("cbb_growth_report_events").insert({
    report_id: report.id,
    event_type: existing ? "updated" : "created",
    metadata: { source: "external", sourceKey },
  });
  return NextResponse.json({ report, publishRequired: true }, { status: existing ? 200 : 201 });
}
