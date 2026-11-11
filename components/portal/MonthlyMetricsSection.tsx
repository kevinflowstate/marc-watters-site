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

  const monthLong = formatMetricsMonthLabel(selectedMonthStart, { month: "long" });
  return (
    <div className="space-y-5">
      <section className="ws-panel" aria-label="Five key monthly metrics">
        <div className="ws-panel-head">
          <h2 className="ws-h2">
            Five key monthly metrics <span className="ws-caption" style={{ fontWeight: 400 }}>· monthly scorecard</span>
          </h2>
          <span className={`ws-chip ${isDue ? "is-attn" : "is-ok"}`}>
            {isDue ? `${monthLong} metrics due` : `${monthLong} submitted`}
          </span>
          <button
            type="button"
            disabled={saving}
            onClick={() => setShowForm((prev) => !prev)}
            className={`ws-btn ws-btn-sm ws-focus ${showForm ? "" : "ws-btn-primary"}`}
          >
            {showForm ? "Hide scorecard" : isDue ? `Add ${monthLong} metrics` : `Update ${monthLong} metrics`}
          </button>
        </div>

        <div className="px-[14px] py-4">
          <p className="ws-meta max-w-3xl">
            Choose the month these figures belong to. You can add last month’s numbers or update a previous scorecard at any time.
          </p>
          <div className="mt-4 max-w-xs">
            <label htmlFor="metrics-month" className="ws-label">Reporting month</label>
            <select
              id="metrics-month"
              value={selectedMonthStart}
              disabled={saving}
              onChange={(event) => selectMonth(event.target.value)}
              className="ws-input"
            >
              {monthOptions.map((month) => (
                <option key={month} value={month}>{formatMetricsMonthLabel(month, { month: "long", year: "numeric" })}</option>
              ))}
            </select>
            <p className="ws-caption mt-1.5">Each month is saved separately. Changing the month loads its saved figures.</p>
          </div>

          {showForm && (
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {monthlyMetricDefinitions.map((metric) => (
                  <label
                    key={metric.key}
                    className="flex flex-col rounded-lg p-3"
                    style={{ border: "1px solid var(--ws-line)", background: "var(--ws-panel-2)" }}
                  >
                    <span className="text-[13px] font-semibold" style={{ color: "var(--ws-ink)" }}>{metric.label}</span>
                    {metric.description && <span className="ws-caption mt-0.5">{metric.description}</span>}
                    <span className="ws-input mt-auto flex items-center gap-1" style={{ marginTop: 12 }}>
                      {metric.kind === "currency" && <span className="ws-caption">£</span>}
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
                        className="w-full bg-transparent text-[13.5px] focus:outline-none"
                        style={{ color: "var(--ws-ink)", border: 0, height: "100%" }}
                      />
                      {metric.kind === "percentage" && <span className="ws-caption">%</span>}
                    </span>
                  </label>
                ))}
              </div>

              {error && (
                <p className="ws-caption" style={{ color: "var(--ws-bad)" }}>{error}</p>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="ws-caption">
                  These numbers are stored against {formatMetricsMonthLabel(selectedMonthStart, { month: "long", year: "numeric" })}.
                </p>
                <button type="submit" disabled={saving} className="ws-btn ws-btn-primary ws-focus">
                  {saving ? "Saving..." : isDue ? "Submit monthly metrics" : "Save changes"}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>

      <MonthlyMetricsOverview
        history={history}
        title=""
        subtitle="Each card shows your latest monthly number and how it has moved since the previous month. Click any metric to open the trend graph."
        emptyMessage="Once you submit your first monthly scorecard, the trend view will appear here for you and Marc."
      />
    </div>
  );
}
