import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireGrowthManager } from "@/lib/growth-engine";

const BUCKET = "cbb-growth-engine";
const MAX_SIZE = 25 * 1024 * 1024;
const extensions = new Set(["pdf", "doc", "docx", "xls", "xlsx", "csv", "ppt", "pptx", "zip", "png", "jpg", "jpeg", "webp"]);

function extension(name: string) {
  return name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "";
}

function displayName(name: string) {
  return name.replace(/[^\w.\- ()]/g, "").trim().slice(0, 180) || "Growth Engine file";
}

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
  if (!extensions.has(extension(file.name))) return NextResponse.json({ error: "This file type is not supported." }, { status: 400 });
  if (file.size <= 0 || file.size > MAX_SIZE) return NextResponse.json({ error: "File must be 25MB or smaller." }, { status: 400 });

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
  if (reportId) {
    const { data: report } = await admin.from("cbb_growth_reports")
      .select("id").eq("id", reportId).eq("workspace_id", workspace.id).maybeSingle();
    if (!report) return NextResponse.json({ error: "The selected report does not belong to this client." }, { status: 400 });
  }

  const stored = `${crypto.randomUUID()}.${extension(file.name)}`;
  const storagePath = `${clientId}/${stored}`;
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(storagePath, await file.arrayBuffer(), {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (uploadError) return NextResponse.json({ error: "File could not be uploaded." }, { status: 500 });

  const now = new Date().toISOString();
  const { data: asset, error } = await admin.from("cbb_growth_assets").insert({
    workspace_id: workspace.id,
    report_id: reportId || null,
    title: title || displayName(file.name),
    original_name: displayName(file.name),
    storage_path: storagePath,
    mime_type: file.type || null,
    size_bytes: file.size,
    published_at: clientVisible ? now : null,
    uploaded_by: viewer.userId,
    updated_at: now,
  }).select("id, workspace_id, report_id, title, original_name, mime_type, size_bytes, published_at, created_at, updated_at").single();
  if (error || !asset) {
    await admin.storage.from(BUCKET).remove([storagePath]);
    return NextResponse.json({ error: "File metadata could not be saved." }, { status: 500 });
  }
  return NextResponse.json({ asset }, { status: 201 });
}
