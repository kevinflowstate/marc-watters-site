import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_BUCKETS = ["training-resources", "plan-documents"] as const;
const MAX_SIGNED_UPLOAD_BYTES = 50 * 1024 * 1024;

function isAllowedBucket(bucket: string): bucket is (typeof ALLOWED_BUCKETS)[number] {
  return ALLOWED_BUCKETS.includes(bucket as (typeof ALLOWED_BUCKETS)[number]);
}

function getFileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
}

async function linkPlanDocument(
  admin: ReturnType<typeof createAdminClient>,
  bucket: string,
  path: string,
  planId: unknown,
) {
  const { data: urlData } = admin.storage.from(bucket).getPublicUrl(path);
  let linkedToPlan = false;

  if (bucket === "plan-documents" && typeof planId === "string" && planId) {
    const { data: existingPlan, error: planLookupError } = await admin
      .from("business_plans")
      .select("id")
      .eq("id", planId)
      .maybeSingle<{ id: string }>();

    if (planLookupError) throw new Error(planLookupError.message);

    if (existingPlan) {
      const { error: planUpdateError } = await admin
        .from("business_plans")
        .update({ pdf_url: urlData.publicUrl })
        .eq("id", planId);

      if (planUpdateError) throw new Error(planUpdateError.message);
      linkedToPlan = true;
    }
  }

  return { url: urlData.publicUrl, linkedToPlan };
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  if (request.headers.get("content-type")?.includes("application/json")) {
    const body = await request.json();
    const bucket = typeof body.bucket === "string" ? body.bucket : "plan-documents";
    const originalName = typeof body.fileName === "string" ? body.fileName : "";
    const fileSize = Number(body.fileSize);

    if (body.action !== "create-signed-upload") {
      return NextResponse.json({ error: "Invalid upload action" }, { status: 400 });
    }
    if (!isAllowedBucket(bucket)) {
      return NextResponse.json({ error: "Invalid bucket" }, { status: 400 });
    }
    if (!originalName || !Number.isFinite(fileSize) || fileSize <= 0) {
      return NextResponse.json({ error: "Invalid file" }, { status: 400 });
    }
    if (fileSize > MAX_SIGNED_UPLOAD_BYTES) {
      return NextResponse.json({ error: "Files must be 50 MB or smaller" }, { status: 413 });
    }

    const ext = getFileExtension(originalName);
    if (bucket === "plan-documents" && ext !== "pdf") {
      return NextResponse.json({ error: "Plan documents must be PDF files" }, { status: 400 });
    }

    const path = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const admin = createAdminClient();
    const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(path);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ path: data.path, token: data.token });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const bucket = (formData.get("bucket") as string) || "training-resources";
  const planId = formData.get("planId");

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!isAllowedBucket(bucket)) {
    return NextResponse.json({ error: "Invalid bucket" }, { status: 400 });
  }

  const admin = createAdminClient();
  const ext = getFileExtension(file.name);
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error } = await admin.storage
    .from(bucket)
    .upload(fileName, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    const linked = await linkPlanDocument(admin, bucket, fileName, planId);
    return NextResponse.json({
      ...linked,
      fileName: file.name,
    });
  } catch (linkError) {
    return NextResponse.json(
      { error: linkError instanceof Error ? linkError.message : "Failed to link upload" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const bucket = typeof body.bucket === "string" ? body.bucket : "";
  const path = typeof body.path === "string" ? body.path : "";

  if (!isAllowedBucket(bucket) || !path || path.includes("/") || path.includes("..")) {
    return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
  }
  if (bucket === "plan-documents" && getFileExtension(path) !== "pdf") {
    return NextResponse.json({ error: "Plan documents must be PDF files" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: fileInfo, error: fileInfoError } = await admin.storage.from(bucket).info(path);
  if (fileInfoError || !fileInfo) {
    return NextResponse.json({ error: "Uploaded file could not be verified" }, { status: 400 });
  }
  if ((fileInfo.size || 0) > MAX_SIGNED_UPLOAD_BYTES) {
    await admin.storage.from(bucket).remove([path]);
    return NextResponse.json({ error: "Files must be 50 MB or smaller" }, { status: 413 });
  }

  try {
    const linked = await linkPlanDocument(admin, bucket, path, body.planId);
    return NextResponse.json({ ...linked, fileName: body.fileName || path });
  } catch (linkError) {
    return NextResponse.json(
      { error: linkError instanceof Error ? linkError.message : "Failed to link upload" },
      { status: 500 },
    );
  }
}
