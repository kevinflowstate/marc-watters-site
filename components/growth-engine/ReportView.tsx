import type { GrowthMetric, GrowthReport } from "@/lib/growth-engine";

function formatPeriod(report: GrowthReport) {
  if (!report.period_start && !report.period_end) return "Weekly update";
  const format = (value: string) =>
    new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  if (report.period_start && report.period_end) {
    return `${format(report.period_start)} – ${format(report.period_end)}`;
  }
  return format(report.period_start || report.period_end || "");
}

function lines(value: string) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}

function MetricCell({ metric }: { metric: GrowthMetric }) {
  const change = metric.change?.trim();
  const isCostMetric = metric.label.toLowerCase().includes("cost");
  const tone = !change
    ? ""
    : change.startsWith("-")
      ? isCostMetric ? "is-ok" : "is-bad"
      : change.startsWith("+")
        ? isCostMetric ? "is-bad" : "is-ok"
        : "";

  return (
    <div className="ws-rv-cell">
      <div className="ws-mm-l">{metric.label}</div>
      <div className="ws-mm-n">{metric.value}</div>
      {change && <div className={`ws-rv-change ${tone}`}>{change} week on week</div>}
      {metric.context && <div className="ws-mm-s">{metric.context}</div>}
    </div>
  );
}

function ProgressList({ value }: { value: string }) {
  const items = lines(value);
  if (!items.length) return null;
  return (
    <section>
      <h2 className="ws-h2">What moved forward</h2>
      <ul className="ws-rv-list">
        {items.map((item, index) => (
          <li key={`${item}-${index}`} className="ws-rv-li">
            <span className="ws-dot ws-rv-dot is-ok" />
            <span>{item.replace(/^[-•]\s*/, "")}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function parseAction(raw: string) {
  const clean = raw.replace(/^[-•]\s*/, "");
  const match = clean.match(/^\s*(Client|You|Flow\s*State|Flowstate|CBB|Team|Shared)\s*:\s*(.+)$/i);
  if (!match) return { title: clean, owner: "Shared action" };
  const owner = match[1].toLowerCase().replace(/\s+/g, "");
  return {
    title: match[2],
    owner: owner === "client" || owner === "you"
      ? "Your action"
      : owner === "shared"
        ? "Shared action"
        : "Flow State action",
  };
}

function ActionList({ value }: { value: string }) {
  const items = lines(value);
  if (!items.length) return null;
  return (
    <section>
      <h2 className="ws-h2">What changes next</h2>
      <ul className="ws-rv-list">
        {items.map((item, index) => {
          const action = parseAction(item);
          return (
            <li key={`${item}-${index}`} className="ws-rv-li">
              <span className="ws-dot ws-rv-dot" />
              <span>
                <span className="block">{action.title}</span>
                <span className="ws-caption block">{action.owner}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function ReportView({ report, compact = false }: { report: GrowthReport; compact?: boolean }) {
  return (
    <article className={compact ? "ws-rv is-compact" : "ws-panel ws-rv"}>
      <div className={compact ? "" : "ws-rv-pad"}>
        <div className="ws-rv-top">
          <span className={`ws-chip ${
            report.status === "published"
              ? "is-ok"
              : "is-attn"
          }`}>
            {report.status === "published" ? "Published" : "Draft preview"}
          </span>
          <span className="ws-caption">{formatPeriod(report)}</span>
        </div>
        <h1 className={`${compact ? "ws-rv-title is-compact" : "ws-rv-title"}`}>
          {report.title}
        </h1>
        {report.published_at && (
          <p className="ws-caption mt-1">
            Published {new Date(report.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        )}

        {report.executive_summary && (
          <p className="ws-prose ws-rv-summary">
            {report.executive_summary}
          </p>
        )}
      </div>

      {report.strategic_takeaway && (
        <section className="ws-rv-read">
          <div className="ws-rv-read-in">
            <div className="ws-rv-read-ic">
              <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M12 3v3m0 12v3M3 12h3m12 0h3M6.6 6.6l2.1 2.1m6.6 6.6 2.1 2.1m0-10.8-2.1 2.1m-6.6 6.6-2.1 2.1M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />
              </svg>
            </div>
            <div>
              <div className="ws-field-l">Growth Engine read</div>
              <p className="ws-rv-read-t">{report.strategic_takeaway}</p>
            </div>
          </div>
        </section>
      )}

      <div className={compact ? "ws-rv-body is-compact" : "ws-rv-body"}>
        {report.metrics.length > 0 && (
          <section aria-label="Report results">
            <div>
              <h2 className="ws-h2">Performance</h2>
              <p className="ws-caption">Only the measures relevant to this Growth Engine are included.</p>
            </div>
            <div className="ws-rv-grid">
              {report.metrics.map((metric, index) => <MetricCell key={`${metric.label}-${index}`} metric={metric} />)}
            </div>
          </section>
        )}

        {(report.progress_update || report.next_priorities) && (
          <div className={`${report.metrics.length ? "is-ruled" : ""} ws-rv-cols`}>
            <ProgressList value={report.progress_update} />
            <ActionList value={report.next_priorities} />
          </div>
        )}
      </div>
    </article>
  );
}
