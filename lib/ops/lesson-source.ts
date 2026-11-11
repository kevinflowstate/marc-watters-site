import { getEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { londonClock } from "./job-health";
import { validateLessonPackage } from "./lesson-review";
import { createTask, OpsError, record } from "./tasks";

/**
 * Scheduled Codex runs get no secrets, so they cannot call Fathom or the portal. The portal does
 * those parts and hands the run SHORT-LIVED links through Marc's Drive snapshot:
 *  1. Wednesday from 06:00: find Tuesday's 19:30 lesson recording in Fathom and ask Fathom to prepare the MP4.
 *  2. Every snapshot (20 and 50 past): a fresh Fathom video link (expires in hours) and a fresh one-file
 *     upload slot (expires in 2 hours) for the finished lesson video.
 *  3. Codex edits, uploads to the slot and leaves lesson_package-YYYY-MM-DD.json in the handoff folder.
 *  4. The portal moves the upload to its fingerprint name and opens Eimear's lesson review task.
 * No permanent key ever leaves the portal.
 */

const FATHOM = "https://api.fathom.ai/external/v1";
const BUCKET = "lesson-media";
const DAY = 86_400_000;

type Row = {
  lesson_date: string;
  status: "no_recording" | "requested" | "ready" | "packaged" | "failed";
  recording_id: number | null;
  title: string | null;
  recording_start: string | null;
  recording_end: string | null;
  download_id: string | null;
  video_bytes: number | null;
  error: string | null;
  task_id: string | null;
};

type Deps = { fetch?: typeof fetch; now?: Date; key?: string };

function fathomKey(deps: Deps) {
  return (deps.key ?? getEnv("FATHOM_API_KEY") ?? "").trim();
}

async function fathom(path: string, deps: Deps, method: "GET" | "POST" = "GET") {
  const key = fathomKey(deps);
  if (!key) throw new OpsError("Fathom is not connected to the portal", 503);
  const r = await (deps.fetch ?? fetch)(`${FATHOM}${path}`, {
    method,
    headers: { "X-Api-Key": key, Accept: "application/json", ...(method === "POST" ? { "Content-Type": "application/json" } : {}) },
    body: method === "POST" ? "{}" : undefined,
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) throw new OpsError(`Fathom refused the request (${r.status})`, r.status === 429 ? 429 : 502);
  return record(await r.json());
}

/** The Tuesday a Wednesday run is about (London dates). */
export function lessonDateFor(now: Date) {
  const clock = londonClock(now);
  const weekday = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short" }).format(now);
  if (weekday !== "Wed") return null;
  return new Date(Date.parse(`${clock.date}T12:00:00Z`) - DAY).toISOString().slice(0, 10);
}

/** Tuesday lesson: starts 18:45-20:30 London and runs at least 20 minutes. */
export function pickLessonRecording(items: Record<string, unknown>[], date: string) {
  for (const m of items) {
    const start = Date.parse(String(m.recording_start_time ?? ""));
    const end = Date.parse(String(m.recording_end_time ?? ""));
    if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isSafeInteger(m.recording_id)) continue;
    const at = londonClock(new Date(start));
    if (at.date !== date || at.minutes < 18 * 60 + 45 || at.minutes > 20 * 60 + 30) continue;
    if (end - start < 20 * 60_000) continue;
    return {
      recording_id: Number(m.recording_id),
      title: String(m.title ?? m.meeting_title ?? "").slice(0, 200),
      recording_start: new Date(start).toISOString(),
      recording_end: new Date(end).toISOString(),
    };
  }
  return null;
}

async function loadRow(date: string) {
  const r = await createAdminClient().from("ops_lesson_sources").select("*").eq("lesson_date", date).maybeSingle();
  if (r.error) throw new OpsError("Lesson source state could not be read", 503);
  return (r.data as Row | null) ?? null;
}

async function saveRow(row: Partial<Row> & { lesson_date: string }) {
  const r = await createAdminClient()
    .from("ops_lesson_sources")
    .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "lesson_date" });
  if (r.error) throw new OpsError("Lesson source state could not be saved", 503);
}

/** One step per cron run: find the recording, request the MP4, wait for Fathom to finish preparing it. */
export async function advanceLessonSource(deps: Deps = {}) {
  const now = deps.now ?? new Date();
  const date = lessonDateFor(now);
  if (!date) return { date: null, status: "not_lesson_day" };
  let row = await loadRow(date);
  if (!row) {
    const from = `${date}T16:00:00Z`;
    const to = new Date(Date.parse(from) + 15 * 3_600_000).toISOString();
    const list = await fathom(`/meetings?${new URLSearchParams({ created_after: from, created_before: to })}`, deps);
    const found = pickLessonRecording((Array.isArray(list.items) ? list.items : []) as Record<string, unknown>[], date);
    if (!found) {
      // Normal in event weeks: Marc runs no Tuesday call the week before, of and after an event.
      await saveRow({ lesson_date: date, status: "no_recording" });
      return { date, status: "no_recording" };
    }
    const dl = await fathom(`/recordings/${found.recording_id}/download`, deps, "POST");
    if (typeof dl.download_id !== "string") throw new OpsError("Fathom did not return a download", 502);
    row = { ...found, lesson_date: date, status: "requested", download_id: dl.download_id, video_bytes: null, error: null, task_id: null };
    await saveRow(row);
  }
  if (row.status === "requested" && row.recording_id && row.download_id) {
    const st = await fathom(`/recordings/${row.recording_id}/downloads/${encodeURIComponent(row.download_id)}`, deps);
    const video = record(st.video ?? {});
    if (st.status === "completed" && typeof video.url === "string") {
      await saveRow({ lesson_date: date, status: "ready", video_bytes: Number(video.file_size_bytes) || null });
      return { date, status: "ready" };
    }
    if (st.status === "failed") {
      await saveRow({ lesson_date: date, status: "failed", error: "Fathom could not prepare the video" });
      return { date, status: "failed" };
    }
  }
  return { date, status: row.status };
}

