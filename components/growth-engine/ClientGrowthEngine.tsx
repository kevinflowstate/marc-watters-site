"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ConsultationOutcomes from "@/components/growth-engine/ConsultationOutcomes";
import ReportView from "@/components/growth-engine/ReportView";
import GrowthEngineExperience from "@/components/portal/GrowthEngineExperience";
import { WsEmpty as EmptyState, WsNotice as InlineNotice, WsPageSkeleton as PageSkeleton } from "@/components/portal/WsState";
import { Icon } from "@/components/ops/workspace/WorkspaceUI";
import type { GrowthAsset, GrowthReport, GrowthWorkspace } from "@/lib/growth-engine";

type GrowthResponse =
  | { entitled: false }
  | { entitled: true; workspace: GrowthWorkspace | null; reports: GrowthReport[]; assets: GrowthAsset[] };

function LockedPreview() {
  return (
    <div className="ws ws-page">
      <header className="ws-ph">
        <div className="min-w-0">
        <h1 className="ws-title">CBB Growth Engine</h1>
        <p className="ws-meta mt-1 max-w-2xl">
          Done-for-you lead generation &amp; AI implementation.
        </p>
        </div>
      </header>

      <section className="ws-panel ws-ge-locked">
        <div className="ws-ge-ghost" aria-hidden="true">
          <div className="ws-ge-ghost-head">
            <div>
              <div className="ws-h2">Weekly growth performance</div>
              <div className="ws-caption">Last 7 days</div>
            </div>
          </div>

          <div className="ws-ge-ghost-grid">
            {[
              ["Cost per lead", "£18.40", "↓ 12%"],
              ["Appointments booked", "12", "↑ 3"],
              ["New sales", "3", "This week"],
              ["Sales value", "£14,800", "New revenue"],
            ].map(([label, value, change]) => (
              <div key={label} className="ws-ge-ghost-cell">
                <div className="ws-mm-l">{label}</div>
                <div className="ws-mm-n">{value}</div>
                <div className="ws-mm-s">{change}</div>
              </div>
            ))}
          </div>

          <div className="ws-ge-ghost-two">
            <div className="ws-ge-ghost-cell">
              <div className="ws-ge-ghost-row">
                <div className="ws-h3">Qualified lead volume</div>
                <div className="ws-caption">Last 7 days</div>
              </div>
              <div className="ws-ge-ghost-bars">
                {[38, 54, 45, 72, 60, 88, 78].map((height, index) => (
                  <div key={index} className="flex h-full flex-1 items-end">
                    <div className="ws-ge-ghost-bar" style={{ height: `${height}%` }} />
                  </div>
                ))}
              </div>
            </div>
            <div className="ws-ge-ghost-cell">
              <div className="ws-h3">Sales pipeline</div>
              <div>
                {[
                  ["New leads", "31"],
                  ["Qualified", "18"],
                  ["Appointments", "12"],
                  ["Closed", "3"],
                ].map(([label, value]) => (
                  <div key={label} className="ws-ge-ghost-row is-ruled">
                    <span className="ws-caption">{label}</span>
                    <span className="ws-h3">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="ws-ge-veil" aria-hidden="true" />

        <div className="ws-ge-lock-wrap">
          <div className="ws-dialog ws-ge-lock">
            <div className="ws-ge-lock-ic">
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 11V7a4 4 0 0 0-8 0v4m-1 0h10a2 2 0 0 1 2 2v6H5v-6a2 2 0 0 1 2-2Z" />
              </svg>
            </div>
            <h2 className="ws-dialog-title ws-ge-lock-t">
              Your Growth Engine isn’t active yet
            </h2>
            <p className="ws-meta">
              Ask Marc about our done-for-you Marketing &amp; AI Implementation solutions.
            </p>
            <div className="ws-ge-lock-act">
              <Link href="/portal/inbox" className="ws-btn ws-btn-primary ws-focus">
                Message Marc
                <Icon name="chevron" size={14} />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
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
      <div className="ws ws-page">
      <InlineNotice
        tone="error"
        action={<button type="button" onClick={() => setReloadKey((key) => key + 1)} className="ws-btn ws-btn-sm ws-focus">Try again</button>}
      >
        {error}
      </InlineNotice>
      </div>
    );
  }
  if (!data?.entitled) return <LockedPreview />;
  if (process.env.NEXT_PUBLIC_GROWTH_ENGINE_OFFERS !== "off") {
    return <GrowthEngineExperience previewUnlocked />;
  }

  const latest = data.reports[0];
  const history = data.reports.slice(1);
  return (
    <div className="ws ws-page">
      <header className="ws-ph">
        <div className="min-w-0">
        <h1 className="ws-title">CBB Growth Engine</h1>
        <p className="ws-meta mt-1 max-w-2xl">
          Your strategy, implementation progress and weekly growth reporting in one place.
        </p>
        </div>
      </header>

      {!latest ? (
        <div className="ws-ge-split">
          <div className="ws-panel">
            <EmptyState
              icon={<Icon name="reporting" size={20} />}
              title="Your workspace is ready"
              description="Your first weekly Growth Engine report will appear here as soon as it is published."
            />
          </div>
          <WorkspaceBriefing workspace={data.workspace} />
        </div>
      ) : (
        <div className="ws-ge-split is-narrow">
          <ReportView report={latest} />
          <aside className="ws-stack">
            {data.workspace?.strategy_summary && (
              <section className="ws-panel ws-pad">
                <div className="ws-caption">Current strategy</div>
                {data.workspace.strategy_title && <h2 className="ws-h2">{data.workspace.strategy_title}</h2>}
                <p className="ws-prose mt-2">{data.workspace.strategy_summary}</p>
              </section>
            )}
            {data.workspace?.implementation_milestones?.length ? (
              <section className="ws-panel">
                <div className="ws-panel-head">
                  <div className="min-w-0 ws-ge-head-t">
                  <h2 className="ws-h2">Implementation milestones</h2>
                  <p className="ws-caption">
                    {data.workspace.implementation_milestones.filter((milestone) => milestone.status === "complete").length} of {data.workspace.implementation_milestones.length} complete
                  </p>
                  </div>
                </div>
                <div>
                  {data.workspace.implementation_milestones.slice(0, 4).map((milestone) => (
                    <div key={milestone.id} className="ws-line">
                      <span className={`ws-ge-ms-dot ${
                        milestone.status === "complete" ? "is-ok" : milestone.status === "in_progress" ? "is-run" : ""
                      }`} />
                      <div className="min-w-0">
                        <p className="ws-row-title ws-wrap">{milestone.title}</p>
                        <p className="ws-row-sub">{milestone.owner}{milestone.targetDate ? ` · ${new Date(`${milestone.targetDate}T12:00:00`).toLocaleDateString("en-GB")}` : ""}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
            <section className="ws-panel">
              <div className="ws-panel-head">
                <h2 className="ws-h2">Report history</h2>
              </div>
              {history.length === 0 ? (
                <p className="ws-caption ws-pad">Earlier reports will build up here over time.</p>
              ) : (
                <div>
                  {history.map((report) => (
                    <Link key={report.id} href={`/portal/growth-engine/reports/${report.id}`} className="ws-ge-link ws-focus no-underline">
                      <div className="ws-row-title">{report.title}</div>
                      {report.published_at && <div className="ws-row-sub">{new Date(report.published_at).toLocaleDateString("en-GB")}</div>}
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </aside>
        </div>
      )}

      <div className="ws-ge-split">
        <ConsultationOutcomes />
        <section className="ws-panel">
          <div className="ws-panel-head">
            <div className="min-w-0 ws-ge-head-t">
            <div className="ws-caption">Shared with you</div>
            <h2 className="ws-h2">Files and assets</h2>
            </div>
          </div>
          {data.assets.length ? (
            <div>
              {data.assets.map((asset) => (
                <a key={asset.id} href={`/api/portal/growth-engine/assets/${asset.id}/download`} className="ws-ge-link ws-focus no-underline">
                  <p className="ws-row-title">{asset.title}</p>
                  <p className="ws-row-sub">{asset.original_name || asset.mime_type || "Document"} · Download</p>
                </a>
              ))}
            </div>
          ) : <EmptyState compact title="No shared files yet" description="Documents and assets shared by Flow State will appear here." />}
        </section>
      </div>
    </div>
  );
}

function WorkspaceBriefing({ workspace }: { workspace: GrowthWorkspace | null }) {
  if (!workspace?.strategy_summary && !workspace?.implementation_milestones?.length) {
    return <section className="ws-panel ws-pad"><div className="ws-caption">Onboarding</div><h2 className="ws-h2">Strategy in preparation</h2><p className="ws-meta mt-1">Your strategy and implementation milestones will appear here after your onboarding session.</p></section>;
  }
  return (
    <aside className="ws-stack">
      {workspace.strategy_summary && (
        <section className="ws-panel ws-pad">
          <div className="ws-caption">Current strategy</div>
          {workspace.strategy_title && <h2 className="ws-h2">{workspace.strategy_title}</h2>}
          <p className="ws-prose mt-2">{workspace.strategy_summary}</p>
        </section>
      )}
      {workspace.implementation_milestones?.length ? (
        <section className="ws-panel">
          <div className="ws-panel-head"><h2 className="ws-h2">Implementation milestones</h2></div>
          <div>
            {workspace.implementation_milestones.slice(0, 5).map((milestone) => (
              <div key={milestone.id} className="ws-line">
                <span className={`ws-ge-ms-dot ${milestone.status === "complete" ? "is-ok" : milestone.status === "in_progress" ? "is-run" : ""}`} />
                <div className="min-w-0"><p className="ws-row-title ws-wrap">{milestone.title}</p><p className="ws-row-sub">{milestone.owner}</p></div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </aside>
  );
}
