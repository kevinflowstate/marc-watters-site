import type {
  ClientMonthlyMetric,
  MonthlyMetricDefinition,
  MonthlyMetricKey,
} from "@/lib/types";

export const MONTHLY_METRICS_TIME_ZONE = "Europe/London";

export const monthlyMetricDefinitions: MonthlyMetricDefinition[] = [
  {
    key: "monthly_revenue",
    label: "Monthly Revenue",
    short_label: "Revenue",
    description: "Total revenue billed or earned for the month.",
    kind: "currency",
    step: "0.01",
    min: 0,
  },
  {
    key: "gross_profit_margin",
    label: "Gross Profit Margin",
    short_label: "Gross Profit",
    description: "Enter the month as a percentage, for example 32.5.",
    kind: "percentage",
    step: "0.1",
    min: -100,
    max: 100,
  },
  {
    key: "lead_conversion_rate",
    label: "Lead Conversion Rate",
    short_label: "Conversion",
    description: "Percentage of leads that converted into paying work.",
    kind: "percentage",
    step: "0.1",
    min: 0,
    max: 100,
  },
  {
    key: "average_job_value",
    label: "Average Job Value",
    short_label: "Job Value",
    description: "Average value of each completed job this month.",
    kind: "currency",
    step: "0.01",
    min: 0,
  },
  {
    key: "pipeline_forward_book",
    label: "Pipeline Forward Book",
    short_label: "Pipeline",
    description: "Forward booked work value currently secured in the pipeline.",
    kind: "currency",
    step: "0.01",
    min: 0,
  },
];

export const monthlyMetricKeySet = new Set<MonthlyMetricKey>(
  monthlyMetricDefinitions.map((metric) => metric.key),
);

function getLondonYearMonth(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MONTHLY_METRICS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;

  return {
    year: year || String(date.getUTCFullYear()),
    month: month || String(date.getUTCMonth() + 1).padStart(2, "0"),
  };
}

export function getCurrentMetricsMonthStart(date = new Date()): string {
  const { year, month } = getLondonYearMonth(date);
  return `${year}-${month}-01`;
}

export function formatMetricsMonthLabel(
  monthStart: string,
  options: Intl.DateTimeFormatOptions = { month: "short", year: "numeric" },
): string {
  const date = new Date(`${monthStart}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: MONTHLY_METRICS_TIME_ZONE,
    ...options,
  }).format(date);
}

export function sortMonthlyMetrics(history: ClientMonthlyMetric[]): ClientMonthlyMetric[] {
  return [...history].sort(
    (a, b) => new Date(a.month_start).getTime() - new Date(b.month_start).getTime(),
  );
}

export function normalizeMonthlyMetric(
  record: Partial<Record<MonthlyMetricKey, number | string>> & Record<string, unknown>,
): ClientMonthlyMetric {
  return {
    id: String(record.id || ""),
    client_id: String(record.client_id || ""),
    month_start: String(record.month_start || ""),
    monthly_revenue: Number(record.monthly_revenue || 0),
    gross_profit_margin: Number(record.gross_profit_margin || 0),
    lead_conversion_rate: Number(record.lead_conversion_rate || 0),
    average_job_value: Number(record.average_job_value || 0),
    pipeline_forward_book: Number(record.pipeline_forward_book || 0),
    submitted_at: String(record.submitted_at || ""),
    updated_at: String(record.updated_at || ""),
  };
}

export function normalizeMonthlyMetricsHistory(records: unknown[]): ClientMonthlyMetric[] {
  return records
    .filter((record) => Boolean(record) && typeof record === "object")
    .map((record) => normalizeMonthlyMetric(record as Record<string, unknown>));
}

export function formatMonthlyMetricValue(key: MonthlyMetricKey, value: number): string {
  const definition = monthlyMetricDefinitions.find((metric) => metric.key === key);
  if (!definition) return String(value);

  if (definition.kind === "currency") {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: value % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  return `${trimTrailingZeros(value)}%`;
}

export function getMetricValue(
  entry: ClientMonthlyMetric,
  key: MonthlyMetricKey,
): number {
  return entry[key];
}

export function getMonthlyMetricDelta(
  key: MonthlyMetricKey,
  current: number,
  previous: number | null,
): { label: string; tone: "positive" | "negative" | "neutral" } | null {
  if (previous === null || Number.isNaN(previous)) return null;
  if (current === previous) return { label: "No change", tone: "neutral" };

  const definition = monthlyMetricDefinitions.find((metric) => metric.key === key);
  if (!definition) return null;

  if (definition.kind === "percentage") {
    const diff = current - previous;
    const sign = diff > 0 ? "+" : "";
    return {
      label: `${sign}${trimTrailingZeros(diff)} pts`,
      tone: diff > 0 ? "positive" : "negative",
    };
  }

  if (previous === 0) {
    return {
      label: current > 0 ? "New" : "No change",
      tone: current > 0 ? "positive" : "neutral",
    };
  }

  const pct = ((current - previous) / previous) * 100;
  const sign = pct > 0 ? "+" : "";
  return {
    label: `${sign}${trimTrailingZeros(pct)}%`,
    tone: pct > 0 ? "positive" : "negative",
  };
}

export function trimTrailingZeros(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.?0+$/, "");
}
