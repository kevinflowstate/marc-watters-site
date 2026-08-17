import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireGrowthManager } from "@/lib/growth-engine";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await requireGrowthManager();
  if (!viewer.authorized) return NextResponse.json({ error: viewer.error }, { status: viewer.status });
  const { id } = await params;
  const admin = createAdminClient();
  const { data: asset } = await admin.from("cbb_growth_assets")
    .select("storage_path, original_name, title")
    .eq("id", id)
    .maybeSingle();
  if (!asset) return NextResponse.json({ error: "File not found." }, { status: 404 });
  const { data, error } = await admin.storage.from("cbb-growth-engine").createSignedUrl(
    asset.storage_path,
    60,
    { download: asset.original_name || asset.title || "growth-engine-file" },
  );
  if (error || !data?.signedUrl) return NextResponse.json({ error: "Download could not be prepared." }, { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
