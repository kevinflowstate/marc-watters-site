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
  const { data: asset } = await admin.from("cbb_growth_assets")
    .select("storage_path, published_at, cbb_growth_workspaces!inner(client_id)")
    .eq("id", id)
    .eq("cbb_growth_workspaces.client_id", access.clientId)
    .not("published_at", "is", null)
    .maybeSingle();
  if (!asset) return NextResponse.json({ error: "File not found." }, { status: 404 });
  const { data, error } = await admin.storage.from("cbb-growth-engine").createSignedUrl(asset.storage_path, 60);
  if (error || !data?.signedUrl) return NextResponse.json({ error: "Download could not be prepared." }, { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
