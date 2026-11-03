"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import MonthlyMetricsOverview from "@/components/shared/MonthlyMetricsOverview";
import {
  formatMetricsMonthLabel,
  getCurrentMetricsMonthStart,
  getMetricsMonthOptions,
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
  const [selectedMonthStart, setSelectedMonthStart] = useState(initialCurrentMonthStart || getCurrentMetricsMonthStart());
  const [formValues, setFormValues] = useState<Record<MonthlyMetricKey, string>>(
    createInitialValues(initialCurrentMonthStart || getCurrentMetricsMonthStart(), initialHistory),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const nextMonthStart = initialCurrentMonthStart || getCurrentMetricsMonthStart();
    setCurrentMonthStart(nextMonthStart);
    setSelectedMonthStart(nextMonthStart);
    setHistory(sortMonthlyMetrics(initialHistory));
    setFormValues(createInitialValues(nextMonthStart, initialHistory));
    setShowForm(false);
  }, [initialCurrentMonthStart, initialHistory]);

  const selectedMonthEntry = history.find((entry) => entry.month_start === selectedMonthStart);
  const isDue = !selectedMonthEntry;
  const monthOptions = getMetricsMonthOptions(currentMonthStart, history);

  function selectMonth(monthStart: string) {
    setSelectedMonthStart(monthStart);
    setFormValues(createInitialValues(monthStart, history));
    setError(null);
    setShowForm(true);
  }

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
        body: JSON.stringify({ monthStart: selectedMonthStart, values: formValues }),
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
      setFormValues(createInitialValues(selectedMonthStart, nextHistory));
      setShowForm(false);
      toast(`${formatMetricsMonthLabel(selectedMonthStart)} metrics saved. Marc can now track your trend.`);
    } catch {
      setError("Could not save your monthly metrics.");
      toast("Could not save your monthly metrics.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-8 space-y-6">
      <div className="v2-surface p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="v2-eyebrow">Monthly Scorecard</div>
            <h2 className="mt-3 text-xl font-heading font-bold text-text-primary">Five Key Monthly Metrics</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-text-secondary">
              Choose the month these figures belong to. You can add last month’s numbers or update a previous scorecard at any time.
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
                ? `${formatMetricsMonthLabel(selectedMonthStart, { month: "long" })} metrics due`
                : `${formatMetricsMonthLabel(selectedMonthStart, { month: "long" })} submitted`}
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => setShowForm((prev) => !prev)}
              className={showForm ? "v2-button-secondary min-h-0 px-3 py-2 text-xs" : "v2-button-primary min-h-0 px-3 py-2 text-xs"}
            >
              {showForm
                ? "Hide scorecard"
                : isDue
                  ? `Add ${formatMetricsMonthLabel(selectedMonthStart, { month: "long" })} metrics`
                  : `Update ${formatMetricsMonthLabel(selectedMonthStart, { month: "long" })} metrics`}
            </button>
          </div>
        </div>

        <div className="mt-5 max-w-sm">
          <label htmlFor="metrics-month" className="block text-sm font-semibold text-text-primary">Reporting month</label>
          <select
            id="metrics-month"
            value={selectedMonthStart}
            disabled={saving}
            onChange={(event) => selectMonth(event.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-bg-card px-3 py-3 text-sm text-text-primary disabled:opacity-50"
          >
            {monthOptions.map((month) => (
              <option key={month} value={month}>{formatMetricsMonthLabel(month, { month: "long", year: "numeric" })}</option>
            ))}
          </select>
          <p className="mt-2 text-xs text-text-muted">Each month is saved separately. Changing the month loads its saved figures.</p>
        </div>

        {showForm && (
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
                      disabled={saving}
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
                These numbers are stored against {formatMetricsMonthLabel(selectedMonthStart, { month: "long", year: "numeric" })}.
              </p>
              <button
                type="submit"
                disabled={saving}
                className="v2-button-primary disabled:opacity-50"
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
