import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getClientGrowthAccess } from "@/lib/growth-engine";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const access = await getClientGrowthAccess(user.id);
  if (!access.activeClient || !access.entitled || !access.clientId) {
    return NextResponse.json({ error: "Growth Engine access is not enabled." }, { status: 403 });
  }

  const { id } = await params;
  const admin = createAdminClient();
  const { data: report, error } = await admin
    .from("cbb_growth_reports")
    .select("id, workspace_id, title, period_start, period_end, executive_summary, strategic_takeaway, progress_update, next_priorities, metrics, status, published_at, created_at, updated_at, cbb_growth_workspaces!inner(client_id)")
    .eq("id", id)
    .eq("status", "published")
    .eq("cbb_growth_workspaces.client_id", access.clientId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "Could not load the report." }, { status: 500 });
  if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });

  const safeReport = { ...report };
  delete (safeReport as { cbb_growth_workspaces?: unknown }).cbb_growth_workspaces;
  return NextResponse.json({ report: safeReport });
}