const uploadPath = (row: Row) => `incoming/${row.lesson_date}/${row.recording_id}.mp4`;

/** What the scheduled lesson job sees in the snapshot. Links are fresh on every snapshot write. */
export async function lessonSourceForSnapshot(deps: Deps = {}) {
  const now = deps.now ?? new Date();
  const r = await createAdminClient()
    .from("ops_lesson_sources")
    .select("*")
    .gte("lesson_date", new Date(now.getTime() - 3 * DAY).toISOString().slice(0, 10))
    .order("lesson_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (r.error) return { status: "unavailable" };
  const row = r.data as Row | null;
  if (!row) return { status: "none_yet", note: "The portal looks for Tuesday's lesson recording from 06:00 on Wednesday." };
  const base = {
    lesson_date: row.lesson_date,
    status: row.status,
    title: row.title,
    recording_id: row.recording_id,
    recording_start: row.recording_start,
    recording_end: row.recording_end,
    handoff_file: `lesson_package-${row.lesson_date}.json`,
  };
  if (row.status !== "ready" || !row.recording_id || !row.download_id) return base;
  const st = await fathom(`/recordings/${row.recording_id}/downloads/${encodeURIComponent(row.download_id)}`, deps);
  const video = record(st.video ?? {});
  const slot = await createAdminClient().storage.from(BUCKET).createSignedUploadUrl(uploadPath(row), { upsert: true });
  if (slot.error || !slot.data) return { ...base, status: "unavailable" };
  return {
    ...base,
    notice:
      "These two links are private and short-lived. Use them only for this lesson, never copy them into any other file, message or result.",
    video: {
      url: typeof video.url === "string" ? video.url : null,
      expires_at: video.expires_at ?? null,
      bytes: video.file_size_bytes ?? row.video_bytes,
      content_type: video.content_type ?? "video/mp4",
    },
    upload: {
      method: "PUT",
      url: slot.data.signedUrl,
      storage_path: uploadPath(row),
      content_type: "video/mp4",
      expires: "2 hours after observed_at; a fresh slot appears in every snapshot",
    },
  };
}

/**
 * Turns a lesson_package-YYYY-MM-DD.json from the handoff folder into Eimear's lesson review task.
 * The upload is moved to approved/<sha256>.mp4; Eimear's "Check the video" step re-hashes it, so a
 * wrong fingerprint is caught before anything can be approved.
 */
export async function importLessonPackage(doc: unknown) {
  const d = record(doc);
  const pack = record(d.lesson_package);
  const media = record(pack.media);
  const lessonDate = String(d.lesson_date ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lessonDate)) throw new OpsError("lesson_date is required");
  const row = await loadRow(lessonDate);
  if (!row || !row.recording_id || !["ready", "packaged"].includes(row.status))
    throw new OpsError("No lesson source is waiting for this date");
  if (media.storage_path !== uploadPath(row)) throw new OpsError("The lesson video must be in this lesson's upload slot");
  if (typeof media.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(media.sha256)) throw new OpsError("A SHA-256 fingerprint is required");
  const approved = `approved/${media.sha256}.mp4`;
  const finalPack = validateLessonPackage({ ...pack, media: { storage_path: approved, sha256: media.sha256 } });
  if (!finalPack.lesson_ref.startsWith(`lesson:${lessonDate}:`)) throw new OpsError("lesson_ref must start with lesson:<date>:");

  const storage = createAdminClient().storage.from(BUCKET);
  const copied = await storage.copy(uploadPath(row), approved);
  if (copied.error && !/exists|duplicate/i.test(copied.error.message))
    throw new OpsError("The uploaded lesson video was not found in its slot", 409);

  const task = await createTask(
    {
      kind: "task",
      area: "lessons",
      assignee: "eimear",
      source: "system",
      priority: 2,
      external_ref: `lesson-review:${finalPack.lesson_ref}:v${finalPack.version}`,
      title: `${finalPack.title} · lesson ready to review`,
      detail: `Last Tuesday's call (${lessonDate}), prepared by Codex. Check the video, read the summary and workbook, then approve it for ${finalPack.mode === "append" ? "Call Replays" : "Training"} or request changes.`,
      payload: { lesson_package: { ...pack, media: { storage_path: approved, sha256: media.sha256 } } },
    },
    "system",
  );
  await saveRow({ lesson_date: lessonDate, status: "packaged", task_id: task.id });
  return { task_id: task.id };
}

/** Wednesday 13:00 London onward: a recording was ready but no lesson came back. */
export async function lessonOverdue(now = new Date()) {
  const date = lessonDateFor(now);
  if (!date || londonClock(now).minutes < 13 * 60) return null;
  const row = await loadRow(date);
  if (!row || !["requested", "ready", "failed"].includes(row.status)) return null;
  await createTask(
    {
      kind: "task",
      area: "lessons",
      assignee: "flowstate",
      source: "system",
      priority: 1,
      external_ref: `job-health:missed:lesson:${date}`,
      title: `Weekly lesson has not arrived · ${date}`,
      detail:
        row.status === "failed"
          ? "Fathom could not prepare last night's video. Check the recording in Fathom, then run the lesson in Marc's Codex by hand."
          : "Last night's recording was ready but no lesson came back from the scheduled Codex lesson job. In Marc's Codex, check the CBB — Weekly lesson job's last run; if it did not finish, run the lesson by hand in a chat.",
    },
    "system",
  ).catch(() => undefined);
  return date;
}
