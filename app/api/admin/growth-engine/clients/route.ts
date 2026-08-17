import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CBB_GROWTH_ENGINE_KEY, requireGrowthManager } from "@/lib/growth-engine";
import { automationAssetsFromMetadata } from "@/lib/growth-engine-automation";

interface ReportRow {
  id: string;
  workspace_id: string;
  title: string;
  period_start: string | null;
  period_end: string | null;
  status: "draft" | "published" | "withdrawn";
  published_at: string | null;
  generation_source: string;
  generation_metadata: Record<string, unknown>;
  updated_at: string;
}

export async function GET() {
  const viewer = await requireGrowthManager();
  if (!viewer.authorized) {
    return NextResponse.json({ error: viewer.error }, { status: viewer.status });
  }

  const admin = createAdminClient();
  const { data: clients, error } = await admin
    .from("client_profiles")
    .select("id, user_id, business_name, archived_at")
    .is("archived_at", null)
    .order("business_name");

  if (error) {
    return NextResponse.json({ error: "Could not load Growth Engine clients." }, { status: 500 });
  }

  const clientIds = (clients || []).map((client) => client.id);
  const userIds = (clients || []).map((client) => client.user_id);
  const [usersResult, entitlementsResult, workspacesResult, connectionsResult] = await Promise.all([
    userIds.length
      ? admin.from("users").select("id, full_name").in("id", userIds)
      : Promise.resolve({ data: [] }),
    clientIds.length
      ? admin.from("client_entitlements").select("client_id, status")
          .eq("entitlement_key", CBB_GROWTH_ENGINE_KEY).in("client_id", clientIds)
      : Promise.resolve({ data: [] }),
    clientIds.length
      ? admin.from("cbb_growth_workspaces")
          .select("id, client_id, strategy_title, strategy_summary, implementation_milestones, updated_at")
          .in("client_id", clientIds)
      : Promise.resolve({ data: [] }),
    clientIds.length
      ? admin.from("cbb_growth_connections")
          .select("client_id, ghl_location_id, ghl_calendar_ids, timezone, automation_enabled, report_day, last_event_at, last_draft_at")
          .in("client_id", clientIds)
      : Promise.resolve({ data: [] }),
  ]);

  const workspaces = workspacesResult.data || [];
  const workspaceIds = workspaces.map((workspace) => workspace.id);
  const [reportsResult, assetsResult] = await Promise.all([
    workspaceIds.length
      ? admin.from("cbb_growth_reports")
          .select("id, workspace_id, title, period_start, period_end, status, published_at, generation_source, generation_metadata, updated_at")
          .in("workspace_id", workspaceIds)
          .order("updated_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    workspaceIds.length
      ? admin.from("cbb_growth_assets")
          .select("id, workspace_id, report_id, title, original_name, mime_type, size_bytes, published_at, created_at, updated_at")
          .in("workspace_id", workspaceIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);
  const reports = reportsResult.data || [];
  const assets = assetsResult.data || [];
  const automationVisibilityByAsset = new Map<string, "client" | "internal">();
  for (const report of reports) {
    for (const asset of automationAssetsFromMetadata(report.generation_metadata)) {
      automationVisibilityByAsset.set(asset.id, asset.visibility);
    }
  }

  const userNameById = new Map((usersResult.data || []).map((user) => [user.id, user.full_name]));
  const entitlementByClient = new Map(
    (entitlementsResult.data || []).map((entitlement) => [entitlement.client_id, entitlement.status]),
  );
  const workspaceByClient = new Map(workspaces.map((workspace) => [workspace.client_id, workspace]));
  const connectionByClient = new Map((connectionsResult.data || []).map((connection) => [connection.client_id, connection]));
  const reportsByWorkspace = new Map<string, ReportRow[]>();
  for (const report of reports) {
    const existing = reportsByWorkspace.get(report.workspace_id) || [];
    existing.push(report as ReportRow);
    reportsByWorkspace.set(report.workspace_id, existing);
  }
  const assetsByWorkspace = new Map<string, typeof assets>();
  for (const asset of assets) {
    const existing = assetsByWorkspace.get(asset.workspace_id) || [];
    existing.push(asset);
    assetsByWorkspace.set(asset.workspace_id, existing);
  }

  return NextResponse.json({
    viewerRole: viewer.role,
    capabilities: {
      reportIntakeConfigured: Boolean(process.env.GROWTH_ENGINE_INGEST_SECRET?.trim()),
      ghlWebhookConfigured: Boolean(process.env.GROWTH_ENGINE_GHL_WEBHOOK_SECRET?.trim()),
      scheduledDraftsConfigured: Boolean(process.env.CRON_SECRET?.trim()),
    },
    clients: (clients || []).map((client) => {
      const workspace = workspaceByClient.get(client.id) || null;
      const workspaceId = workspace?.id || null;
      return {
        id: client.id,
        fullName: userNameById.get(client.user_id) || "Client",
        businessName: client.business_name || "",
        enabled: entitlementByClient.get(client.id) === "active",
        workspaceId,
        workspace,
        reports: workspaceId
          ? (reportsByWorkspace.get(workspaceId) || []).map((report) => ({
              id: report.id,
              workspace_id: report.workspace_id,
              title: report.title,
              period_start: report.period_start,
              period_end: report.period_end,
              status: report.status,
              published_at: report.published_at,
              generation_source: report.generation_source,
              updated_at: report.updated_at,
            }))
          : [],
        assets: workspaceId
          ? (assetsByWorkspace.get(workspaceId) || []).map((asset) => {
              const visibility = asset.published_at
                ? "client" as const
                : automationVisibilityByAsset.get(asset.id) || "internal" as const;
              return {
                ...asset,
                visibility,
                availability: asset.published_at
                  ? "visible" as const
                  : visibility === "client"
                    ? "on_publish" as const
                    : "internal" as const,
              };
            })
          : [],
        connection: connectionByClient.get(client.id) || null,
      };
    }),
  });
}
