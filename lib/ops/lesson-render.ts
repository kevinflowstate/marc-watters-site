import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { lessonPack, type EditPlan } from "./lesson-edit-plan";
import { importDriveResults } from "./drive-results";
import { importLessonPackage, lessonDateFor, lessonExport, loadLessonSource } from "./lesson-source";
import { launchLessonRender, stopLessonRender } from "./lesson-render-machine";
import { inspectLessonMp4 } from "./publication-mp4";
import { createTask, OpsError } from "./tasks";

type Job = {
  lesson_date: string; recording_id: number; plan: EditPlan; state: "awaiting_plan" | "queued" | "running";
  attempts: number; run_id: string; sandbox_name: string; expires_at: string; verify_only: boolean;
};
const db = () => createAdminClient();
const bucket = () => db().storage.from("lesson-media");
const prefix = (job: Job) => `incoming/renders/${job.lesson_date}/${job.run_id}`;

async function save(job: Job, change: Record<string, unknown>) {
  const r = await db().from("ops_lesson_edit_jobs").update({ ...change, updated_at: new Date().toISOString() })
    .eq("lesson_date", job.lesson_date).eq("run_id", job.run_id).eq("state", "running");
  if (r.error) throw new OpsError("Could not update the render job", 503);
}

async function failure(job: Job, message: string) {
  const retry = job.attempts < 3;
  await save(job, { state: retry ? "queued" : "failed", last_error: message });
  if (!retry) await createTask({
    kind: "task", area: "lessons", source: "system", assignee: "flowstate", priority: 1,
    external_ref: `lesson-edit-failed:${job.lesson_date}`, title: `Lesson edit needs attention · ${job.lesson_date}`,
    detail: `The portal tried three times. Last failing step: ${message}. The recording and editing instructions are saved.`,
  }, "system");
}

async function start(job: Job) {
  const run = randomUUID();
  const name = `cbb-lesson-${run}`;
  const claim = await db().from("ops_lesson_edit_jobs").update({ state: "running", run_id: run, sandbox_name: name,
    attempts: job.attempts + 1, expires_at: new Date(Date.now() + 60 * 60_000).toISOString(), updated_at: new Date().toISOString() })
    .eq("lesson_date", job.lesson_date).eq("state", "queued").eq("attempts", job.attempts).select("*").maybeSingle();
  if (claim.error) throw new OpsError("Could not claim queued edit", 503);
  if (!claim.data) return "claimed_elsewhere";
  job = claim.data as Job;
  let stage = "reading the lesson source";
  try {
    const src = await loadLessonSource(job.lesson_date);
    if (!src || src.recording_id !== job.recording_id) throw new Error("identity");
    if (src.status === "packaged" && !job.verify_only) {
      await save(job, { state: "done", last_error: null });
      return "already_packaged";
    }
    stage = "fetching a fresh Fathom video export";
    const video = await lessonExport(src);
    stage = "preparing private output slots";
    const [media, receipt] = await Promise.all(["video.mp4", "receipt.json"].map(f => bucket().createSignedUploadUrl(`${prefix(job)}/${f}`)));
    if (!media.data || !receipt.data) throw new Error("slot");
    stage = "starting the hosted editor";
    await launchLessonRender(name, job.plan, video, media.data.signedUrl, receipt.data.signedUrl);
    return "render_started";
  } catch {
    await failure(job, stage);
    return "start_failed";
  }
}

async function collect(job: Job) {
  const path = prefix(job);
  const raw = await bucket().download(`${path}/receipt.json`);
  if (raw.error || !raw.data) {
    if (Date.parse(job.expires_at) > Date.now()) return "rendering";
    await failure(job, "waiting for the hosted editor’s upload receipt");
    return "receipt_missing";
  }
  // The receipt was uploaded to this particular attempt's private, one-use slot.
  if (raw.data.size > 4096) throw new OpsError("Oversized render receipt", 409);
  const r = JSON.parse(await raw.data.text());
  await stopLessonRender(job.sandbox_name).catch(() => undefined); // VM also has a hard expiry
  if (!r.ok) {
    const stages = ["source download", "source decode and transcript alignment", "edit plan and render", "edited video decode", "private media upload"];
    await failure(job, stages.includes(r.stage) ? r.stage : "executing the edit");
    return "render_failed";
  }
  if (r.recording_id !== job.recording_id || !/^[a-f0-9]{64}$/.test(r.sha256) || !Number.isSafeInteger(r.bytes) ||
      !(r.bytes > 0 && r.bytes <= 4 * 1024 ** 3) || !(r.duration_s > 0 && r.original_s >= r.duration_s - 0.5))
    throw new OpsError("Invalid hosted editor receipt", 409);
  const mediaPath = `${path}/video.mp4`;
  const link = await bucket().createSignedUrl(mediaPath, 600);
  if (!link.data) throw new OpsError("Cannot read the private edited video", 503);
  const checked = await inspectLessonMp4(await fetch(link.data.signedUrl, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(240000) }), r.bytes);
  if (checked.sha256 !== r.sha256 || Math.abs(checked.duration_s - r.duration_s) > 0.6)
    throw new OpsError("Stored edit differs from the hosted render", 409);
  const src = await loadLessonSource(job.lesson_date);
  if (!src || src.recording_id !== job.recording_id) throw new OpsError("The lesson source changed", 409);
  if (!job.verify_only && src.status !== "packaged") {
    const detail = r.original_s - r.duration_s < 1 ? "Original replay retained under the three-minute edit rule. " : "";
    await importLessonPackage({ lesson_date: job.lesson_date, review_note: (detail + job.plan.review_note).slice(0, 2000),
      lesson_package: lessonPack(job.plan, mediaPath, r.sha256) }, mediaPath);
  }
  await save(job, { state: "done", receipt: r, last_error: null });
  await bucket().remove([mediaPath, `${path}/receipt.json`]);
  return job.verify_only ? "rehearsal_verified" : "packaged";
}

export async function advanceLessonEdit() {
  const res = await db().from("ops_lesson_edit_jobs").select("*").in("state", ["awaiting_plan", "queued", "running"])
    .order("lesson_date").limit(1).maybeSingle();
  if (res.error) throw new OpsError("Cannot read the edit queue", 503);
  let job = res.data as Job | null;
  if (!job || job.state === "awaiting_plan") {
    const date = job?.lesson_date ?? lessonDateFor(new Date());
    if (!date) return { status: "idle" };
    const source = await loadLessonSource(date);
    if (!job && source?.status !== "ready") return { status: "idle" };
    const imported = await importDriveResults({ lessonDate: date });
    if (!imported.configured || imported.problems.length)
      throw new OpsError(imported.problems[0]?.reason ?? "Lesson handoff folder unavailable", 503);
    const queued = await db().from("ops_lesson_edit_jobs").select("*").eq("lesson_date", date).eq("state", "queued").maybeSingle();
    if (queued.error) throw new OpsError("Cannot read the imported lesson plan", 503);
    job = queued.data as Job | null;
    if (!job) return { date, status: "waiting_for_plan" };
  }
  return { date: job.lesson_date, status: job.state === "queued" ? await start(job) : await collect(job) };
}
