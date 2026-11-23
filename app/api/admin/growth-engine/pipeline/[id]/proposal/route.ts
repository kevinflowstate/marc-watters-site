import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireGrowthManager } from "@/lib/growth-engine";
import { DEAL_COLUMNS, toDeal } from "@/lib/growth-engine-pipeline";
import { hasExpectedFileSignature, safeDisplayFileName, uploadContentType, uploadExtension } from "@/lib/upload-security";

const BUCKET = "cbb-growth-engine";
const MAX_SIZE = 25 * 1024 * 1024;
const extensions = new Set(["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "png", "jpg", "jpeg", "webp"]);

/** Attach the proposal file Kevin sent. Replaces any earlier file. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireGrowthManager();
  if (!viewer.authorized) return NextResponse.json({ error: viewer.error }, { status: viewer.status });
  const { id } = await params;
  const form = await request.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
  const ext = uploadExtension(file.name);
  const contentType = uploadContentType(ext);
  if (!extensions.has(ext) || !contentType) return NextResponse.json({ error: "Upload a PDF, Word, PowerPoint, Excel or image file." }, { status: 400 });
  if (file.size <= 0 || file.size > MAX_SIZE) return NextResponse.json({ error: "File must be 25MB or smaller." }, { status: 400 });
  const buffer = await file.arrayBuffer();
  if (!hasExpectedFileSignature(buffer, ext)) return NextResponse.json({ error: "The file contents do not match its type." }, { status: 400 });

  const admin = createAdminClient();
  const { data: current } = await admin.from("cbb_growth_pipeline").select("proposal_file_path").eq("id", id).maybeSingle();
  if (!current) return NextResponse.json({ error: "Lead not found." }, { status: 404 });

  const path = `pipeline/${id}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, buffer, { contentType, upsert: false });
  if (uploadError) return NextResponse.json({ error: "File could not be uploaded." }, { status: 500 });

  const now = new Date().toISOString();
  const { data, error } = await admin.from("cbb_growth_pipeline").update({
    proposal_file_path: path,
    proposal_file_name: safeDisplayFileName(file.name),
    updated_at: now,
    updated_by: viewer.userId,
  }).eq("id", id).select(DEAL_COLUMNS).single();
  if (error || !data) {
    await admin.storage.from(BUCKET).remove([path]);
    return NextResponse.json({ error: "File could not be saved to the lead." }, { status: 500 });
  }
  if (current.proposal_file_path) await admin.storage.from(BUCKET).remove([current.proposal_file_path]);
  return NextResponse.json({ deal: toDeal(data as Record<string, unknown>) });
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireGrowthManager();
  if (!viewer.authorized) return NextResponse.json({ error: viewer.error }, { status: viewer.status });
  const { id } = await params;
  const admin = createAdminClient();
  const { data: deal } = await admin.from("cbb_growth_pipeline").select("proposal_file_path, proposal_file_name").eq("id", id).maybeSingle();
  if (!deal?.proposal_file_path) return NextResponse.json({ error: "No proposal file." }, { status: 404 });
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(deal.proposal_file_path, 60, {
    download: deal.proposal_file_name || "proposal",
  });
  if (error || !data?.signedUrl) return NextResponse.json({ error: "Download could not be prepared." }, { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireGrowthManager();
  if (!viewer.authorized) return NextResponse.json({ error: viewer.error }, { status: viewer.status });
  const { id } = await params;
  const admin = createAdminClient();
  const { data: current } = await admin.from("cbb_growth_pipeline").select("proposal_file_path").eq("id", id).maybeSingle();
  if (!current) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  const { data, error } = await admin.from("cbb_growth_pipeline").update({
    proposal_file_path: null, proposal_file_name: null, updated_at: new Date().toISOString(), updated_by: viewer.userId,
  }).eq("id", id).select(DEAL_COLUMNS).single();
  if (error || !data) return NextResponse.json({ error: "File could not be removed." }, { status: 500 });
  if (current.proposal_file_path) await admin.storage.from(BUCKET).remove([current.proposal_file_path]);
  return NextResponse.json({ deal: toDeal(data as Record<string, unknown>) });
}
