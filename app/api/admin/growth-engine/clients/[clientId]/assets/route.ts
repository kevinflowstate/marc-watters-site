import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireGrowthManager } from "@/lib/growth-engine";
import {
  hasExpectedFileSignature,
  safeDisplayFileName,
  uploadContentType,
  uploadExtension,
} from "@/lib/upload-security";
import { upsertReportAssetMetadata } from "@/lib/growth-engine-automation";

const BUCKET = "cbb-growth-engine";
const MAX_SIZE = 25 * 1024 * 1024;
const extensions = new Set(["pdf", "doc", "docx", "xls", "xlsx", "csv", "ppt", "pptx", "zip", "png", "jpg", "jpeg", "webp"]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const viewer = await requireGrowthManager();
  if (!viewer.authorized) return NextResponse.json({ error: viewer.error }, { status: viewer.status });
  const { clientId } = await params;
  const form = await request.formData();
  const file = form.get("file") as File | null;
  const reportId = typeof form.get("reportId") === "string" ? String(form.get("reportId")).trim() : "";
  const clientVisible = form.get("clientVisible") === "true";
  const title = typeof form.get("title") === "string" ? String(form.get("title")).trim().slice(0, 180) : "";
  if (!file) return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
  const ext = uploadExtension(file.name);
  const contentType = uploadContentType(ext);
  if (!extensions.has(ext) || !contentType) return NextResponse.json({ error: "This file type is not supported." }, { status: 400 });
  if (file.size <= 0 || file.size > MAX_SIZE) return NextResponse.json({ error: "File must be 25MB or smaller." }, { status: 400 });
  const fileBuffer = await file.arrayBuffer();
  if (!hasExpectedFileSignature(fileBuffer, ext)) {
    return NextResponse.json({ error: "The file contents do not match the selected file type." }, { status: 400 });
  }

  const admin = createAdminClient();
  const [{ data: workspace }, { data: entitlement }] = await Promise.all([
    admin.from("cbb_growth_workspaces").select("id").eq("client_id", clientId).maybeSingle(),
    admin.from("client_entitlements").select("status")
      .eq("client_id", clientId).eq("entitlement_key", "cbb_growth_engine").maybeSingle(),
  ]);
  if (entitlement?.status !== "active") {
    return NextResponse.json({ error: "Growth Engine access is not active." }, { status: 409 });
  }
  if (!workspace) return NextResponse.json({ error: "Growth Engine workspace not found." }, { status: 404 });
  let linkedReport: {
    id: string;
    status: "draft" | "published" | "withdrawn";
    generation_metadata: unknown;
  } | null = null;
  if (reportId) {
    const { data: report } = await admin.from("cbb_growth_reports")
      .select("id, status, generation_metadata")
      .eq("id", reportId)
      .eq("workspace_id", workspace.id)
      .maybeSingle();
    if (!report) return NextResponse.json({ error: "The selected report does not belong to this client." }, { status: 400 });
    linkedReport = report;
    if (report.status === "withdrawn" && clientVisible) {
      return NextResponse.json({ error: "Files on a withdrawn report cannot be shared." }, { status: 409 });
    }
  }

  const stored = `${crypto.randomUUID()}.${ext}`;
  // Server-mediated downloads enforce visibility from cbb_growth_assets.
  // Keeping new files outside the client-id root also prevents direct Storage
  // access from bypassing an internal-only asset's metadata.
  const storagePath = `internal/${clientId}/manual/${stored}`;
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(storagePath, fileBuffer, {
    contentType,
    upsert: false,
  });
  if (uploadError) return NextResponse.json({ error: "File could not be uploaded." }, { status: 500 });

  const now = new Date().toISOString();
  const { data: asset, error } = await admin.from("cbb_growth_assets").insert({
    workspace_id: workspace.id,
    report_id: reportId || null,
    title: title || safeDisplayFileName(file.name),
    original_name: safeDisplayFileName(file.name),
    storage_path: storagePath,
    mime_type: contentType,
    size_bytes: file.size,
    published_at: clientVisible && linkedReport?.status !== "draft" ? now : null,
    uploaded_by: viewer.userId,
    updated_at: now,
  }).select("id, workspace_id, report_id, title, original_name, mime_type, size_bytes, published_at, created_at, updated_at").single();
  if (error || !asset) {
    await admin.storage.from(BUCKET).remove([storagePath]);
    return NextResponse.json({ error: "File metadata could not be saved." }, { status: 500 });
  }
  if (linkedReport) {
    const { error: metadataError } = await admin.from("cbb_growth_reports").update({
      generation_metadata: upsertReportAssetMetadata(linkedReport.generation_metadata, {
        id: asset.id,
        storagePath,
        title: asset.title,
        visibility: clientVisible ? "client" : "internal",
      }),
      updated_at: now,
    }).eq("id", linkedReport.id);
    if (metadataError) {
      await admin.from("cbb_growth_assets").delete().eq("id", asset.id);
      await admin.storage.from(BUCKET).remove([storagePath]);
      return NextResponse.json({ error: "File visibility could not be linked to its report." }, { status: 500 });
    }
  }
  return NextResponse.json({ asset }, { status: 201 });
}
