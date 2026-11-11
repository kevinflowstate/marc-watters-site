import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("../lib/ops/actions", () => ({ submitArtifact: vi.fn() }));
vi.mock("@/lib/ops/actions", () => ({ submitArtifact: vi.fn() }));

import { startLessonReview, validateLessonPackage } from "../lib/ops/lesson-review";

const ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TASK = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MODULE = "faa36657-fa83-4f66-87cb-cf597b3d75b2";
const VERIFY = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const SHA = "9911e9bb8dfe5d4923e307fa9cb745e2ed084a301271f73742f136ad8c773e13";
const pack = {
  schema_version: 1,
  lesson_ref: "lesson:2026-11-03:start-from-the-source",
  version: 1,
  mode: "append",
  module_id: MODULE,
  title: "Start from the Source",
  summary_md: "Why winning more work starts with where your leads come from.",
  workbook_md: "1. List your last ten jobs and where each lead came from.",
  media: { storage_path: `approved/${SHA}.mp4`, sha256: SHA },
};

function deps(over: Record<string, unknown> = {}) {
  return {
    loadTask: vi.fn(async () => ({ id: TASK, status: "awaiting_approval", area: "lessons", payload: { lesson_package: pack } })),
    verify: vi.fn(async () => ({ verification: { id: VERIFY, duration_s: 3536 } })),
    submit: vi.fn(async () => ({ id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" })),
    complete: vi.fn(async () => ({})),
    workbookPdf: vi.fn(async () => ({ storage_path: `workbooks/${"a".repeat(64)}.pdf`, sha256: "a".repeat(64), bytes: 640000, name: "Start_from_the_Source_Workbook.pdf" })),
    ...over,
  } as never;
}

describe("lesson package to lesson review", () => {
  it("validates a package without a check receipt and rejects extra media fields", () => {
    expect(validateLessonPackage(pack).media).toEqual({ storage_path: pack.media.storage_path, sha256: SHA });
    expect(() => validateLessonPackage({ ...pack, media: { ...pack.media, verification_id: VERIFY } })).toThrow(
      "storage_path and sha256 only",
    );
  });

  it("checks the exact file as the signed-in admin, then submits the full lesson review", async () => {
    const d = deps() as unknown as Record<string, ReturnType<typeof vi.fn>>;
    const out = await startLessonReview({ task_id: TASK }, ADMIN, d as never);
    expect(d.verify).toHaveBeenCalledWith({ storage_path: pack.media.storage_path, expected_sha256: SHA }, ADMIN);
    const [submitted, actor] = d.submit.mock.calls[0];
    expect(actor).toBe(ADMIN);
    expect(submitted).toMatchObject({
      external_ref: "lesson:lesson:2026-11-03:start-from-the-source:v1",
      kind: "lesson",
      action: "publish_lesson",
      destination: { module_id: MODULE },
      item_keys: ["lesson"],
    });
    expect(submitted.payload.media).toEqual({ verification_id: VERIFY, storage_path: pack.media.storage_path, sha256: SHA });
    expect(submitted.payload.mode).toBe("append");
    expect(d.complete).toHaveBeenCalledWith(TASK, expect.stringContaining("Video checked"), ADMIN);
    expect(out.review_url).toBe("/admin/work?artifact=dddddddd-dddd-4ddd-8ddd-dddddddddddd");
  });

  it("uses Marc's workbook from the portal calendar instead of drawing one", async () => {
    const workbook = { title: "Start From The Source", sections: [{ title: "Map it out", blocks: [{ type: "write", question: "Where?" }] }] };
    const marc = { storage_path: `workbooks/${"b".repeat(64)}.pdf`, sha256: "b".repeat(64), bytes: 40777, name: "CBB_From_Sold_to_Signed_Off_Workbook.pdf" };
    const d = deps({
      loadTask: vi.fn(async () => ({ id: TASK, status: "awaiting_approval", area: "lessons", payload: { lesson_package: { ...pack, workbook } } })),
      calendarWorkbook: vi.fn(async () => marc),
    }) as unknown as Record<string, ReturnType<typeof vi.fn>>;
    const out = await startLessonReview({ task_id: TASK }, ADMIN, d as never);
    expect(d.calendarWorkbook).toHaveBeenCalledWith("lesson:2026-11-03:start-from-the-source");
    expect(d.workbookPdf).not.toHaveBeenCalled();
    expect(d.submit.mock.calls[0][0].payload.workbook_pdf).toEqual(marc);
    expect(out.workbook_source).toBe("calendar");
  });

  it("falls back to the drawn workbook when the calendar has none or cannot be read", async () => {
    const workbook = { title: "Start From The Source", sections: [{ title: "Map it out", blocks: [{ type: "write", question: "Where?" }] }] };
    for (const calendarWorkbook of [vi.fn(async () => null), vi.fn(async () => { throw new Error("down"); })]) {
      const d = deps({
        loadTask: vi.fn(async () => ({ id: TASK, status: "awaiting_approval", area: "lessons", payload: { lesson_package: { ...pack, workbook } } })),
        calendarWorkbook,
      }) as unknown as Record<string, ReturnType<typeof vi.fn>>;
      const out = await startLessonReview({ task_id: TASK }, ADMIN, d as never);
      expect(d.workbookPdf).toHaveBeenCalled();
      expect(out.workbook_source).toBe("generated");
    }
  });

  it("draws the workbook PDF and carries it in the reviewed manifest", async () => {
    const workbook = { title: "Start From The Source", sections: [{ title: "Map it out", blocks: [{ type: "write", question: "Where does your work come from?" }] }] };
    const d = deps({
      loadTask: vi.fn(async () => ({ id: TASK, status: "awaiting_approval", area: "lessons", payload: { lesson_package: { ...pack, workbook } } })),
    }) as unknown as Record<string, ReturnType<typeof vi.fn>>;
    await startLessonReview({ task_id: TASK }, ADMIN, d as never);
    expect(d.workbookPdf).toHaveBeenCalledWith(expect.objectContaining({ title: "Start From The Source" }), "Start from the Source");
    const [submitted] = d.submit.mock.calls[0];
    expect(submitted.payload.workbook_pdf).toMatchObject({ storage_path: `workbooks/${"a".repeat(64)}.pdf`, name: "Start_from_the_Source_Workbook.pdf" });
    expect(submitted.payload.workbook).toBeUndefined();
  });

  it("refuses a package that brings its own PDF", () => {
    expect(() => validateLessonPackage({ ...pack, workbook_pdf: { storage_path: "x" } })).toThrow("send the workbook outline");
  });

  it("refuses closed tasks, tasks without a package and extra input", async () => {
    await expect(
      startLessonReview({ task_id: TASK }, ADMIN, deps({ loadTask: vi.fn(async () => ({ id: TASK, status: "done", area: "lessons", payload: { lesson_package: pack } })) })),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      startLessonReview({ task_id: TASK }, ADMIN, deps({ loadTask: vi.fn(async () => ({ id: TASK, status: "open", area: "lessons", payload: {} })) })),
    ).rejects.toThrow("no lesson package");
    await expect(startLessonReview({ task_id: TASK, extra: 1 }, ADMIN, deps())).rejects.toThrow("Only task_id");
  });

  it("does not submit or close anything when the file check fails", async () => {
    const d = deps({ verify: vi.fn(async () => { throw new Error("Stored media hash does not match"); }) }) as unknown as Record<string, ReturnType<typeof vi.fn>>;
    await expect(startLessonReview({ task_id: TASK }, ADMIN, d as never)).rejects.toThrow("does not match");
    expect(d.submit).not.toHaveBeenCalled();
    expect(d.complete).not.toHaveBeenCalled();
  });
});
