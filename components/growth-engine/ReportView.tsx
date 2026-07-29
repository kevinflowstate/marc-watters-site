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
    ? "text-text-muted"
    : change.startsWith("-")
      ? isCostMetric ? "text-emerald-300" : "text-red-300"
      : change.startsWith("+")
        ? isCostMetric ? "text-red-300" : "text-emerald-300"
        : "text-text-muted";

  return (
    <div className="rounded-[var(--cbb-radius-md)] border border-white/[0.07] bg-white/[0.025] px-4 py-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.11em] text-text-muted">{metric.label}</div>
      <div className="mt-2 font-heading text-2xl font-black text-text-primary">{metric.value}</div>
      {change && <div className={`mt-1 text-xs font-bold ${tone}`}>{change} week on week</div>}
      {metric.context && <div className="mt-1 text-xs leading-5 text-text-muted">{metric.context}</div>}
    </div>
  );
}

function ProgressList({ value }: { value: string }) {
  const items = lines(value);
  if (!items.length) return null;
  return (
    <section>
      <h2 className="text-sm font-bold text-text-primary">What moved forward</h2>
      <ul className="mt-4 space-y-3">
        {items.map((item, index) => (
          <li key={`${item}-${index}`} className="flex gap-3 text-sm leading-6 text-text-secondary">
            <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
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
      <h2 className="text-sm font-bold text-text-primary">What changes next</h2>
      <ul className="mt-4 space-y-4">
        {items.map((item, index) => {
          const action = parseAction(item);
          return (
            <li key={`${item}-${index}`} className="flex gap-3 text-sm leading-6 text-text-secondary">
              <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent-bright" />
              <span>
                <span className="block">{action.title}</span>
                <span className="mt-1 block text-xs font-semibold text-text-muted">{action.owner}</span>
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
    <article className={compact ? "" : "v2-surface overflow-hidden"}>
      <div className={compact ? "" : "p-5 sm:p-7 lg:p-8"}>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.13em] ${
            report.status === "published"
              ? "border-emerald-500/25 bg-emerald-500/8 text-emerald-300"
              : "border-amber-400/25 bg-amber-400/8 text-amber-300"
          }`}>
            {report.status === "published" ? "Published" : "Draft preview"}
          </span>
          <span className="text-xs text-text-muted">{formatPeriod(report)}</span>
        </div>
        <h1 className={`${compact ? "mt-3 text-xl" : "mt-4 text-2xl sm:text-3xl"} font-heading font-black tracking-[-0.02em] text-text-primary`}>
          {report.title}
        </h1>
        {report.published_at && (
          <p className="mt-2 text-xs text-text-muted">
            Published {new Date(report.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        )}

        {report.executive_summary && (
          <p className="mt-5 max-w-4xl whitespace-pre-wrap text-sm leading-7 text-text-secondary">
            {report.executive_summary}
          </p>
        )}
      </div>

      {report.strategic_takeaway && (
        <section className="border-y border-accent/15 bg-accent/[0.07] px-5 py-5 sm:px-7 lg:px-8">
          <div className="flex gap-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-accent/25 bg-accent/10 text-accent-bright">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M12 3v3m0 12v3M3 12h3m12 0h3M6.6 6.6l2.1 2.1m6.6 6.6 2.1 2.1m0-10.8-2.1 2.1m-6.6 6.6-2.1 2.1M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />
              </svg>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.11em] text-text-muted">Growth Engine read</div>
              <p className="mt-1 max-w-3xl text-sm font-semibold leading-7 text-text-primary">{report.strategic_takeaway}</p>
            </div>
          </div>
        </section>
      )}

      <div className={compact ? "mt-7" : "px-5 py-7 sm:px-7 lg:px-8"}>
        {report.metrics.length > 0 && (
          <section aria-label="Report results">
            <div>
              <h2 className="text-sm font-bold text-text-primary">Performance</h2>
              <p className="mt-1 text-xs text-text-muted">Only the measures relevant to this Growth Engine are included.</p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {report.metrics.map((metric, index) => <MetricCell key={`${metric.label}-${index}`} metric={metric} />)}
            </div>
          </section>
        )}

        {(report.progress_update || report.next_priorities) && (
          <div className={`${report.metrics.length ? "mt-8 border-t border-white/[0.07] pt-7" : ""} grid gap-8 md:grid-cols-2`}>
            <ProgressList value={report.progress_update} />
            <ActionList value={report.next_priorities} />
          </div>
        )}
      </div>
    </article>
  );
}
