import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadWorkbookAssets, renderWorkbookPdf, validateWorkbookSpec, type WorkbookSpec } from "./workbook-pdf";
import { submitArtifact } from "./actions";
import { findCalendarWorkbook, storeCalendarWorkbook } from "./calendar-workbook";
import {
  validateLessonPublicationManifest,
  verifyStoredLessonMedia,
  type LessonPublicationManifest,
  type WorkbookPdfRef,
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

export type LessonPackage = Omit<LessonPublicationManifest, "media" | "workbook_pdf"> & {
  media: { storage_path: string; sha256: string };
  /** Structured workbook; the portal draws it as a CBB-style PDF. */
  workbook?: WorkbookSpec;
};

/** Same rules as a full lesson manifest, minus the check receipt that does not exist yet. */
export function validateLessonPackage(input: unknown): LessonPackage {
  const { workbook, workbook_pdf, ...b } = record(input);
  if (workbook_pdf !== undefined) throw new OpsError("The portal creates the workbook PDF; send the workbook outline instead");
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
    ...(workbook !== undefined ? { workbook: validateWorkbookSpec(workbook) } : {}),
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
  workbookPdf: (spec: WorkbookSpec, title: string) => Promise<WorkbookPdfRef>;
  /** Marc's own workbook attached to that Tuesday's portal calendar event, if any. */
  calendarWorkbook?: (lessonRef: string) => Promise<WorkbookPdfRef | null>;
};

function fileName(title: string) {
  const base = title.replace(/[^A-Za-z0-9 ]+/g, " ").trim().replace(/\s+/g, "_").slice(0, 80) || "Lesson";
  return `${base}_Workbook.pdf`;
}

/** Draws the workbook PDF and stores it privately next to the lesson video, named by its fingerprint. */
async function storeWorkbookPdf(spec: WorkbookSpec, title: string): Promise<WorkbookPdfRef> {
  const { bytes } = await renderWorkbookPdf(spec, { assets: await loadWorkbookAssets(), createdAt: new Date("2026-01-01T00:00:00Z") });
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const storage_path = `workbooks/${sha256}.pdf`;
  const upload = await createAdminClient()
    .storage.from("lesson-media")
    .upload(storage_path, bytes, { contentType: "application/pdf", upsert: false });
  if (upload.error && !/exists|duplicate/i.test(upload.error.message))
    throw new OpsError("The workbook PDF could not be saved", 503);
  return { storage_path, sha256, bytes: bytes.length, name: fileName(title) };
}

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
    workbookPdf: storeWorkbookPdf,
    calendarWorkbook: async (lessonRef) => {
      const found = await findCalendarWorkbook(lessonRef);
      return found ? storeCalendarWorkbook(found) : null;
    },
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
  const { workbook, ...lesson } = pack;
  // Marc's own workbook from the calendar wins; the generated one is only the fallback.
  const fromCalendar = d.calendarWorkbook ? await d.calendarWorkbook(pack.lesson_ref).catch(() => null) : null;
  const workbookPdf = fromCalendar ?? (workbook ? await d.workbookPdf(workbook, pack.title) : undefined);
  const manifest: LessonPublicationManifest = {
    ...lesson,
    ...(workbookPdf ? { workbook_pdf: workbookPdf } : {}),
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
    workbook_source: fromCalendar ? "calendar" : workbookPdf ? "generated" : "none",
    review_url: `/admin/work?artifact=${artifact.id}`,
  };
}
