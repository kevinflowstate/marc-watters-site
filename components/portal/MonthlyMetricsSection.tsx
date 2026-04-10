"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import MonthlyMetricsOverview from "@/components/shared/MonthlyMetricsOverview";
import {
  formatMetricsMonthLabel,
  getCurrentMetricsMonthStart,
  monthlyMetricDefinitions,
  sortMonthlyMetrics,
} from "@/lib/monthly-metrics";
import type { ClientMonthlyMetric, MonthlyMetricKey } from "@/lib/types";

function createInitialValues(
  currentMonthStart: string,
  history: ClientMonthlyMetric[],
): Record<MonthlyMetricKey, string> {
  const currentEntry = history.find((entry) => entry.month_start === currentMonthStart);

  return monthlyMetricDefinitions.reduce((acc, metric) => {
    const value = currentEntry ? currentEntry[metric.key] : "";
    acc[metric.key] = value === "" ? "" : String(value);
    return acc;
  }, {} as Record<MonthlyMetricKey, string>);
}

export default function MonthlyMetricsSection({
  initialHistory,
  initialCurrentMonthStart,
}: {
  initialHistory: ClientMonthlyMetric[];
  initialCurrentMonthStart: string;
}) {
  const { toast } = useToast();
  const [history, setHistory] = useState<ClientMonthlyMetric[]>(sortMonthlyMetrics(initialHistory));
  const [currentMonthStart, setCurrentMonthStart] = useState(initialCurrentMonthStart || getCurrentMetricsMonthStart());
  const [formValues, setFormValues] = useState<Record<MonthlyMetricKey, string>>(
    createInitialValues(initialCurrentMonthStart || getCurrentMetricsMonthStart(), initialHistory),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(
    !initialHistory.some((entry) => entry.month_start === initialCurrentMonthStart),
  );

  useEffect(() => {
    const nextMonthStart = initialCurrentMonthStart || getCurrentMetricsMonthStart();
    setCurrentMonthStart(nextMonthStart);
    setHistory(sortMonthlyMetrics(initialHistory));
    setFormValues(createInitialValues(nextMonthStart, initialHistory));
    setShowForm(!initialHistory.some((entry) => entry.month_start === nextMonthStart));
  }, [initialCurrentMonthStart, initialHistory]);

  const currentMonthEntry = history.find((entry) => entry.month_start === currentMonthStart);
  const isDue = !currentMonthEntry;

  function setFieldValue(key: MonthlyMetricKey, value: string) {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/portal/monthly-metrics", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: formValues }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = data.error || "Could not save your monthly metrics.";
        setError(message);
        toast(message, "error");
        return;
      }

      const nextHistory = sortMonthlyMetrics(data.history || []);
      setHistory(nextHistory);
      setCurrentMonthStart(data.currentMonthStart || currentMonthStart);
      setFormValues(createInitialValues(data.currentMonthStart || currentMonthStart, nextHistory));
      setShowForm(false);
      toast("Monthly metrics saved. Marc can now track your trend.");
    } catch {
      setError("Could not save your monthly metrics.");
      toast("Could not save your monthly metrics.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-8 space-y-6">
      <div className="rounded-2xl border border-[rgba(255,255,255,0.04)] bg-bg-card/80 p-6 sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="inline-flex rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-accent-bright">
              Monthly Scorecard
            </div>
            <h2 className="mt-4 text-2xl font-heading font-bold text-text-primary">Five Key Monthly Metrics</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-text-secondary">
              On the first of each month, record these five numbers so you and Marc can see what is moving and where momentum is building.
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <div
              className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                isDue
                  ? "border border-amber-500/20 bg-amber-500/10 text-amber-300"
                  : "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
              }`}
            >
              {isDue
                ? `${formatMetricsMonthLabel(currentMonthStart, { month: "long" })} metrics due`
                : `${formatMetricsMonthLabel(currentMonthStart, { month: "long" })} submitted`}
            </div>
            {!isDue && (
              <button
                type="button"
                onClick={() => setShowForm((prev) => !prev)}
                className="text-xs font-medium text-accent-bright hover:text-accent-light transition-colors cursor-pointer"
              >
                {showForm ? "Hide edit form" : `Update ${formatMetricsMonthLabel(currentMonthStart, { month: "long" })} metrics`}
              </button>
            )}
          </div>
        </div>

        {(isDue || showForm) && (
          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {monthlyMetricDefinitions.map((metric) => (
                <label
                  key={metric.key}
                  className="rounded-2xl border border-[rgba(255,255,255,0.05)] bg-bg-primary/60 p-4"
                >
                  <div className="text-sm font-semibold text-text-primary">{metric.label}</div>
                  {metric.description && (
                    <div className="mt-1 text-xs leading-relaxed text-text-muted">{metric.description}</div>
                  )}
                  <div className="mt-4 flex items-center rounded-xl border border-[rgba(255,255,255,0.06)] bg-bg-card px-3">
                    {metric.kind === "currency" && (
                      <span className="text-sm text-text-muted">£</span>
                    )}
                    <input
                      type="number"
                      inputMode="decimal"
                      min={metric.min}
                      max={metric.max}
                      step={metric.step}
                      value={formValues[metric.key]}
                      onChange={(event) => setFieldValue(metric.key, event.target.value)}
                      placeholder="0"
                      className="w-full bg-transparent px-2 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
                    />
                    {metric.kind === "percentage" && (
                      <span className="text-sm text-text-muted">%</span>
                    )}
                  </div>
                </label>
              ))}
            </div>

            {error && <p className="text-sm text-red-300">{error}</p>}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-text-muted">
                These numbers are stored against {formatMetricsMonthLabel(currentMonthStart, { month: "long", year: "numeric" })}.
              </p>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center rounded-xl gradient-accent px-5 py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? "Saving..." : isDue ? "Submit Monthly Metrics" : "Save Changes"}
              </button>
            </div>
          </form>
        )}
      </div>

      <MonthlyMetricsOverview
        history={history}
        subtitle="Each card shows your latest monthly number and how it has moved since the previous month. Click any metric to open the trend graph."
        emptyMessage="Once you submit your first monthly scorecard, the trend view will appear here for you and Marc."
      />
    </div>
  );
}
