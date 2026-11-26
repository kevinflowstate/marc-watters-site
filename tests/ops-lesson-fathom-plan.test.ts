import { describe, it, expect } from "vitest";
import { fallbackDue, makeFathomPlan } from "@/lib/ops/lesson-fathom-plan";
import { parseLessonEdit } from "@/lib/ops/lesson-edit-plan";

const line = (
  timestamp: string,
  text: string,
  display_name = "Marc Watters",
) => ({ timestamp, text, speaker: { display_name } });
const summary =
  "## Meeting Purpose\n\n[To plan next quarter.](https://fathom.video/test)\n\n## Topics\n### Cash collection\n### Bob's private debt\n";
const rows = [
  line("00:00:00", "Hi everyone."),
  line("00:00:30", "Tonight we're looking at planning."),
  line("00:03:00", "I will set a timer. Take a few minutes."),
  line("00:07:00", "Here is the next teaching point."),
  line("00:08:00", "Now consider these examples."),
  line("00:12:00", "Here is a question.", "Bob Jones"),
  line("00:24:59", "Thank you."),
];
const build = (transcript = rows, pdf = true) =>
  makeFathomPlan(
    "2026-11-24",
    123,
    { title: "Quarterly Planning", hasPdf: pdf },
    transcript,
    summary,
    1500,
  );
describe("lesson recovery from Fathom", () => {
  it("cuts an announced break and opening, keeps uncertain gaps, and flags participant speech", () => {
    const plan = build();
    expect(
      parseLessonEdit(plan, "CBB lesson edit 2026-11-24").keep_ranges,
    ).toEqual([
      [30, 186],
      [420, null],
    ]);
    expect(plan.review_note).toContain("12:00");
    expect(plan.summary_md).not.toContain("Bob");
    expect(plan.workbook).toBeUndefined();
  });
  it("uses the transcript's topics for a workbook when the event has no PDF", () => {
    const plan = build(rows, false);
    expect(
      parseLessonEdit(plan, "CBB lesson edit 2026-11-24").workbook,
    ).toMatchObject({ title: "Quarterly Planning" });
  });
  it("refuses an incomplete transcript or a call without Marc", () => {
    expect(() => build(rows.slice(0, -1))).toThrow("timings differ");
    expect(() =>
      build(
        rows.map((r) => ({ ...r, speaker: { display_name: "Other Person" } })),
      ),
    ).toThrow("Marc");
  });
  it("gives the chat its Tuesday handoff window in both winter and summer, and recovers on Wednesday", () => {
    expect(fallbackDue(new Date("2026-12-01T21:08Z"))).toBe(false);
    expect(fallbackDue(new Date("2026-12-01T21:13Z"))).toBe(true);
    expect(fallbackDue(new Date("2026-06-02T20:13Z"))).toBe(true);
    expect(fallbackDue(new Date("2026-12-02T09:00Z"))).toBe(true);
    expect(fallbackDue(new Date("2026-12-03T09:00Z"))).toBe(false);
  });
});
