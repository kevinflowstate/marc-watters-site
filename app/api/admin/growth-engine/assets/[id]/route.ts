import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireGrowthManager } from "@/lib/growth-engine";
import {
  automationAssetsFromMetadata,
  setAutomationAssetVisibility,
  withoutAutomationAsset,
} from "@/lib/growth-engine-automation";

const BUCKET = "cbb-growth-engine";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await requireGrowthManager();
  if (!viewer.authorized) return NextResponse.json({ error: viewer.error }, { status: viewer.status });
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body?.title === "string") updates.title = body.title.trim().slice(0, 180);
  const admin = createAdminClient();
  const { data: existing } = await admin.from("cbb_growth_assets")
    .select("id, report_id, published_at")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "File not found." }, { status: 404 });

  let requestedVisibility: "client" | "internal" = existing.published_at ? "client" : "internal";
  if (typeof body?.clientVisible === "boolean") {
    requestedVisibility = body.clientVisible ? "client" : "internal";
    if (existing.report_id) {
      const { data: report } = await admin.from("cbb_growth_reports")
        .select("id, status, generation_metadata")
        .eq("id", existing.report_id)
        .maybeSingle();
      if (report) {
        const automationAsset = automationAssetsFromMetadata(report.generation_metadata)
          .some((asset) => asset.id === existing.id);
        if (automationAsset) {
          const { error: metadataError } = await admin.from("cbb_growth_reports")
            .update({
              generation_metadata: setAutomationAssetVisibility(
                report.generation_metadata,
                existing.id,
                requestedVisibility,
              ),
              updated_at: new Date().toISOString(),
            })
            .eq("id", report.id);
          if (metadataError) {
            return NextResponse.json({ error: "Automated file visibility could not be changed." }, { status: 500 });
          }
        }
        if (report.status === "draft") {
          updates.published_at = null;
        } else if (report.status === "published") {
          updates.published_at = body.clientVisible ? new Date().toISOString() : null;
        } else if (body.clientVisible) {
          return NextResponse.json({ error: "Files on an unpublished report cannot be shared." }, { status: 409 });
        } else {
          updates.published_at = null;
        }
      }
    } else {
      updates.published_at = body.clientVisible ? new Date().toISOString() : null;
    }
  }
  const { data: asset, error } = await admin.from("cbb_growth_assets").update(updates).eq("id", id)
    .select("id, workspace_id, report_id, title, original_name, mime_type, size_bytes, published_at, created_at, updated_at").maybeSingle();
  if (error) return NextResponse.json({ error: "File could not be updated." }, { status: 500 });
  if (!asset) return NextResponse.json({ error: "File not found." }, { status: 404 });
  return NextResponse.json({
    asset: {
      ...asset,
      visibility: requestedVisibility,
      availability: asset.published_at ? "visible" : requestedVisibility === "client" ? "on_publish" : "internal",
    },
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await requireGrowthManager();
  if (!viewer.authorized) return NextResponse.json({ error: viewer.error }, { status: viewer.status });
  const { id } = await params;
  const admin = createAdminClient();
  const { data: asset } = await admin.from("cbb_growth_assets")
    .select("storage_path, report_id")
    .eq("id", id)
    .maybeSingle();
  if (!asset) return NextResponse.json({ error: "File not found." }, { status: 404 });
  if (asset.report_id) {
    const { data: report } = await admin.from("cbb_growth_reports")
      .select("generation_metadata")
      .eq("id", asset.report_id)
      .maybeSingle();
    if (report && automationAssetsFromMetadata(report.generation_metadata).some((item) => item.id === id)) {
      await admin.from("cbb_growth_reports").update({
        generation_metadata: withoutAutomationAsset(report.generation_metadata, id),
        updated_at: new Date().toISOString(),
      }).eq("id", asset.report_id);
    }
  }
  const { error } = await admin.from("cbb_growth_assets").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "File could not be removed." }, { status: 500 });
  await admin.storage.from(BUCKET).remove([asset.storage_path]);
  return NextResponse.json({ success: true });
}
