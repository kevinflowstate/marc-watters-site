import { describe, expect, it } from "vitest";
import { cleanReportInput, normalizeGrowthMetrics } from "../lib/growth-engine-input";

describe("Growth Engine report input", () => {
  it("trims report content and accepts valid reporting dates", () => {
    expect(cleanReportInput({
      title: "  Weekly report  ",
      periodStart: "2026-07-20",
      periodEnd: "2026-07-26",
      executiveSummary: "  A clear update.  ",
    })).toMatchObject({
      title: "Weekly report",
      periodStart: "2026-07-20",
      periodEnd: "2026-07-26",
      executiveSummary: "A clear update.",
    });
  });

  it("rejects invalid dates and incomplete result metrics", () => {
    const result = cleanReportInput({
      title: "Report",
      periodStart: "20 July",
      periodEnd: "2026-7-26",
      metrics: [
        { label: "Qualified leads", value: "8", context: "This week" },
        { label: "", value: "100" },
        { label: "Calls answered", value: "" },
      ],
    });

    expect(result.periodStart).toBeNull();
    expect(result.periodEnd).toBeNull();
    expect(result.metrics).toEqual([
      { label: "Qualified leads", value: "8", context: "This week" },
    ]);
  });

  it("caps a report at twelve usable metrics", () => {
    const metrics = Array.from({ length: 15 }, (_, index) => ({
      label: `Measure ${index + 1}`,
      value: `${index + 1}`,
    }));
    expect(normalizeGrowthMetrics(metrics)).toHaveLength(12);
  });
});
