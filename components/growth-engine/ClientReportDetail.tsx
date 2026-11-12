"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ReportView from "@/components/growth-engine/ReportView";
import { WsNotice as InlineNotice, WsPageSkeleton as PageSkeleton } from "@/components/portal/WsState";
import { Icon } from "@/components/ops/workspace/WorkspaceUI";
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
    <div className="ws ws-page">
      <Link href="/portal/growth-engine" className="ws-back ws-focus">
        <Icon name="chevron" size={14} className="ws-back-ic" />
        Back to CBB Growth Engine
      </Link>
      {error ? <InlineNotice tone="error">{error}</InlineNotice> : report ? (
        <div className="ws-stack">
          <ReportView report={report} />
          {assets.length > 0 && (
            <section className="ws-panel">
              <header className="ws-panel-head">
                <h2 className="ws-h2">Files included with this report</h2>
              </header>
              <div>
                {assets.map((asset) => (
                  <a
                    key={asset.id}
                    href={`/api/portal/growth-engine/assets/${asset.id}/download`}
                    className="ws-row ws-focus ws-ge-dl-link no-underline"
                  >
                    <span className="ws-row-title">{asset.title || asset.original_name || "Growth Engine file"}</span>
                    <span className="ws-link ws-ge-open-l">Download</span>
                  </a>
                ))}
              </div>
            </section>
          )}
        </div>
      ) : null}
    </div>
  );
}
