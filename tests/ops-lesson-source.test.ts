import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory stand-ins for the lesson source table, storage and task store.
const rows = new Map<string, Record<string, unknown>>();
const storage = { copy: vi.fn(async (..._a: unknown[]) => ({ error: null as null | { message: string } })), createSignedUploadUrl: vi.fn(async (path: string) => ({ data: { signedUrl: `https://db.example/upload/${path}?token=t` }, error: null })) };
const createTask = vi.fn(async (input: Record<string, unknown>) => ({ id: "task-1", ...input }));
function table() {
  const q: Record<string, unknown> = {};
  const api = {
    select: () => api,
    eq: (_c: string, v: string) => ((q.date = v), api),
    gte: () => api,
    order: () => api,
    limit: () => api,
    maybeSingle: async () => ({ data: q.date ? rows.get(String(q.date)) ?? null : [...rows.values()].sort((a, b) => String(b.lesson_date).localeCompare(String(a.lesson_date)))[0] ?? null, error: null }),
    upsert: async (row: Record<string, unknown>) => {
      rows.set(String(row.lesson_date), { ...(rows.get(String(row.lesson_date)) || {}), ...row });
      return { error: null };
    },
  };
  return api;
}
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: () => table(), storage: { from: () => storage } }) }));
vi.mock("@/lib/env", () => ({ getEnv: () => undefined }));
vi.mock("@/lib/ops/tasks", async (orig) => ({ ...(await orig<typeof import("@/lib/ops/tasks")>()), createTask: (i: Record<string, unknown>) => createTask(i) }));

import { advanceLessonSource, importLessonPackage, lessonDateFor, lessonSourceForSnapshot, pickLessonRecording } from "@/lib/ops/lesson-source";

const WED = new Date("2026-11-11T07:00:00Z");
const SHA = "9911e9bb8dfe5d4923e307fa9cb745e2ed084a301271f73742f136ad8c773e13";
const meeting = { title: "CBB Weekly LIVE Client Call", recording_id: 201755940, recording_start_time: "2026-11-10T19:28:59Z", recording_end_time: "2026-11-10T20:09:10Z" };

function fathom(downloadStatus = "completed") {
  return vi.fn(async (url: string, init?: RequestInit) => {
    expect((init?.headers as Record<string, string>)["X-Api-Key"]).toBe("k");
    const u = new URL(url);
    if (u.pathname.endsWith("/meetings")) return Response.json({ items: [{ ...meeting, recording_start_time: "2026-11-10T14:00:00Z" }, meeting] });
    if (u.pathname.endsWith("/download")) return Response.json({ download_id: "dl_1", status: "processing" });
    return Response.json({ status: downloadStatus, video: { url: "https://media.fathom.ai/v.mp4?sig=x", expires_at: "2026-11-11T12:00:00Z", file_size_bytes: 400000000, content_type: "video/mp4" } });
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  rows.clear();
  createTask.mockClear();
  storage.copy.mockClear();
});

describe("weekly lesson source", () => {
  it("only acts on Wednesdays, for Tuesday", () => {
    expect(lessonDateFor(WED)).toBe("2026-11-10");
    expect(lessonDateFor(new Date("2026-11-10T21:00:00Z"))).toBeNull();
  });

  it("picks the evening lesson call, not an afternoon meeting or a short one", () => {
    expect(pickLessonRecording([{ ...meeting, recording_start_time: "2026-11-10T14:00:00Z" }, meeting], "2026-11-10")?.recording_id).toBe(201755940);
    expect(pickLessonRecording([{ ...meeting, recording_end_time: "2026-11-10T19:40:00Z" }], "2026-11-10")).toBeNull();
  });

  it("finds the recording, requests the video, then marks it ready", async () => {
    const f = fathom();
    expect(await advanceLessonSource({ fetch: f, now: WED, key: "k" })).toEqual({ date: "2026-11-10", status: "ready" });
    expect(rows.get("2026-11-10")).toMatchObject({ status: "ready", recording_id: 201755940, download_id: "dl_1" });
  });

  it("records a week with no lesson call as normal, not a failure", async () => {
    const f = vi.fn(async () => Response.json({ items: [] })) as unknown as typeof fetch;
    expect(await advanceLessonSource({ fetch: f, now: WED, key: "k" })).toEqual({ date: "2026-11-10", status: "no_recording" });
  });

  it("gives the scheduled job a fresh video link and upload slot only while ready", async () => {
    await advanceLessonSource({ fetch: fathom(), now: WED, key: "k" });
    const s = (await lessonSourceForSnapshot({ fetch: fathom(), now: WED, key: "k" })) as unknown as Record<string, Record<string, unknown>>;
    expect(s.video.url).toContain("media.fathom.ai");
    expect(s.upload).toMatchObject({ method: "PUT", storage_path: "incoming/2026-11-10/201755940.mp4" });
    rows.set("2026-11-10", { ...rows.get("2026-11-10"), status: "packaged" });
    const after = (await lessonSourceForSnapshot({ fetch: fathom(), now: WED, key: "k" })) as Record<string, unknown>;
    expect(after.video).toBeUndefined();
    expect(after.upload).toBeUndefined();
  });

  it("turns the handoff into Eimear's review task with the video at its fingerprint name", async () => {
    await advanceLessonSource({ fetch: fathom(), now: WED, key: "k" });
    const pack = {
      schema_version: 1, lesson_ref: "lesson:2026-11-10:pricing-the-job", version: 1, mode: "append",
      module_id: "faa36657-fa83-4f66-87cb-cf597b3d75b2", title: "Pricing the Job", summary_md: "Summary", workbook_md: "",
      media: { storage_path: "incoming/2026-11-10/201755940.mp4", sha256: SHA },
    };
    await importLessonPackage({ kind: "lesson_package", lesson_date: "2026-11-10", lesson_package: pack });
    expect(storage.copy).toHaveBeenCalledWith("incoming/2026-11-10/201755940.mp4", `approved/${SHA}.mp4`);
    const task = createTask.mock.calls[0][0];
    expect(task).toMatchObject({ assignee: "eimear", area: "lessons", source: "system", external_ref: "lesson-review:lesson:2026-11-10:pricing-the-job:v1" });
    expect((task.payload as Record<string, Record<string, Record<string, unknown>>>).lesson_package.media.storage_path).toBe(`approved/${SHA}.mp4`);
    expect(rows.get("2026-11-10")).toMatchObject({ status: "packaged", task_id: "task-1" });
  });

  it("refuses a package pointing anywhere but this lesson's slot, or for another date", async () => {
    await advanceLessonSource({ fetch: fathom(), now: WED, key: "k" });
    const base = { schema_version: 1, lesson_ref: "lesson:2026-11-10:x", version: 1, mode: "append", module_id: "faa36657-fa83-4f66-87cb-cf597b3d75b2", title: "X", summary_md: "S", workbook_md: "" };
    await expect(importLessonPackage({ lesson_date: "2026-11-10", lesson_package: { ...base, media: { storage_path: `approved/${SHA}.mp4`, sha256: SHA } } })).rejects.toThrow("upload slot");
    await expect(importLessonPackage({ lesson_date: "2026-11-03", lesson_package: { ...base, media: { storage_path: "incoming/2026-11-03/1.mp4", sha256: SHA } } })).rejects.toThrow("No lesson source");
    expect(createTask).not.toHaveBeenCalled();
  });
});
