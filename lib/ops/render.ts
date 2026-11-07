import { getEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { OpsError, record, uuid } from "./tasks";
export async function updateRenderJob(id: string, input: unknown) {
  const b = record(input);
  if (!["running", "done", "failed"].includes(String(b.status)))
    throw new OpsError("Invalid render status");
  const progress = Number(b.progress ?? 0);
  if (!Number.isInteger(progress) || progress < 0 || progress > 100)
    throw new OpsError("Invalid progress");
  const r = await createAdminClient().rpc("ops_render_callback", {
    p_job: uuid(id),
    p_status: b.status,
    p_progress: progress,
    p_path:
      typeof b.output_storage_path === "string" ? b.output_storage_path : null,
    p_error: typeof b.error === "string" ? b.error.slice(0, 1000) : null,
  });
  if (r.error) throw new OpsError(r.error.message, 409);
  return r.data;
}

export async function dispatchRenderJob(id: string) {
  if (getEnv("OPS_LEGACY_LESSON_PIPELINE_ENABLED") !== "true")
    throw new OpsError(
      "Hosted lesson processing is not enabled; prepare the lesson in Codex",
      409,
    );
  const db = createAdminClient(),
    job = await db.from("render_jobs").select("*").eq("id", uuid(id)).single();
  if (job.error) throw new OpsError("Job not found", 404);
  if (job.data.status !== "queued") return job.data;
  const host = getEnv("RENDER_HOST_URL");
  if (!host) {
    await db
      .from("render_jobs")
      .update({ error: "worker not configured" })
      .eq("id", id);
    console.info("worker not configured");
    return job.data;
  }
  const parsed = new URL(host);
  if (
    parsed.protocol !== "https:" &&
    !(
      process.env.NODE_ENV !== "production" &&
      ["127.0.0.1", "localhost"].includes(parsed.hostname)
    )
  )
    throw new OpsError("Worker requires HTTPS", 503);
  if (!getEnv("RENDER_HOST_SECRET") || !getEnv("OPS_API_TOKEN"))
    throw new OpsError("Worker secrets are not configured", 503);
  const lesson = await db
    .from("lesson_recordings")
    .select("*")
    .eq("id", job.data.recording_id)
    .single();
  if (lesson.error) throw new OpsError("Recording unavailable", 404);
  let source = job.data.payload?.source_url || null;
  if (job.data.job_type !== "copy_source") {
    if (!lesson.data.source_storage_path)
      throw new OpsError("Source copy not ready", 409);
    const signed = await db.storage
      .from("lesson-media")
      .createSignedUrl(lesson.data.source_storage_path, 3600);
    if (signed.error) throw new OpsError("Source unavailable", 503);
    source = signed.data.signedUrl;
  }
  const path =
    job.data.job_type === "copy_source"
      ? `source/${lesson.data.id}.mp4`
      : `edited/${lesson.data.id}-${id}.mp4`;
  const portal = getEnv("NEXT_PUBLIC_SITE_URL");
  if (!portal) throw new OpsError("Portal URL not configured", 503);
  try {
    const response = await fetch(host.replace(/\/$/, "") + "/jobs", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-render-secret": getEnv("RENDER_HOST_SECRET")!,
      },
      body: JSON.stringify({
        job_id: id,
        job_type: job.data.job_type,
        source_url: source,
        fathom: job.data.payload,
        cut_list: job.data.cut_list,
        callback_url: `${portal}/api/ops/render-jobs/${id}`,
        output_storage_path: path,
        upload: {
          supabase: {
            url: getEnv("NEXT_PUBLIC_SUPABASE_URL"),
            service_key: getEnv("SUPABASE_SERVICE_ROLE_KEY"),
            bucket: "lesson-media",
            path,
          },
        },
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error("Worker unavailable");
    await db.from("render_jobs").update({ error: null }).eq("id", id);
    return job.data;
  } catch {
    await db
      .from("render_jobs")
      .update({ error: "Worker unavailable; retry queued worker" })
      .eq("id", id);
    throw new OpsError("Worker unavailable; job remains queued", 503);
  }
}
