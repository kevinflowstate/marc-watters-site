export interface GrowthMetricInput {
  label: string;
  value: string;
  context?: string;
}

export function normalizeGrowthMetrics(value: unknown): GrowthMetricInput[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      label: typeof item.label === "string" ? item.label.trim() : "",
      value: typeof item.value === "string" ? item.value.trim() : "",
      context: typeof item.context === "string" ? item.context.trim() : undefined,
    }))
    .filter((item) => item.label && item.value)
    .slice(0, 12);
}

export function cleanReportInput(value: unknown) {
  const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const cleanDate = (date: unknown) =>
    typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  const cleanText = (text: unknown, maxLength: number) =>
    typeof text === "string" ? text.trim().slice(0, maxLength) : "";

  return {
    title: cleanText(input.title, 140),
    periodStart: cleanDate(input.periodStart),
    periodEnd: cleanDate(input.periodEnd),
    executiveSummary: cleanText(input.executiveSummary, 6000),
    progressUpdate: cleanText(input.progressUpdate, 12000),
    nextPriorities: cleanText(input.nextPriorities, 8000),
    metrics: normalizeGrowthMetrics(input.metrics),
  };
}
