"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { reportWeekStart } from "@/lib/ops/report-week";
import ReportSummary from "@/components/ops/ReportSummary";
import MarkdownPreview from "@/components/ops/MarkdownPreview";
import { Icon } from "@/components/ops/workspace/WorkspaceUI";
type Report = {
  id: string;
  week_start: string;
  status: string;
  updated_at: string;
  send_claim_id: string | null;
  narrative_md: string;
  observations_md: string;
  data: Record<string, unknown>;
};
export default function ReportDetail() {
  const { id } = useParams<{ id: string }>(),
    [report, setReport] = useState<Report | null>(null),
    [text, setText] = useState(""),
    [observations, setObservations] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/reports/${id}`),
      d = await r.json();
    if (!r.ok) throw Error(d.error);
    setReport(d.report);
    setText(d.report.narrative_md);
    setObservations(d.report.observations_md);
  }, [id]);
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, [load]);
  async function save(action?: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await fetch(`/api/admin/reports/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            action === "send" || action === "refresh"
              ? { action, expected_updated_at: report?.updated_at }
              : {
                  expected_updated_at: report?.updated_at,
                  narrative_md: text,
                  observations_md: observations,
                  ...(action ? { action } : {}),
                },
          ),
        }),
        d = await r.json();
      if (!r.ok) throw Error(d.error);
      setReport(d.report);
      if (d.refreshed) {
        setText(d.report.narrative_md);
        setObservations(d.report.observations_md);
      }
      setNotice(
        d.refreshed
          ? "Sources refreshed. Check the saved narrative against the updated figures before review."
          : d.disabled
            ? "Sending is disabled. Review flow verified; no email sent."
            : action === "review"
              ? "Marked reviewed"
              : action === "send"
                ? "Report sent"
                : "Draft saved",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="ws ws-page ws-rp">
      <Link href="/admin/reports" className="ws-back ws-focus">
        <Icon name="chevron" size={14} className="ws-back-ic" />
        Reports
      </Link>
      <div className="ws-ph">
        <div className="min-w-0">
          <h1 className="ws-title">
            Weekly report{report ? ` · ${report.week_start}` : ""}
          </h1>
          {report && <p className="ws-meta mt-1">Status: {report.status}</p>}
        </div>
      </div>
      {error && (
        <div role="alert" className="ws-note is-attn">
          <Icon name="alert" size={15} />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div role="status" className="ws-note is-info">
          <Icon name="info" size={15} />
          <span>{notice}</span>
        </div>
      )}
      {report && (
        <>
          {Boolean(report.data.narrative_review_required) && (
            <div role="status" className="ws-note is-attn">
              <Icon name="alert" size={15} />
              <span>
                Source figures changed. Check the saved narrative before marking
                reviewed.
              </span>
            </div>
          )}
          {report.send_claim_id && (
            <div role="status" className="ws-note is-attn">
              <Icon name="alert" size={15} />
              <span>
                A send is in progress or needs reconciliation. This revision is
                locked.
              </span>
            </div>
          )}
          {!report.narrative_md.trim() && (
            <div className="ws-note">
              <Icon name="info" size={15} />
              <span>
                The figures are ready. Ask Codex to prepare this report, or write
                the report text below.
              </span>
            </div>
          )}
          <div className="ws-rp-summary">
            <ReportSummary data={report.data} />
          </div>
          <div className="ws-rp-cols">
            <label className="ws-rp-field">
              <span className="ws-label">Narrative</span>
              <textarea
                aria-label="Report narrative"
                rows={22}
                disabled={
                  report.status === "sent" || Boolean(report.send_claim_id)
                }
                className="ws-input ws-rp-ta"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </label>
            <section className="ws-panel ws-rp-preview" aria-label="Preview">
              <header className="ws-panel-head">
                <h2 className="ws-h2">Preview</h2>
              </header>
              <div className="ws-rp-preview-body">
                <MarkdownPreview text={text} />
              </div>
            </section>
          </div>
          <label className="ws-rp-field">
            <span className="ws-label">Eimear’s observations</span>
            <textarea
              aria-label="Observations"
              rows={5}
              disabled={
                report.status === "sent" || Boolean(report.send_claim_id)
              }
              className="ws-input ws-rp-ta"
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
            />
          </label>
          <div className="ws-rp-actions">
            <div className="ws-rp-btns">
              <button
                type="button"
                className="ws-btn ws-focus"
                disabled={
                  busy ||
                  report.status === "sent" ||
                  Boolean(report.send_claim_id)
                }
                onClick={() => void save()}
              >
                Save draft
              </button>
              <button
                type="button"
                className="ws-btn ws-focus"
                disabled={
                  busy ||
                  report.status === "sent" ||
                  Boolean(report.send_claim_id) ||
                  report.week_start !== reportWeekStart() ||
                  text !== report.narrative_md ||
                  observations !== report.observations_md
                }
                onClick={() => void save("refresh")}
              >
                Refresh source data
              </button>
              <button
                type="button"
                className="ws-btn ws-btn-primary ws-focus"
                disabled={
                  busy ||
                  !text.trim() ||
                  report.status === "sent" ||
                  Boolean(report.send_claim_id)
                }
                onClick={() => void save("review")}
              >
                Mark reviewed
              </button>
              <button
                type="button"
                className="ws-btn ws-focus"
                disabled={
                  busy ||
                  report.status !== "reviewed" ||
                  Boolean(report.send_claim_id) ||
                  text !== report.narrative_md ||
                  observations !== report.observations_md
                }
                onClick={() => void save("send")}
              >
                Send to Marc
              </button>
            </div>
            <p className="ws-caption">
              Source refresh is available for the current week. Historical
              snapshots are preserved. Sending is off by default. Review is
              required before a send can proceed.
            </p>
          </div>
          <details className="ws-panel ws-details ws-rp-source">
            <summary>Source data and periods</summary>
            <pre className="ws-original ws-rp-pre">
              {JSON.stringify(report.data, null, 2)}
            </pre>
          </details>
        </>
      )}
    </div>
  );
}
