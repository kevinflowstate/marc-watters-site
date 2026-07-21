import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const bucket = (formData.get("bucket") as string) || "training-resources";
  const planId = formData.get("planId");

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

  let linkedToPlan = false;
  if (bucket === "plan-documents" && typeof planId === "string" && planId) {
    const { data: existingPlan, error: planLookupError } = await admin
      .from("business_plans")
      .select("id")
      .eq("id", planId)
      .maybeSingle<{ id: string }>();

    if (planLookupError) {
      return NextResponse.json({ error: planLookupError.message }, { status: 500 });
    }

    if (existingPlan) {
      const { error: planUpdateError } = await admin
        .from("business_plans")
        .update({ pdf_url: urlData.publicUrl })
        .eq("id", planId);

      if (planUpdateError) {
        return NextResponse.json({ error: planUpdateError.message }, { status: 500 });
      }
      linkedToPlan = true;
    }
  }

  return NextResponse.json({
    url: urlData.publicUrl,
    fileName: file.name,
    linkedToPlan,
  });
}
