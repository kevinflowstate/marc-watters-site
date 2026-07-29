"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ReportView from "@/components/growth-engine/ReportView";
import { InlineNotice, PageSkeleton } from "@/components/ui/PortalState";
import type { GrowthReport } from "@/lib/growth-engine";

export default function ClientReportDetail({ reportId }: { reportId: string }) {
  const [report, setReport] = useState<GrowthReport | null>(null);
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
      {error ? <InlineNotice tone="error">{error}</InlineNotice> : report ? <ReportView report={report} /> : null}
    </>
  );
}
