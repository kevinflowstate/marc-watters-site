import { formatFileSize, guessAttachmentType } from "@/lib/attachments";
import { getInboxViewer } from "@/lib/inbox-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

const INBOX_BUCKET = "plan-documents";
const MAX_FILE_SIZE = 25 * 1024 * 1024;

const allowedDocumentExtensions = new Set([
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "csv",
  "ppt",
  "pptx",
  "zip",
  "png",
  "jpg",
  "jpeg",
  "webp",
]);

const allowedAudioExtensions = new Set(["webm", "m4a", "mp3", "wav", "ogg", "oga", "aac", "mp4"]);

function getExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
}

function safeFileName(fileName: string) {
  const extension = getExtension(fileName);
  const base = fileName
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return `${base || "attachment"}.${extension}`;
}

function isAllowedFile(file: File, viewerRole: "admin" | "client") {
  const extension = getExtension(file.name);
  const mimeType = file.type.toLowerCase();
  const isAudio = mimeType.startsWith("audio/") || allowedAudioExtensions.has(extension);

  if (isAudio) {
    return viewerRole === "admin" && allowedAudioExtensions.has(extension);
  }

  return allowedDocumentExtensions.has(extension);
}

export async function POST(request: NextRequest) {
  const viewer = await getInboxViewer();

  if (!viewer) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const requestedClientId = formData.get("client_id");

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File must be 25MB or smaller" }, { status: 400 });
  }

  if (!isAllowedFile(file, viewer.role)) {
    return NextResponse.json({ error: "This file type is not supported for inbox uploads" }, { status: 400 });
  }

  const clientId = viewer.role === "client" ? viewer.clientProfileId : typeof requestedClientId === "string" ? requestedClientId : null;

  if (!clientId) {
    return NextResponse.json({ error: "client_id is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: clientProfile } = await admin
    .from("client_profiles")
    .select("id")
    .eq("id", clientId)
    .single<{ id: string }>();

  if (!clientProfile || (viewer.role === "client" && clientProfile.id !== viewer.clientProfileId)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const extension = getExtension(file.name);
  const storedName = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const filePath = `inbox/${clientProfile.id}/${storedName}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error } = await admin.storage
    .from(INBOX_BUCKET)
    .upload(filePath, arrayBuffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: urlData } = admin.storage.from(INBOX_BUCKET).getPublicUrl(filePath);
  const displayName = safeFileName(file.name);

  return NextResponse.json({
    attachment: {
      id: crypto.randomUUID(),
      name: displayName,
      url: urlData.publicUrl,
      type: guessAttachmentType(displayName, file.type),
      size: formatFileSize(file.size),
    },
  });
}
