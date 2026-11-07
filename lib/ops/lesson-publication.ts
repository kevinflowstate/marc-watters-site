import { createAdminClient } from "@/lib/supabase/admin";
import { getEnv } from "@/lib/env";
import { OpsError, record, uuid } from "./tasks";
import { inspectLessonMp4, MAX_LESSON_VERIFY_BYTES } from "./publication-mp4";

export type LessonPublicationManifest = {
  schema_version: 1;
  lesson_ref: string;
  version: number;
  mode: "draft" | "publish";
  module_id: string;
  title: string;
  summary_md: string;
  workbook_md: string;
  source?: { ref: string; sha256: string | null };
  media: { verification_id: string; storage_path: string; sha256: string };
};
export type StoredLessonObject = {
  object_id: string;
  storage_path: string;
  updated_at: string;
  etag: string;
  bytes: number;
  mime_type: string;
};
export type LessonMediaVerification = StoredLessonObject & {
  id: string;
  sha256: string;
  duration_s: number;
  verified_by: string;
  verified_at: string;
};
export type LessonPublicationReceipt = {
  artifact_id: string;
  manifest_hash: string;
  version: number;
  mode: "draft" | "publish";
  recording_id: string;
  content_id: string;
  module_id: string;
  title: string;
  media_verification_id: string;
  media_sha256: string;
  duration_s: number;
  module_published: boolean;
  admin_url: string;
  training_url: string;
  completed_at: string;
};
export type LessonPublicationDeps = {
  object: (path: string) => Promise<StoredLessonObject>;
  signedUrl: (path: string) => Promise<string>;
  readMedia: (url: string) => Promise<Response>;
  saveVerification: (
    input: StoredLessonObject & { sha256: string; duration_s: number },
    actorId: string,
  ) => Promise<LessonMediaVerification>;
  verification: (id: string) => Promise<LessonMediaVerification>;
  publication: (
    recordingId: string,
  ) => Promise<{ media_verification_id: string; media_sha256: string } | null>;
  module: (id: string) => Promise<{
    id: string;
    title: string;
    is_published: boolean;
    content_count: number;
  }>;
  publish: (
    manifest: LessonPublicationManifest,
    proof: { artifact_id: string; claim_id: string },
  ) => Promise<LessonPublicationReceipt>;
  enabled: () => boolean;
};

function string(value: unknown, name: string, limit: number, empty = false) {
  if (
    typeof value !== "string" ||
    (!empty && !value.trim()) ||
    value.length > limit
  )
    throw new OpsError(`Invalid ${name}`);
  return value;
}
function exactKeys(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some((key) => !allowed.includes(key)))
    throw new OpsError("Unsupported lesson publication field");
}
export function lessonStoragePath(value: unknown) {
  const path = string(value, "private lesson storage path", 500);
  if (
    !/^approved\/[a-zA-Z0-9/_-]+\.mp4$/.test(path) ||
    path.includes("..") ||
    path.includes("//")
  )
    throw new OpsError("Use an approved/ private MP4 storage path");
  return path;
}
export function validateLessonPublicationManifest(
  input: unknown,
): LessonPublicationManifest {
  const b = record(input);
  exactKeys(b, [
    "schema_version",
    "lesson_ref",
    "version",
    "mode",
    "module_id",
    "title",
    "summary_md",
    "workbook_md",
    "media",
    "source",
  ]);
  const media = record(b.media);
  exactKeys(media, ["verification_id", "storage_path", "sha256"]);
  if (
    b.schema_version !== 1 ||
    !Number.isInteger(b.version) ||
    Number(b.version) < 1 ||
    Number(b.version) > 1000000
  )
    throw new OpsError("Valid lesson schema/version required");
  if (b.mode !== "draft" && b.mode !== "publish")
    throw new OpsError("Choose draft or publish explicitly");
  const ref = string(b.lesson_ref, "lesson_ref", 200);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9:._/-]*$/.test(ref))
    throw new OpsError("Invalid lesson_ref");
  if (typeof media.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(media.sha256))
    throw new OpsError("Verified lowercase SHA-256 required");
  let source: LessonPublicationManifest["source"];
  if (b.source !== undefined) {
    const suppliedSource = record(b.source);
    exactKeys(suppliedSource, ["ref", "sha256"]);
    if (
      suppliedSource.sha256 !== null &&
      (typeof suppliedSource.sha256 !== "string" ||
        !/^[a-f0-9]{64}$/.test(suppliedSource.sha256))
    )
      throw new OpsError("Invalid source SHA-256");
    source = {
      ref: string(suppliedSource.ref, "source ref", 500),
      sha256: suppliedSource.sha256 as string | null,
    };
  }
  return {
    schema_version: 1,
    lesson_ref: ref,
    version: Number(b.version),
    mode: b.mode,
    module_id: uuid(b.module_id),
    title: string(b.title, "title", 300),
    summary_md: string(b.summary_md, "summary_md", 50000, true),
    workbook_md: string(b.workbook_md, "workbook_md", 100000, true),
    ...(source ? { source } : {}),
    media: {
      verification_id: uuid(media.verification_id),
      storage_path: lessonStoragePath(media.storage_path),
      sha256: media.sha256,
    },
  };
}

