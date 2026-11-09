import { createAdminClient } from "@/lib/supabase/admin";
import { getEnv } from "@/lib/env";
import { OpsError, record } from "./tasks";
import { MAX_LESSON_VERIFY_BYTES } from "./publication-mp4";

const MAX_BYTES = MAX_LESSON_VERIFY_BYTES;
export type LessonUploadDeps = {
  projectRef(): string;
  bucket(): Promise<{ public: boolean; file_size_limit: number | null }>;
  exists(path: string): Promise<boolean>;
  uploadToken(path: string): Promise<string>;
  readUrl(path: string): Promise<string>;
};

function dependencies(): LessonUploadDeps {
  const db = createAdminClient();
  const storage = db.storage.from("lesson-media");
  return {
    projectRef() {
      const url = new URL(getEnv("NEXT_PUBLIC_SUPABASE_URL") || "");
      const match = /^([a-z0-9]{20})\.supabase\.co$/.exec(url.hostname);
      if (url.protocol !== "https:" || !match) throw new OpsError("Private storage configuration needs checking", 503);
      return match[1];
    },
    async bucket() {
      const result = await db.storage.getBucket("lesson-media");
      if (result.error || !result.data) throw new OpsError("Private lesson storage could not be checked", 503);
      return { public: result.data.public, file_size_limit: result.data.file_size_limit ?? null };
    },
    async exists(path) {
      const result = await storage.info(path);
      if (!result.error) return true;
      if (String(result.error.statusCode) === "404") return false;
      throw new OpsError("Private lesson object could not be checked", 503);
    },
    async uploadToken(path) {
      const result = await storage.createSignedUploadUrl(path, { upsert: false });
      if (result.error || !result.data?.token) throw new OpsError("Private lesson upload could not be prepared", 503);
      return result.data.token;
    },
    async readUrl(path) {
      const result = await storage.createSignedUrl(path, 3600);
      if (result.error || !result.data?.signedUrl) throw new OpsError("Private lesson readback could not be prepared", 503);
      return result.data.signedUrl;
    },
  };
}

/** Grant only one content-addressed MP4 path. No client gets the storage service key. */
export async function prepareLessonTransfer(input: unknown, deps?: LessonUploadDeps) {
  const b = record(input);
  if (Object.keys(b).some((key) => !["action", "sha256", "bytes"].includes(key)) ||
      !["upload", "readback"].includes(String(b.action)) ||
      typeof b.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(b.sha256) ||
      !Number.isSafeInteger(b.bytes) || Number(b.bytes) <= 0 || Number(b.bytes) > MAX_BYTES)
    throw new OpsError("Choose upload or readback and supply the complete MP4’s size and SHA-256");
  const d = deps ?? dependencies();
  const bucket = await d.bucket();
  if (bucket.public !== false) throw new OpsError("Lesson storage must remain private", 409);
  if (bucket.file_size_limit !== null && Number(b.bytes) > bucket.file_size_limit)
    throw new OpsError("This lesson exceeds the storage bucket’s configured file limit. Review larger-file storage before uploading", 413);
  const storage_path = `approved/${b.sha256}.mp4`;
  const exists = await d.exists(storage_path);
  if (b.action === "upload" && exists) throw new OpsError("This version already exists. Verify it instead of overwriting it", 409);
  if (b.action === "readback" && !exists) throw new OpsError("Complete the private upload before requesting readback", 409);
  return {
    schema_version: 1,
    project_ref: d.projectRef(), storage_path, sha256: b.sha256, bytes: Number(b.bytes),
    ...(b.action === "upload" ? { upload_token: await d.uploadToken(storage_path) }
      : { readback_url: await d.readUrl(storage_path) }),
    portal_size_supported: Number(b.bytes) <= MAX_LESSON_VERIFY_BYTES,
    approval: null, publication_enabled: false,
    note: "Temporary private transfer grant. Store owner-only; do not paste into chat or logs. This is not a publication verification receipt.",
  };
}
