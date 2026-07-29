"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ReportView from "@/components/growth-engine/ReportView";
import { EmptyState, InlineNotice, PageSkeleton } from "@/components/ui/PortalState";
import type { GrowthReport, GrowthWorkspace } from "@/lib/growth-engine";

type GrowthResponse =
  | { entitled: false }
  | { entitled: true; workspace: GrowthWorkspace | null; reports: GrowthReport[] };

function LockedPreview() {
  return (
    <>
      <header className="mb-7 sm:mb-9">
        <div className="v2-eyebrow mb-3">AI delivery and growth</div>
        <h1 className="v2-page-title">CBB Growth Engine</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
          Done-for-you lead generation &amp; AI implementation.
        </p>
      </header>

      <section className="relative min-h-[520px] overflow-hidden rounded-[var(--cbb-radius-lg)] border border-accent/20 bg-[var(--cbb-surface-1)] shadow-[0_28px_70px_rgba(0,0,0,0.18)] sm:min-h-[570px]">
        <div className="pointer-events-none absolute inset-0 select-none p-4 opacity-[0.16] blur-[0.35px] sm:p-7" aria-hidden="true">
          <div className="flex items-start justify-between border-b border-white/20 pb-5">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent-bright">Illustrative sample report</div>
              <div className="mt-2 font-heading text-xl font-black text-text-primary sm:text-2xl">Weekly growth performance</div>
              <div className="mt-1 text-xs text-text-secondary">Sample period · 7 days</div>
            </div>
            <div className="rounded-full border border-emerald-400/30 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.13em] text-emerald-300">
              Sample only
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ["Cost per lead", "£18.40", "↓ 12%"],
              ["Appointments booked", "12", "↑ 3"],
              ["New sales", "3", "This week"],
              ["Sales value", "£14,800", "New revenue"],
            ].map(([label, value, change]) => (
              <div key={label} className="rounded-xl border border-white/20 bg-white/[0.04] p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">{label}</div>
                <div className="mt-2 font-heading text-2xl font-black text-text-primary">{value}</div>
                <div className="mt-1 text-xs text-emerald-300">{change}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
            <div className="rounded-xl border border-white/20 bg-white/[0.025] p-5">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-text-primary">Qualified lead volume</div>
                <div className="text-[10px] uppercase tracking-[0.12em] text-text-muted">Last 7 days</div>
              </div>
              <div className="mt-6 flex h-28 items-end gap-2">
                {[38, 54, 45, 72, 60, 88, 78].map((height, index) => (
                  <div key={index} className="flex h-full flex-1 items-end">
                    <div className="w-full rounded-t bg-accent-bright" style={{ height: `${height}%` }} />
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-white/20 bg-white/[0.025] p-5">
              <div className="text-xs font-bold text-text-primary">Sales pipeline</div>
              <div className="mt-5 space-y-4">
                {[
                  ["New leads", "31"],
                  ["Qualified", "18"],
                  ["Appointments", "12"],
                  ["Closed", "3"],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between border-b border-white/15 pb-2 last:border-0">
                    <span className="text-xs text-text-secondary">{label}</span>
                    <span className="text-sm font-black text-text-primary">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="absolute inset-0 bg-[color:var(--cbb-bg)]/35 backdrop-blur-[1.5px]" aria-hidden="true" />

        <div className="relative z-10 flex min-h-[520px] items-center justify-center p-5 sm:min-h-[570px] sm:p-8">
          <div className="w-full max-w-lg rounded-[var(--cbb-radius-lg)] border border-white/[0.11] bg-[var(--cbb-surface-1)]/95 px-6 py-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:px-10 sm:py-10">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-accent/25 bg-accent/10 text-accent-bright">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 11V7a4 4 0 0 0-8 0v4m-1 0h10a2 2 0 0 1 2 2v6H5v-6a2 2 0 0 1 2-2Z" />
              </svg>
            </div>
            <h2 className="mt-5 font-heading text-2xl font-black tracking-[-0.025em] text-text-primary sm:text-3xl">
              Your Growth Engine isn’t active yet
            </h2>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-text-secondary">
              Ask Marc if you’d like access to your growth strategy and weekly results.
            </p>
            <div className="mt-6 flex justify-center">
              <Link href="/portal/inbox" className="v2-button-primary justify-center no-underline">
                Ask Marc about access
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="m9 18 6-6-6-6" />
                </svg>
              </Link>
            </div>
            <p className="mt-4 text-[11px] leading-5 text-text-muted">The report shown behind this message is an illustrative sample.</p>
          </div>
        </div>
      </section>
    </>
  );
}

export default function ClientGrowthEngine() {
  const [data, setData] = useState<GrowthResponse | null>(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setError("");
      try {
        const response = await fetch("/api/portal/growth-engine", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("load failed");
        setData(await response.json());
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError") {
          setError("We couldn’t load the CBB Growth Engine. Please try again.");
        }
      }
    }
    void load();
    return () => controller.abort();
  }, [reloadKey]);

  if (!data && !error) return <PageSkeleton rows={4} />;
  if (error) {
    return (
      <InlineNotice
        tone="error"
        action={<button type="button" onClick={() => setReloadKey((key) => key + 1)} className="text-xs font-bold underline underline-offset-4">Try again</button>}
      >
        {error}
      </InlineNotice>
    );
  }
  if (!data?.entitled) return <LockedPreview />;

  const latest = data.reports[0];
  const history = data.reports.slice(1);
  return (
    <>
      <header className="mb-7 sm:mb-9">
        <div className="v2-eyebrow mb-3">AI delivery and growth</div>
        <h1 className="v2-page-title">CBB Growth Engine</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
          Your strategy, implementation progress and weekly growth reporting in one place.
        </p>
      </header>

      {!latest ? (
        <div className="v2-surface">
          <EmptyState
            icon={<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6l6 6v10a2 2 0 0 1-2 2Z" /></svg>}
            title="Your workspace is ready"
            description="Your first weekly Growth Engine report will appear here as soon as it is published."
          />
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <ReportView report={latest} />
          <aside className="space-y-5">
            {data.workspace?.strategy_summary && (
              <section className="v2-surface p-5">
                <div className="v2-eyebrow">Current strategy</div>
                {data.workspace.strategy_title && <h2 className="mt-2 text-base font-black text-text-primary">{data.workspace.strategy_title}</h2>}
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-text-secondary">{data.workspace.strategy_summary}</p>
              </section>
            )}
            {data.workspace?.implementation_milestones?.length ? (
              <section className="v2-surface overflow-hidden">
                <div className="border-b border-white/[0.07] px-5 py-4">
                  <h2 className="v2-section-title">Implementation milestones</h2>
                  <p className="mt-1 text-xs text-text-muted">
                    {data.workspace.implementation_milestones.filter((milestone) => milestone.status === "complete").length} of {data.workspace.implementation_milestones.length} complete
                  </p>
                </div>
                <div className="divide-y divide-white/[0.06]">
                  {data.workspace.implementation_milestones.slice(0, 4).map((milestone) => (
                    <div key={milestone.id} className="flex gap-3 px-5 py-4">
                      <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                        milestone.status === "complete" ? "bg-emerald-400" : milestone.status === "in_progress" ? "bg-accent-bright" : "bg-white/20"
                      }`} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-5 text-text-primary">{milestone.title}</p>
                        <p className="mt-1 text-xs text-text-muted">{milestone.owner}{milestone.targetDate ? ` · ${new Date(`${milestone.targetDate}T12:00:00`).toLocaleDateString("en-GB")}` : ""}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
            <section className="v2-surface overflow-hidden">
              <div className="border-b border-white/[0.07] px-5 py-4">
                <h2 className="v2-section-title">Report history</h2>
              </div>
              {history.length === 0 ? (
                <p className="px-5 py-6 text-sm leading-6 text-text-muted">Earlier reports will build up here over time.</p>
              ) : (
                <div className="divide-y divide-white/[0.06]">
                  {history.map((report) => (
                    <Link key={report.id} href={`/portal/growth-engine/reports/${report.id}`} className="group block px-5 py-4 no-underline hover:bg-white/[0.025]">
                      <div className="text-sm font-semibold text-text-primary group-hover:text-accent-bright">{report.title}</div>
                      {report.published_at && <div className="mt-1 text-xs text-text-muted">{new Date(report.published_at).toLocaleDateString("en-GB")}</div>}
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </aside>
        </div>
      )}
    </>
  );
}
