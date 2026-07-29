"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ReportView from "@/components/growth-engine/ReportView";
import { EmptyState, InlineNotice, PageSkeleton } from "@/components/ui/PortalState";
import type { GrowthReport, GrowthWorkspace } from "@/lib/growth-engine";

type GrowthResponse =
  | { entitled: false }
  | { entitled: true; workspace: GrowthWorkspace | null; reports: GrowthReport[] };

const included = [
  {
    title: "Weekly growth reports",
    description: "A clear account of what was delivered, what changed and what happens next.",
    icon: "M9 17v-6m4 6V7m4 10v-3M5 21h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2Z",
  },
  {
    title: "Growth strategy",
    description: "The commercial priorities and AI implementation plan for your business.",
    icon: "M4 19V9m5 10V5m5 14v-7m5 7V3M3 19h18",
  },
  {
    title: "Implementation milestones",
    description: "Visibility on every system moving from planning through to live delivery.",
    icon: "m5 13 4 4L19 7",
  },
  {
    title: "Results and assets",
    description: "Relevant performance measures, reports and delivery documents in one place.",
    icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6l6 6v10a2 2 0 0 1-2 2Z",
  },
];

function LockedPreview() {
  return (
    <>
      <header className="mb-7 sm:mb-9">
        <div className="v2-eyebrow mb-3">AI delivery and growth</div>
        <h1 className="v2-page-title">CBB Growth Engine</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
          A focused workspace for the AI systems being planned, built and improved around your business.
        </p>
      </header>

      <section className="overflow-hidden rounded-[var(--cbb-radius-lg)] border border-accent/20 bg-[var(--cbb-surface-1)] shadow-[0_28px_70px_rgba(0,0,0,0.18)]">
        <div className="grid lg:grid-cols-[1.08fr_0.92fr]">
          <div className="relative border-b border-white/[0.07] p-6 sm:p-8 lg:border-b-0 lg:border-r lg:p-10">
            <div className="absolute left-0 top-8 h-16 w-1 rounded-r-full bg-accent-bright" aria-hidden />
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/8 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.13em] text-amber-300">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 11V7a4 4 0 0 0-8 0v4m-1 0h10a2 2 0 0 1 2 2v6H5v-6a2 2 0 0 1 2-2Z" />
              </svg>
              Access by enrolment
            </div>
            <h2 className="mt-6 max-w-xl font-heading text-3xl font-black leading-tight tracking-[-0.03em] text-text-primary sm:text-4xl">
              Your AI growth work, made visible.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-text-secondary">
              When your Growth Engine is enabled, this becomes the single place to follow delivery, understand the strategy and see the evidence behind every weekly update.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/portal/inbox" className="v2-button-primary justify-center no-underline">
                Ask Marc about access
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="m9 18 6-6-6-6" />
                </svg>
              </Link>
              <span className="text-xs leading-5 text-text-muted">Access is enabled individually for participating businesses.</span>
            </div>
          </div>

          <div className="bg-white/[0.018] p-5 sm:p-7 lg:p-8">
            <div className="mb-4 text-xs font-bold uppercase tracking-[0.14em] text-text-muted">Inside your workspace</div>
            <div className="divide-y divide-white/[0.07]">
              {included.map((item) => (
                <div key={item.title} className="flex gap-4 py-4 first:pt-2 last:pb-1">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent/20 bg-accent/8 text-accent-bright">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d={item.icon} />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-text-primary">{item.title}</h3>
                    <p className="mt-1 text-xs leading-5 text-text-muted">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
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
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-text-secondary">{data.workspace.strategy_summary}</p>
              </section>
            )}
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
