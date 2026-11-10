"use client";

import { useState } from "react";
import { ReportText } from "./ReportText";
import { Icon } from "./WorkspaceUI";

type Pack = {
  title?: unknown;
  summary_md?: unknown;
  workbook_md?: unknown;
  mode?: unknown;
};

export function lessonPackage(payload: unknown): Pack | null {
  if (!payload || typeof payload !== "object") return null;
  const pack = (payload as Record<string, unknown>).lesson_package;
  return pack && typeof pack === "object" ? (pack as Pack) : null;
}

/** First step of a lesson review: one click checks the stored video, then the full review opens. */
export function LessonPackageCard({
  taskId,
  pack,
  destination,
  disabled,
}: {
  taskId: string;
  pack: Pack;
  destination?: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const summary = typeof pack.summary_md === "string" ? pack.summary_md.trim() : "";
  const hasWorkbook = typeof pack.workbook_md === "string" && pack.workbook_md.trim().length > 0;
  const where = destination || (pack.mode === "append" ? "Call Replays" : "Training");

  async function open() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/ops/lesson-media/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: taskId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || typeof result.review_url !== "string")
        throw new Error(typeof result.error === "string" ? result.error : "The video could not be checked. Try again in a minute.");
      window.location.assign(result.review_url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The video could not be checked.");
      setBusy(false);
    }
  }

  return (
    <div className="ws-section">
      <div className="ws-note is-info">
        <Icon name="info" size={15} />
        <span>
          <b>Edited lesson ready for review.</b> Check the video, watch it here, read the summary{hasWorkbook ? " and workbook" : ""}, then approve it for {where}.
        </span>
      </div>

      <ol className="mt-4 space-y-2 text-[13.5px] leading-relaxed" style={{ color: "var(--ws-ink-2)" }}>
        <li><b style={{ color: "var(--ws-ink)" }}>1. Check the video file.</b> Confirms the stored video is exactly the edited version. Takes about a minute.</li>
        <li><b style={{ color: "var(--ws-ink)" }}>2. Watch and read.</b> The video, summary{hasWorkbook ? " and workbook" : ""} open here, no Drive needed.</li>
        <li><b style={{ color: "var(--ws-ink)" }}>3. Approve or request changes.</b> Approving adds it to {where} only when lesson publishing is switched on.</li>
      </ol>

      <button type="button" className="ws-btn ws-btn-primary mt-4" disabled={busy || disabled} onClick={() => void open()}>
        {busy ? <Icon name="refresh" size={14} className="ws-spin" /> : <Icon name="check" size={14} />}
        {busy ? "Checking the video…" : "Check the video and open the review"}
      </button>
      {error && <p role="alert" className="ws-note is-bad mt-3">{error}</p>}

      {summary && (
        <div className="ws-section">
          <h3 className="ws-h3">Lesson summary</h3>
          <ReportText text={summary} />
        </div>
      )}
    </div>
  );
}
