import { createAdminClient } from "@/lib/supabase/admin";
import { submitArtifact } from "./actions";
import {
  validateLessonPublicationManifest,
  verifyStoredLessonMedia,
  type LessonPublicationManifest,
} from "./lesson-publication";
import { completeTask, OpsError, record, uuid } from "./tasks";

/**
 * Codex cannot check a stored lesson video itself (the check is recorded against a person), so it
 * hands over a lesson PACKAGE on Eimear's review task: title, summary, workbook, destination module
 * and the private video's storage path and fingerprint. One click by an admin checks the video,
 * records that admin as the checker, and turns the package into the normal lesson review
 * (player, summary, workbook, Approve). Nothing is added to Training or published here.
 */

const PLACEHOLDER_ID = "00000000-0000-4000-8000-000000000000";

export type LessonPackage = Omit<LessonPublicationManifest, "media"> & {
  media: { storage_path: string; sha256: string };
};

/** Same rules as a full lesson manifest, minus the check receipt that does not exist yet. */
export function validateLessonPackage(input: unknown): LessonPackage {
  const b = record(input);
  const media = record(b.media);
  if (Object.keys(media).some((k) => !["storage_path", "sha256"].includes(k)))
    throw new OpsError("Lesson package media takes storage_path and sha256 only");
  const manifest = validateLessonPublicationManifest({
    ...b,
    media: { ...media, verification_id: PLACEHOLDER_ID },
  });
  return {
    ...manifest,
    media: { storage_path: manifest.media.storage_path, sha256: manifest.media.sha256 },
  };
}

export function lessonPackageFromTask(task: { payload?: unknown }) {
  const payload = task.payload && typeof task.payload === "object" ? (task.payload as Record<string, unknown>) : {};
  if (!payload.lesson_package) return null;
  return validateLessonPackage(payload.lesson_package);
}

type Deps = {
  loadTask: (id: string) => Promise<{ id: string; status: string; area: string; payload: unknown }>;
  verify: typeof verifyStoredLessonMedia;
  submit: typeof submitArtifact;
  complete: typeof completeTask;
};

function dependencies(): Deps {
  return {
    loadTask: async (id) => {
      const r = await createAdminClient()
        .from("ops_tasks")
        .select("id,status,area,payload")
        .eq("id", id)
        .maybeSingle();
      if (r.error) throw new OpsError("The lesson task could not be loaded", 503);
      if (!r.data) throw new OpsError("Lesson task not found", 404);
      return r.data;
    },
    verify: verifyStoredLessonMedia,
    submit: submitArtifact,
    complete: completeTask,
  };
}

export async function startLessonReview(
  input: unknown,
  adminId: string,
  supplied?: Deps,
) {
  const b = record(input);
  if (Object.keys(b).some((k) => k !== "task_id"))
    throw new OpsError("Only task_id is accepted");
  const taskId = uuid(b.task_id);
  const actor = uuid(adminId);
  const d = supplied ?? dependencies();
  const task = await d.loadTask(taskId);
  if (["done", "cancelled", "approved", "rejected"].includes(task.status))
    throw new OpsError("This task is already closed", 409);
  const pack = lessonPackageFromTask(task);
  if (!pack) throw new OpsError("This task has no lesson package to review", 409);

  // Re-reads the private file and checks its fingerprint; the admin is recorded as the checker.
  const checked = await d.verify(
    { storage_path: pack.media.storage_path, expected_sha256: pack.media.sha256 },
    actor,
  );
  const manifest: LessonPublicationManifest = {
    ...pack,
    media: {
      verification_id: uuid(checked.verification.id),
      storage_path: pack.media.storage_path,
      sha256: pack.media.sha256,
    },
  };
  validateLessonPublicationManifest(manifest);
  const artifact = await d.submit(
    {
      external_ref: `lesson:${pack.lesson_ref}:v${pack.version}`,
      kind: "lesson",
      action: "publish_lesson",
      title: pack.title,
      payload: manifest,
      destination: { module_id: pack.module_id },
      item_keys: ["lesson"],
    },
    actor,
  );
  await d.complete(taskId, "Video checked. The lesson review is open under Prepared by Codex.", actor);
  return {
    artifact_id: artifact.id,
    duration_s: checked.verification.duration_s,
    review_url: `/admin/work?artifact=${artifact.id}`,
  };
}
