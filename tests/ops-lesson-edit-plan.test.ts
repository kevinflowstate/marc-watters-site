import { describe, expect, it } from "vitest";
import { parseLessonEdit } from "@/lib/ops/lesson-edit-plan";

const name = "CBB lesson edit 2026-11-24";
const plan = { kind: "lesson_edit", lesson_date: "2026-11-24", recording_id: 206539921, title: "Review",
  summary_md: "**Here's what you learned**\n\nScore the month.", review_note: "Cut the opening.",
  keep_ranges: [[3.2, 40], [90, null]], transcript_end_s: 3300 };
describe("native lesson edit handoff", () => {
  it("accepts ordered ranges with an open end for the last teaching segment", () => {
    expect(parseLessonEdit(plan, name)).toEqual(plan);
  });
  it("binds the document date and exact recording and excludes arbitrary storage URLs", () => {
    expect(() => parseLessonEdit(plan, "CBB lesson edit 2026-11-17")).toThrow();
    expect(() => parseLessonEdit({ ...plan, video: "https://other.example" }, name)).toThrow();
    expect(() => parseLessonEdit({ ...plan, recording_id: null }, name)).toThrow();
  });
  it("refuses reversed, overlapping and unbounded middle segments", () => {
    for (const keep_ranges of [[[10, 2]], [[10, 80], [70, 100]], [[0, null], [40, 90]]])
      expect(() => parseLessonEdit({ ...plan, keep_ranges }, name)).toThrow();
  });
});
