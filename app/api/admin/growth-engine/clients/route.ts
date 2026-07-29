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
      ? admin.from("cbb_growth_workspaces").select("id, client_id").in("client_id", clientIds)
      : Promise.resolve({ data: [] }),
  ]);

  const workspaces = workspacesResult.data || [];
  const workspaceIds = workspaces.map((workspace) => workspace.id);
  const { data: reports } = workspaceIds.length
    ? await admin.from("cbb_growth_reports")
        .select("id, workspace_id, title, period_start, period_end, status, published_at, updated_at")
        .in("workspace_id", workspaceIds)
        .order("updated_at", { ascending: false })
    : { data: [] };

  const userNameById = new Map((usersResult.data || []).map((user) => [user.id, user.full_name]));
  const entitlementByClient = new Map(
    (entitlementsResult.data || []).map((entitlement) => [entitlement.client_id, entitlement.status]),
  );
  const workspaceByClient = new Map(workspaces.map((workspace) => [workspace.client_id, workspace.id]));
  const reportsByWorkspace = new Map<string, ReportRow[]>();
  for (const report of reports || []) {
    const existing = reportsByWorkspace.get(report.workspace_id) || [];
    existing.push(report as ReportRow);
    reportsByWorkspace.set(report.workspace_id, existing);
  }

  return NextResponse.json({
    viewerRole: viewer.role,
    clients: (clients || []).map((client) => {
      const workspaceId = workspaceByClient.get(client.id) || null;
      return {
        id: client.id,
        fullName: userNameById.get(client.user_id) || "Client",
        businessName: client.business_name || "",
        enabled: entitlementByClient.get(client.id) === "active",
        workspaceId,
        reports: workspaceId ? reportsByWorkspace.get(workspaceId) || [] : [],
      };
    }),
  });
}
