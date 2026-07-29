import { describe, expect, it } from "vitest";
import { growthReportWeek } from "../lib/growth-report-week";

describe("growthReportWeek", () => {
  it("returns a Monday-to-Sunday reporting window", () => {
    expect(growthReportWeek(new Date("2026-07-29T12:00:00.000Z"))).toEqual({
      weekStart: "2026-07-27",
      weekEnd: "2026-08-02",
    });
  });

  it("keeps a London Sunday in the preceding Monday window", () => {
    expect(growthReportWeek(new Date("2026-08-02T10:00:00.000Z"))).toEqual({
      weekStart: "2026-07-27",
      weekEnd: "2026-08-02",
    });
  });
});
