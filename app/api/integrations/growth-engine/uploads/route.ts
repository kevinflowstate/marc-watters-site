import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  automationStagingPath,
  automationVisibility,
  GROWTH_ENGINE_AUTOMATION_MAX_FILE_SIZE,
} from "@/lib/growth-engine-automation";
import {
  safeDisplayFileName,
  uploadContentType,
  uploadExtension,
} from "@/lib/upload-security";

const BUCKET = "cbb-growth-engine";
const ALLOWED_EXTENSIONS = new Set([
  "pdf", "doc", "docx", "xls", "xlsx", "csv", "ppt", "pptx", "zip", "png", "jpg", "jpeg", "webp",
]);

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const configured = process.env.GROWTH_ENGINE_INGEST_SECRET?.trim() || "";
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || "";
  const supplied = request.headers.get("x-growth-engine-secret")?.trim() || bearer;
  if (!configured || !supplied || !safeEqual(configured, supplied)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const requestedClientId = typeof body?.clientId === "string" ? body.clientId.trim() : "";
  const locationId = typeof body?.ghlLocationId === "string" ? body.ghlLocationId.trim() : "";
  const sourceKey = typeof body?.sourceKey === "string" ? body.sourceKey.trim().slice(0, 160) : "";
  const fileName = safeDisplayFileName(typeof body?.fileName === "string" ? body.fileName : "");
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 180) : "";
  const sizeBytes = Number(body?.sizeBytes);
  if ((!requestedClientId && !locationId) || !sourceKey || !fileName) {
    return NextResponse.json({ error: "Client mapping, sourceKey and fileName are required." }, { status: 400 });
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > GROWTH_ENGINE_AUTOMATION_MAX_FILE_SIZE) {
    return NextResponse.json({ error: "sizeBytes must be between 1 byte and 25MB." }, { status: 400 });
  }
  const extension = uploadExtension(fileName);
  const contentType = uploadContentType(extension);
  if (!ALLOWED_EXTENSIONS.has(extension) || !contentType) {
    return NextResponse.json({ error: "This file type is not supported." }, { status: 400 });
  }

  const admin = createAdminClient();
  let clientId = requestedClientId;
  if (!clientId) {
    const { data: connection } = await admin.from("cbb_growth_connections")
      .select("client_id")
      .eq("ghl_location_id", locationId)
      .maybeSingle();
    clientId = connection?.client_id || "";
  }
  if (!clientId) return NextResponse.json({ error: "Growth Engine client could not be mapped." }, { status: 404 });

  const [{ data: entitlement }, { data: client }] = await Promise.all([
    admin.from("client_entitlements")
      .select("status")
      .eq("client_id", clientId)
      .eq("entitlement_key", "cbb_growth_engine")
      .maybeSingle(),
    admin.from("client_profiles")
      .select("id")
      .eq("id", clientId)
      .is("archived_at", null)
      .maybeSingle(),
  ]);
  if (!client || entitlement?.status !== "active") {
    return NextResponse.json({ error: "Growth Engine access is not active." }, { status: 409 });
  }

  const path = automationStagingPath(clientId, sourceKey, fileName);
  const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: true });
  if (error || !data?.signedUrl || !data.token) {
    return NextResponse.json({ error: "A secure upload URL could not be created." }, { status: 500 });
  }

  return NextResponse.json({
    upload: {
      bucket: BUCKET,
      path,
      signedUrl: data.signedUrl,
      token: data.token,
      contentType,
      maxSizeBytes: GROWTH_ENGINE_AUTOMATION_MAX_FILE_SIZE,
      expiresInSeconds: 7200,
    },
    attachment: {
      uploadedPath: path,
      fileName,
      title: title || fileName,
      visibility: automationVisibility(body?.visibility ?? body?.clientVisible),
    },
  });
}
