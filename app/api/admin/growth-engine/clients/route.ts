import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CBB_GROWTH_ENGINE_KEY, requireGrowthManager } from "@/lib/growth-engine";

interface ReportRow {
  id: string;
  workspace_id: string;
  title: string;
  period_start: string | null;
  period_end: string | null;
  status: "draft" | "published";
  published_at: string | null;
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
  const [usersResult, entitlementsResult, workspacesResult] = await Promise.all([
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
  ]);

  const workspaces = workspacesResult.data || [];
  const workspaceIds = workspaces.map((workspace) => workspace.id);
  const [reportsResult, assetsResult] = await Promise.all([
    workspaceIds.length
      ? admin.from("cbb_growth_reports")
          .select("id, workspace_id, title, period_start, period_end, status, published_at, updated_at")
          .in("workspace_id", workspaceIds)
          .order("updated_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    workspaceIds.length
      ? admin.from("cbb_growth_assets")
          .select("id, workspace_id, report_id, title, mime_type, size_bytes, published_at, created_at")
          .in("workspace_id", workspaceIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);
  const reports = reportsResult.data || [];
  const assets = assetsResult.data || [];

  const userNameById = new Map((usersResult.data || []).map((user) => [user.id, user.full_name]));
  const entitlementByClient = new Map(
    (entitlementsResult.data || []).map((entitlement) => [entitlement.client_id, entitlement.status]),
  );
  const workspaceByClient = new Map(workspaces.map((workspace) => [workspace.client_id, workspace]));
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
        reports: workspaceId ? reportsByWorkspace.get(workspaceId) || [] : [],
        assets: workspaceId ? assetsByWorkspace.get(workspaceId) || [] : [],
      };
    }),
  });
}
