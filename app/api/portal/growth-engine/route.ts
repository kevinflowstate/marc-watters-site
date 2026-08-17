import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getClientGrowthAccess } from "@/lib/growth-engine";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const access = await getClientGrowthAccess(user.id);
  if (!access.activeClient) {
    return NextResponse.json({ error: "This client account is not active." }, { status: 403 });
  }
  if (!access.entitled || !access.clientId) {
    return NextResponse.json({ entitled: false });
  }

  const admin = createAdminClient();
  const { data: workspace, error: workspaceError } = await admin
    .from("cbb_growth_workspaces")
    .select("id, client_id, strategy_title, strategy_summary, implementation_milestones, created_at, updated_at")
    .eq("client_id", access.clientId)
    .maybeSingle();

  if (workspaceError) {
    return NextResponse.json({ error: "Could not load the Growth Engine workspace." }, { status: 500 });
  }
  if (!workspace) {
    return NextResponse.json({ entitled: true, workspace: null, reports: [], assets: [] });
  }

  const [reportsResult, assetsResult] = await Promise.all([
    admin.from("cbb_growth_reports")
      .select("id, workspace_id, title, period_start, period_end, executive_summary, strategic_takeaway, progress_update, next_priorities, metrics, status, published_at, created_at, updated_at")
      .eq("workspace_id", workspace.id)
      .eq("status", "published")
      .order("published_at", { ascending: false }),
    admin.from("cbb_growth_assets")
      .select("id, workspace_id, report_id, title, original_name, mime_type, size_bytes, published_at, created_at, updated_at")
      .eq("workspace_id", workspace.id)
      .not("published_at", "is", null)
      .order("created_at", { ascending: false }),
  ]);

  if (reportsResult.error || assetsResult.error) {
    return NextResponse.json({ error: "Could not load Growth Engine reports." }, { status: 500 });
  }

  return NextResponse.json({ entitled: true, workspace, reports: reportsResult.data || [], assets: assetsResult.data || [] });
}