function assertSameObject(a: StoredLessonObject, b: StoredLessonObject) {
  if (
    a.object_id !== b.object_id ||
    a.storage_path !== b.storage_path ||
    a.updated_at !== b.updated_at ||
    a.etag !== b.etag ||
    a.bytes !== b.bytes ||
    a.mime_type !== b.mime_type
  )
    throw new OpsError(
      "Stored media changed; verify and approve the new version",
      409,
    );
}
function dependencies(): LessonPublicationDeps {
  const db = () => createAdminClient();
  async function rpc<T>(name: string, args: Record<string, unknown>) {
    const result = await db().rpc(name, args);
    if (result.error || !result.data)
      throw new OpsError(
        result.error?.message || "Lesson publication state unavailable",
        409,
      );
    return result.data as T;
  }
  return {
    object: (path) =>
      rpc<StoredLessonObject>("ops_inspect_lesson_object", { p_path: path }),
    signedUrl: async (path) => {
      const result = await db()
        .storage.from("lesson-media")
        .createSignedUrl(path, 120);
      if (result.error || !result.data?.signedUrl)
        throw new OpsError("Private media read unavailable", 503);
      const source = new URL(result.data.signedUrl);
      const project = new URL(getEnv("NEXT_PUBLIC_SUPABASE_URL") || "");
      if (
        source.origin !== project.origin ||
        source.protocol !== "https:" ||
        !source.pathname.startsWith("/storage/v1/object/sign/lesson-media/")
      )
        throw new OpsError("Unexpected private media origin", 409);
      return source.toString();
    },
    readMedia: (url) =>
      fetch(url, {
        redirect: "error",
        signal: AbortSignal.timeout(90000),
        cache: "no-store",
      }),
    saveVerification: (input, actorId) =>
      rpc<LessonMediaVerification>("ops_register_lesson_media", {
        p_object: input,
        p_actor: actorId,
      }),
    verification: async (id) => {
      const result = await db()
        .from("ops_lesson_media_verifications")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (result.error || !result.data)
        throw new OpsError("Verified media receipt not found", 404);
      return result.data as LessonMediaVerification;
    },
    publication: async (recordingId) => {
      const result = await db()
        .from("ops_lesson_publications")
        .select("receipt")
        .eq("recording_id", recordingId)
        .maybeSingle();
      if (result.error)
        throw new OpsError("Lesson publication receipt unavailable", 503);
      if (!result.data) return null;
      const receipt = result.data.receipt;
      if (
        !receipt ||
        typeof receipt.media_verification_id !== "string" ||
        typeof receipt.media_sha256 !== "string"
      )
        throw new OpsError("Lesson publication receipt is incomplete", 409);
      return {
        media_verification_id: receipt.media_verification_id,
        media_sha256: receipt.media_sha256,
      };
    },
    module: async (id) => {
      const result = await db()
        .from("training_modules")
        .select("id,title,is_published")
        .eq("id", id)
        .maybeSingle();
      if (result.error || !result.data)
        throw new OpsError("Destination module not found", 404);
      const contents = await db()
        .from("module_content")
        .select("id", { count: "exact", head: true })
        .eq("module_id", id);
      if (contents.error)
        throw new OpsError("Destination contents unavailable", 503);
      return { ...result.data, content_count: contents.count ?? 0 };
    },
    publish: (manifest, proof) =>
      rpc<LessonPublicationReceipt>("ops_publish_lesson_artifact", {
        p_artifact: proof.artifact_id,
        p_claim: proof.claim_id,
        p_manifest: manifest,
      }),
    enabled: () => getEnv("OPS_LESSON_PUBLICATION_ENABLED") === "true",
  };
}

/** Must be exposed only through a verified admin route/worker. Streams at most 256 MiB. */
export async function verifyStoredLessonMedia(
  input: unknown,
  actorId: string,
  supplied?: LessonPublicationDeps,
) {
  const b = record(input);
  exactKeys(b, ["storage_path", "expected_sha256"]);
  const path = lessonStoragePath(b.storage_path);
  const actor = uuid(actorId);
  if (
    typeof b.expected_sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(b.expected_sha256)
  )
    throw new OpsError("Expected lowercase SHA-256 required");
  const deps = supplied || dependencies();
  const before = await deps.object(path);
  if (before.mime_type !== "video/mp4")
    throw new OpsError("Stored object must be video/mp4");
  if (!Number.isSafeInteger(before.bytes) || before.bytes <= 0)
    throw new OpsError("The stored video has no valid file size; upload a complete private MP4", 409);
  if (before.bytes > MAX_LESSON_VERIFY_BYTES)
    throw new OpsError(
      "Files above 256 MiB need a larger-file handoff or an agreed smaller export; the private copy can still be reviewed",
      413,
    );
  const inspected = await inspectLessonMp4(
    await deps.readMedia(await deps.signedUrl(path)),
    before.bytes,
  );
  if (inspected.sha256 !== b.expected_sha256)
    throw new OpsError(
      "Stored media hash does not match the intended lesson",
      409,
    );
  const after = await deps.object(path);
  assertSameObject(before, after);
  const verification = await deps.saveVerification(
    { ...after, sha256: inspected.sha256, duration_s: inspected.duration_s },
    actor,
  );
  return {
    verification,
    metadata_verified: true,
    playback_review_required: true,
    review: {
      title: "Video file checked — playback review still needed",
      summary: "The saved video matches this version. Eimear still needs to watch it and check the lesson materials.",
      published: false,
    },
  };
}

