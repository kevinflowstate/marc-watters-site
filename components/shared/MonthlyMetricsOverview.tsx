"use client";

import { useState } from "react";
import {
  formatMetricsMonthLabel,
  formatMonthlyMetricValue,
  getMetricValue,
  getMonthlyMetricDelta,
  monthlyMetricDefinitions,
  sortMonthlyMetrics,
} from "@/lib/monthly-metrics";
import type { ClientMonthlyMetric, MonthlyMetricDefinition, MonthlyMetricKey } from "@/lib/types";

function buildLinePath(values: number[], width: number, height: number, padding: number) {
  if (values.length === 0) return "";

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;

  return values
    .map((value, index) => {
      const x = padding + (values.length === 1 ? usableWidth / 2 : (usableWidth / (values.length - 1)) * index);
      const y = padding + usableHeight - ((value - min) / range) * usableHeight;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

function buildAreaPath(linePath: string, values: number[], width: number, height: number, padding: number) {
  if (!linePath || values.length === 0) return "";

  const usableWidth = width - padding * 2;
  const startX = padding;
  const endX = values.length === 1 ? padding + usableWidth / 2 : padding + usableWidth;
  const baselineY = height - padding;

  return `${linePath} L ${endX} ${baselineY} L ${startX} ${baselineY} Z`;
}

function MetricTrendChart({
  definition,
  history,
}: {
  definition: MonthlyMetricDefinition;
  history: ClientMonthlyMetric[];
}) {
  const width = 640;
  const height = 220;
  const padding = 20;
  const values = history.map((entry) => getMetricValue(entry, definition.key));
  const path = buildLinePath(values, width, height, padding);
  const areaPath = buildAreaPath(path, values, width, height, padding);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const latest = history[history.length - 1];

  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.04)] bg-bg-primary/60 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="text-base font-heading font-bold text-text-primary">{definition.label} Trend</h4>
          <p className="mt-1 text-sm text-text-secondary">
            Tracking {definition.short_label.toLowerCase()} month by month.
          </p>
        </div>
        <div className="text-left sm:text-right">
          <div className="text-[11px] uppercase tracking-wider text-text-muted">
            Latest {formatMetricsMonthLabel(latest.month_start)}
          </div>
          <div className="mt-1 text-xl font-heading font-bold text-text-primary">
            {formatMonthlyMetricValue(definition.key, getMetricValue(latest, definition.key))}
          </div>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        <div className="min-w-[560px]">
          <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full">
            <defs>
              <linearGradient id={`metric-gradient-${definition.key}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(34,114,222,0.28)" />
                <stop offset="100%" stopColor="rgba(34,114,222,0)" />
              </linearGradient>
            </defs>

            {[0, 1, 2, 3].map((line) => {
              const y = padding + ((height - padding * 2) / 3) * line;
              return (
                <line
                  key={line}
                  x1={padding}
                  x2={width - padding}
                  y1={y}
                  y2={y}
                  stroke="rgba(255,255,255,0.06)"
                  strokeDasharray="4 8"
                />
              );
            })}

            {areaPath && (
              <path
                d={areaPath}
                fill={`url(#metric-gradient-${definition.key})`}
                opacity="1"
              />
            )}

            {path && (
              <path
                d={path}
                fill="none"
                stroke="rgba(56,149,255,0.95)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {history.map((entry, index) => {
              const value = getMetricValue(entry, definition.key);
              const usableWidth = width - padding * 2;
              const usableHeight = height - padding * 2;
              const x = padding + (history.length === 1 ? usableWidth / 2 : (usableWidth / (history.length - 1)) * index);
              const y = padding + usableHeight - ((value - min) / ((max - min) || 1)) * usableHeight;

              return (
                <g key={entry.id}>
                  <circle cx={x} cy={y} r="5" fill="#061224" stroke="rgba(56,149,255,0.95)" strokeWidth="3" />
                  <text
                    x={x}
                    y={height - 2}
                    textAnchor="middle"
                    fontSize="11"
                    fill="rgba(163,171,192,0.8)"
                  >
                    {formatMetricsMonthLabel(entry.month_start, { month: "short" })}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-text-muted">
        <span>Low: {formatMonthlyMetricValue(definition.key, min)}</span>
        <span>High: {formatMonthlyMetricValue(definition.key, max)}</span>
        <span>{history.length} month{history.length !== 1 ? "s" : ""} tracked</span>
      </div>
    </div>
  );
}

export default function MonthlyMetricsOverview({
  history,
  title = "Five Key Monthly Metrics",
  subtitle = "Track progress month by month across the numbers that matter most.",
  emptyMessage = "No monthly metrics have been submitted yet.",
}: {
  history: ClientMonthlyMetric[];
  title?: string;
  subtitle?: string;
  emptyMessage?: string;
}) {
  const sortedHistory = sortMonthlyMetrics(history);
  const [expandedMetric, setExpandedMetric] = useState<MonthlyMetricKey>(
    monthlyMetricDefinitions[0].key,
  );

  if (sortedHistory.length === 0) {
    return (
      <div className="rounded-2xl border border-[rgba(255,255,255,0.04)] bg-bg-card/80 p-6">
        {title && <h3 className="text-xl font-heading font-bold text-text-primary">{title}</h3>}
        {subtitle && <p className="mt-2 text-sm text-text-secondary">{subtitle}</p>}
        <p className="mt-5 text-sm text-text-muted">{emptyMessage}</p>
      </div>
    );
  }

  const latest = sortedHistory[sortedHistory.length - 1];
  const previous = sortedHistory.length > 1 ? sortedHistory[sortedHistory.length - 2] : null;
  const expandedDefinition =
    monthlyMetricDefinitions.find((metric) => metric.key === expandedMetric) ||
    monthlyMetricDefinitions[0];

  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.04)] bg-bg-card/80 p-6 sm:p-7">
      {(title || subtitle) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {title && <h3 className="text-xl font-heading font-bold text-text-primary">{title}</h3>}
            {subtitle && <p className="mt-2 max-w-3xl text-sm leading-relaxed text-text-secondary">{subtitle}</p>}
          </div>
          <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-bg-primary/60 px-4 py-3 text-left sm:text-right">
            <div className="text-[11px] uppercase tracking-wider text-text-muted">Latest Snapshot</div>
            <div className="mt-1 text-sm font-medium text-text-primary">
              {formatMetricsMonthLabel(latest.month_start, { month: "long", year: "numeric" })}
            </div>
          </div>
        </div>
      )}

      <div className={`${title || subtitle ? "mt-6 " : ""}grid gap-4 md:grid-cols-2 xl:grid-cols-5`}>
        {monthlyMetricDefinitions.map((metric) => {
          const currentValue = getMetricValue(latest, metric.key);
          const previousValue = previous ? getMetricValue(previous, metric.key) : null;
          const delta = getMonthlyMetricDelta(metric.key, currentValue, previousValue);
          const isExpanded = expandedMetric === metric.key;

          return (
            <button
              key={metric.key}
              type="button"
              onClick={() => setExpandedMetric(metric.key)}
              className={`group rounded-2xl border p-5 text-left transition-all duration-200 cursor-pointer ${
                isExpanded
                  ? "border-accent/30 bg-accent/10 shadow-[0_8px_24px_rgba(34,114,222,0.08)]"
                  : "border-[rgba(255,255,255,0.05)] bg-bg-primary/60 hover:border-[rgba(255,255,255,0.12)]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-text-muted">{metric.label}</div>
                  <div className="mt-3 text-2xl font-heading font-bold text-text-primary">
                    {formatMonthlyMetricValue(metric.key, currentValue)}
                  </div>
                </div>
                <svg
                  className={`mt-1 h-4 w-4 text-text-muted transition-transform ${isExpanded ? "rotate-180 text-accent-bright" : "group-hover:text-text-primary"}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {delta ? (
                <div
                  className={`mt-4 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    delta.tone === "positive"
                      ? "bg-emerald-500/10 text-emerald-300"
                      : delta.tone === "negative"
                      ? "bg-red-500/10 text-red-300"
                      : "bg-[rgba(255,255,255,0.06)] text-text-muted"
                  }`}
                >
                  {delta.label}
                </div>
              ) : (
                <div className="mt-4 inline-flex rounded-full bg-[rgba(255,255,255,0.06)] px-2.5 py-1 text-[11px] font-semibold text-text-muted">
                  First month recorded
                </div>
              )}

              <div className="mt-3 text-xs text-text-muted">
                {previous
                  ? `Compared with ${formatMetricsMonthLabel(previous.month_start)}`
                  : `Recorded for ${formatMetricsMonthLabel(latest.month_start)}`}
              </div>
            </button>
          );
        })}
      </div>

      {expandedDefinition && (
        <div className="mt-6">
          <MetricTrendChart definition={expandedDefinition} history={sortedHistory} />
        </div>
      )}
    </div>
  );
}
