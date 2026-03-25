import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const bucket = (formData.get("bucket") as string) || "training-resources";

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const allowedBuckets = ["training-resources", "plan-documents"];
  if (!allowedBuckets.includes(bucket)) {
    return NextResponse.json({ error: "Invalid bucket" }, { status: 400 });
  }

  const admin = createAdminClient();
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
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

  const { data: urlData } = admin.storage.from(bucket).getPublicUrl(fileName);

  return NextResponse.json({
    url: urlData.publicUrl,
    fileName: file.name,
  });
}