export async function previewLessonPublication(
  input: unknown,
  supplied?: LessonPublicationDeps,
) {
  const manifest = validateLessonPublicationManifest(input);
  const deps = supplied || dependencies();
  const verification = await deps.verification(manifest.media.verification_id);
  if (
    verification.storage_path !== manifest.media.storage_path ||
    verification.sha256 !== manifest.media.sha256
  )
    throw new OpsError("Media receipt does not match the lesson manifest", 409);
  const object = await deps.object(manifest.media.storage_path);
  assertSameObject(verification, object);
  const destination = await deps.module(manifest.module_id);
  if (destination.is_published)
    throw new OpsError(
      "Choose an unpublished destination module; this action cannot add material to an already published module",
      409,
    );
  if (manifest.mode === "publish" && destination.content_count !== 0)
    throw new OpsError(
      "Publishing requires an empty dedicated module to avoid exposing other drafts",
      409,
    );
  const remaining = [
    "Watch the edited video, especially the opening, ending and each join.",
    ...(!manifest.summary_md.trim() ? ["Add the lesson summary."] : []),
    ...(!manifest.workbook_md.trim() ? ["Add the draft workbook."] : []),
    "Eimear must approve this exact version and Training destination before it is added.",
  ];
  const materialsReady = Boolean(manifest.summary_md.trim() && manifest.workbook_md.trim());
  return {
    dry_run: true as const,
    manifest,
    verification,
    destination,
    would_publish_module: manifest.mode === "publish",
    publication_enabled: deps.enabled(),
    playback_review_required: true,
    review: {
      title: materialsReady ? "Lesson ready for Eimear’s review" : "Lesson preview — materials still needed",
      summary: materialsReady
        ? `The edited video and materials are prepared for ${destination.title}. This check has not added or published the lesson.`
        : `The edited video is saved for ${destination.title}. Add the missing lesson materials before Eimear reviews the complete pack. Nothing has been added or published.`,
      ready_for_review: materialsReady,
      destination: destination.title,
      remaining,
      published: false,
    },
  };
}

/** Admin redirect only: do not persist, expose in JSON or log the short-lived URL. */
export async function getVerifiedLessonMediaPreview(
  verificationId: string,
  supplied?: LessonPublicationDeps,
) {
  const id = uuid(verificationId);
  const deps = supplied || dependencies();
  const verification = await deps.verification(id);
  assertSameObject(verification, await deps.object(verification.storage_path));
  return { url: await deps.signedUrl(verification.storage_path), verification };
}

/** Preserve legacy media; new approved/ objects must still match their publication. */
export async function assertPublishedLessonMediaCurrent(
  recordingId: string,
  storagePath: string,
  supplied?: LessonPublicationDeps,
) {
  if (!storagePath.startsWith("approved/")) return;
  const id = uuid(recordingId);
  const deps = supplied || dependencies();
  const receipt = await deps.publication(id);
  if (!receipt)
    throw new OpsError("Approved lesson publication receipt is missing", 409);
  const verification = await deps.verification(
    uuid(receipt.media_verification_id),
  );
  if (
    verification.storage_path !== storagePath ||
    verification.sha256 !== receipt.media_sha256
  )
    throw new OpsError(
      "Lesson media differs from its publication approval",
      409,
    );
  assertSameObject(verification, await deps.object(storagePath));
}

/** Core must claim item 'lesson' first; SQL rechecks the persisted approval and claim. */
export async function publishLessonArtifact(
  input: unknown,
  proof: { artifact_id: string; claim_id: string },
  supplied?: LessonPublicationDeps,
) {
  const deps = supplied || dependencies();
  if (!deps.enabled())
    throw new OpsError(
      "Lesson publication is disabled; preview remains available",
      409,
    );
  const manifest = validateLessonPublicationManifest(input);
  const claim = {
    artifact_id: uuid(proof.artifact_id),
    claim_id: uuid(proof.claim_id),
  };
  // SQL checks current media and module atomically and returns the saved receipt on replay.
  return deps.publish(manifest, claim);
}

export async function getLesson(id: string) {
  const r = await createAdminClient()
    .from("lesson_recordings")
    .select("*")
    .eq("id", uuid(id))
    .maybeSingle();
  if (r.error) throw new OpsError(r.error.message, 503);
  if (!r.data) throw new OpsError("Recording not found", 404);
  return r.data;
}
