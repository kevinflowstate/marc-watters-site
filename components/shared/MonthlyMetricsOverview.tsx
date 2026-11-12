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
    <div className="ws-mm-chart">
      <div className="ws-mm-chart-head">
        <div className="min-w-0">
          <h4 className="ws-h2">{definition.label} trend</h4>
          <p className="ws-caption mt-0.5">
            Tracking {definition.short_label.toLowerCase()} month by month.
          </p>
        </div>
        <div className="ws-mm-latest">
          <div className="ws-caption">
            Latest {formatMetricsMonthLabel(latest.month_start)}
          </div>
          <div className="ws-mm-latest-n">
            {formatMonthlyMetricValue(definition.key, getMetricValue(latest, definition.key))}
          </div>
        </div>
      </div>

      <div className="ws-mm-svg">
        <div className="min-w-[560px]">
          <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full">
            {[0, 1, 2, 3].map((line) => {
              const y = padding + ((height - padding * 2) / 3) * line;
              return (
                <line
                  key={line}
                  x1={padding}
                  x2={width - padding}
                  y1={y}
                  y2={y}
                  style={{ stroke: "var(--ws-line)" }}
                  strokeDasharray="4 8"
                />
              );
            })}

            {areaPath && (
              <path
                d={areaPath}
                style={{ fill: "var(--ws-accent)", fillOpacity: 0.08 }}
              />
            )}

            {path && (
              <path
                d={path}
                fill="none"
                style={{ stroke: "var(--ws-accent-ink)" }}
                strokeWidth="2"
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
                  <circle cx={x} cy={y} r="4" style={{ fill: "var(--ws-panel)", stroke: "var(--ws-accent-ink)" }} strokeWidth="2" />
                  <text
                    x={x}
                    y={height - 2}
                    textAnchor="middle"
                    fontSize="11"
                    style={{ fill: "var(--ws-ink-3)" }}
                  >
                    {formatMetricsMonthLabel(entry.month_start, { month: "short" })}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      <div className="ws-mm-foot">
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
  framed = true,
}: {
  history: ClientMonthlyMetric[];
  title?: string;
  subtitle?: string;
  emptyMessage?: string;
  /** Draw its own panel. Pass false when the caller already puts it inside a panel (no nested cards). */
  framed?: boolean;
}) {
  const sortedHistory = sortMonthlyMetrics(history);
  const [expandedMetric, setExpandedMetric] = useState<MonthlyMetricKey>(
    monthlyMetricDefinitions[0].key,
  );
  const Frame = framed ? "section" : "div";
  const frameClass = framed ? "ws-panel ws-mm" : "ws-mm";

  if (sortedHistory.length === 0) {
    return (
      <Frame className={frameClass}>
        {(title || subtitle) && (
          <div className="ws-panel-head">
            <div className="min-w-0 mr-auto">
              {title && <h3 className="ws-h2">{title}</h3>}
              {subtitle && <p className="ws-caption">{subtitle}</p>}
            </div>
          </div>
        )}
        <div className="ws-empty">
          <span className="ws-empty-glyph">
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M5 20V10M12 20V4M19 20v-7" /></svg>
          </span>
          <p className="ws-empty-h">No metrics yet</p>
          <p>{emptyMessage}</p>
        </div>
      </Frame>
    );
  }

  const latest = sortedHistory[sortedHistory.length - 1];
  const previous = sortedHistory.length > 1 ? sortedHistory[sortedHistory.length - 2] : null;
  const expandedDefinition =
    monthlyMetricDefinitions.find((metric) => metric.key === expandedMetric) ||
    monthlyMetricDefinitions[0];

  return (
    <Frame className={frameClass}>
      {(title || subtitle) && (
        <div className="ws-panel-head">
          <div className="min-w-0 mr-auto">
            {title && <h3 className="ws-h2">{title}</h3>}
            {subtitle && <p className="ws-caption max-w-3xl">{subtitle}</p>}
          </div>
          <span className="ws-chip">
            Latest snapshot · {formatMetricsMonthLabel(latest.month_start, { month: "long", year: "numeric" })}
          </span>
        </div>
      )}

      <div className="ws-mm-grid-wrap">
        <div className="ws-mm-grid">
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
                aria-pressed={isExpanded}
                className="ws-mm-cell ws-focus"
              >
                <span className="ws-mm-l">{metric.label}</span>
                <span className="ws-mm-n">
                  {formatMonthlyMetricValue(metric.key, currentValue)}
                </span>
                {delta ? (
                  <span
                    className={`ws-chip ${
                      delta.tone === "positive" ? "is-ok" : delta.tone === "negative" ? "is-bad" : ""
                    }`}
                  >
                    {delta.label}
                  </span>
                ) : (
                  <span className="ws-chip">First month recorded</span>
                )}
                <span className="ws-mm-s">
                  {previous
                    ? `Compared with ${formatMetricsMonthLabel(previous.month_start)}`
                    : `Recorded for ${formatMetricsMonthLabel(latest.month_start)}`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {expandedDefinition && (
        <MetricTrendChart definition={expandedDefinition} history={sortedHistory} />
      )}
    </Frame>
  );
}
