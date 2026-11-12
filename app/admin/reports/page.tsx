"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Chip, Empty, Icon, StatusIcon } from "@/components/ops/workspace/WorkspaceUI";
type Row = {
  id: string;
  week_start: string;
  status: string;
  updated_at: string;
};
export default function Reports() {
  const [rows, setRows] = useState<Row[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const r = await fetch("/api/admin/reports"),
      d = await r.json();
    if (!r.ok) throw Error(d.error);
    setRows(d.reports);
  }, []);
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, [load]);
  return (
    <div className="ws ws-page">
      <div className="ws-ph">
        <div className="min-w-0 ws-rp-intro">
          <h1 className="ws-title">Thursday reports</h1>
          <p className="ws-meta mt-1">
            The portal gathers the figures. Codex prepares the report, then you
            review the wording and add your observations here.
          </p>
        </div>
        <div className="ws-ph-acts">
          <button
            type="button"
            disabled={busy}
            className="ws-btn ws-btn-primary ws-focus"
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const r = await fetch("/api/admin/reports", { method: "POST" }),
                  d = await r.json();
                if (!r.ok) throw Error(d.error);
                await load();
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Could not create draft",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? <Icon name="refresh" size={14} className="ws-spin" /> : <Icon name="reporting" size={14} />}
            Gather this week’s figures
          </button>
        </div>
      </div>
      {error && (
        <div role="alert" className="ws-note is-attn">
          <Icon name="alert" size={15} />
          <span>{error}</span>
        </div>
      )}
      <section className="ws-panel" aria-label="Reports">
        <header className="ws-panel-head">
          <h2 className="ws-h2">Reports</h2>
          <span className="ws-caption">{rows.length}</span>
        </header>
        <div>
          {rows.length ? (
            rows.map((r) => (
              <Link
                className="ws-row ws-focus ws-rp-row"
                href={`/admin/reports/${r.id}`}
                key={r.id}
              >
                <StatusIcon tone={r.status === "sent" ? "ok" : r.status === "reviewed" ? "running" : "decide"} />
                <span className="min-w-0">
                  <span className="ws-row-title">
                    Week of{" "}
                    {new Date(r.week_start + "T12:00:00Z").toLocaleDateString(
                      "en-GB",
                    )}
                  </span>
                  <span className="ws-row-sub">
                    Updated {new Date(r.updated_at).toLocaleString("en-GB")}
                  </span>
                </span>
                <span className="ws-row-meta ws-rp-meta">
                  <Chip tone={r.status === "sent" ? "ok" : "decide"}>{r.status}</Chip>
                </span>
              </Link>
            ))
          ) : (
            <Empty icon="reporting" title="No reports yet." />
          )}
        </div>
      </section>
    </div>
  );
}
