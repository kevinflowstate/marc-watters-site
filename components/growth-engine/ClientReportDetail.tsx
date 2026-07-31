"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ReportView from "@/components/growth-engine/ReportView";
import { InlineNotice, PageSkeleton } from "@/components/ui/PortalState";
import type { GrowthReport } from "@/lib/growth-engine";

interface ReportAsset {
  id: string;
  title: string;
  original_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
}

export default function ClientReportDetail({ reportId }: { reportId: string }) {
  const [report, setReport] = useState<GrowthReport | null>(null);
  const [assets, setAssets] = useState<ReportAsset[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/portal/growth-engine/reports/${reportId}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("load failed");
        const data = await response.json();
        setReport(data.report);
        setAssets(Array.isArray(data.assets) ? data.assets : []);
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError") {
          setError("This report could not be loaded. It may no longer be available to this account.");
        }
      }
    }
    void load();
    return () => controller.abort();
  }, [reportId]);

  if (!report && !error) return <PageSkeleton rows={4} />;

  return (
    <>
      <Link href="/portal/growth-engine" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-text-muted no-underline hover:text-accent-bright">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="m15 18-6-6 6-6" />
        </svg>
        Back to CBB Growth Engine
      </Link>
      {error ? <InlineNotice tone="error">{error}</InlineNotice> : report ? (
        <div className="space-y-5">
          <ReportView report={report} />
          {assets.length > 0 && (
            <section className="v2-surface overflow-hidden">
              <header className="border-b border-white/[0.07] px-5 py-4 sm:px-7">
                <h2 className="v2-section-title">Files included with this report</h2>
              </header>
              <div className="divide-y divide-white/[0.06]">
                {assets.map((asset) => (
                  <a
                    key={asset.id}
                    href={`/api/portal/growth-engine/assets/${asset.id}/download`}
                    className="flex items-center justify-between gap-4 px-5 py-4 text-sm font-bold text-text-primary no-underline hover:bg-white/[0.025] sm:px-7"
                  >
                    <span className="min-w-0 truncate">{asset.title || asset.original_name || "Growth Engine file"}</span>
                    <span className="shrink-0 text-xs text-accent-bright">Download</span>
                  </a>
                ))}
              </div>
            </section>
          )}
        </div>
      ) : null}
    </>
  );
}
