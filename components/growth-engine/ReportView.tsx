import type { GrowthReport } from "@/lib/growth-engine";

function formatPeriod(report: GrowthReport) {
  if (!report.period_start && !report.period_end) return "Weekly update";
  const format = (value: string) =>
    new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  if (report.period_start && report.period_end) {
    return `${format(report.period_start)} – ${format(report.period_end)}`;
  }
  return format(report.period_start || report.period_end || "");
}

function TextSection({ title, value }: { title: string; value: string }) {
  if (!value) return null;
  return (
    <section className="border-t border-white/[0.07] pt-6 first:border-0 first:pt-0">
      <h2 className="text-sm font-bold text-text-primary">{title}</h2>
      <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-text-secondary">{value}</div>
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

        {report.metrics.length > 0 && (
          <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Report results">
            {report.metrics.map((metric, index) => (
              <div key={`${metric.label}-${index}`} className="rounded-[var(--cbb-radius-md)] border border-white/[0.07] bg-white/[0.025] px-4 py-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.11em] text-text-muted">{metric.label}</div>
                <div className="mt-2 font-heading text-2xl font-black text-text-primary">{metric.value}</div>
                {metric.context && <div className="mt-1 text-xs leading-5 text-text-muted">{metric.context}</div>}
              </div>
            ))}
          </section>
        )}

        <div className="mt-7 space-y-6">
          <TextSection title="Executive summary" value={report.executive_summary} />
          <TextSection title="Progress this week" value={report.progress_update} />
          <TextSection title="Next priorities" value={report.next_priorities} />
        </div>
      </div>
    </article>
  );
}
