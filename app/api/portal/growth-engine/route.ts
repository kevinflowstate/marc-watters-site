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
    .select("id, client_id, strategy_summary, created_at, updated_at")
    .eq("client_id", access.clientId)
    .maybeSingle();

  if (workspaceError) {
    return NextResponse.json({ error: "Could not load the Growth Engine workspace." }, { status: 500 });
  }
  if (!workspace) {
    return NextResponse.json({ entitled: true, workspace: null, reports: [] });
  }

  const { data: reports, error: reportsError } = await admin
    .from("cbb_growth_reports")
    .select("id, workspace_id, title, period_start, period_end, executive_summary, strategic_takeaway, progress_update, next_priorities, metrics, status, published_at, created_at, updated_at")
    .eq("workspace_id", workspace.id)
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (reportsError) {
    return NextResponse.json({ error: "Could not load Growth Engine reports." }, { status: 500 });
  }

  return NextResponse.json({ entitled: true, workspace, reports: reports || [] });
}
