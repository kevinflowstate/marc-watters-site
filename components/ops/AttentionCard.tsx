"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { isClosed, needsApproval } from "@/lib/ops/workspace";
import type { OpsTask } from "@/lib/ops/types";
import { Icon } from "@/components/ops/workspace/WorkspaceUI";
export default function AttentionCard() {
  const [tasks, setTasks] = useState<OpsTask[] | null>(null);
  // Only say "unavailable" once a read has actually failed; before the first answer it is loading.
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const load = () =>
      fetch("/api/admin/work")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d) {
            setTasks(d.tasks);
            setFailed(false);
          } else setFailed(true);
        })
        .catch(() => setFailed(true));
    void load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);
  const open = tasks?.filter((t) => !isClosed(t));
  const approvals = open?.filter(needsApproval).length ?? 0;
  const flags = open?.filter((t) => t.kind === "flag").length ?? 0;
  return (
    <section className="ws-panel" aria-label="Workspace">
      <div className="ws-panel-head">
        <Icon name="inbox" size={15} className="shrink-0" />
        <h2 className="ws-h2">
          <Link href="/admin/work" className="ws-link" style={{ color: "var(--ws-ink)" }}>
            Open your workspace
          </Link>
        </h2>
        <span className="flex items-center gap-1.5 flex-wrap">
          {open ? (
            <>
              <span className="ws-chip">{open.length} open</span>
              <span className={`ws-chip ${approvals ? "is-decide" : ""}`}>{approvals} approval{approvals === 1 ? "" : "s"}</span>
              <span className={`ws-chip ${flags ? "is-attn" : ""}`}>{flags} flag{flags === 1 ? "" : "s"}</span>
            </>
          ) : (
            <span className="ws-caption">{failed ? "Work queue unavailable" : "Loading..."}</span>
          )}
        </span>
      </div>
      <div className="flex gap-1 flex-wrap px-2 py-1.5">
        <Link href="/admin/reports" className="ws-btn ws-btn-quiet ws-btn-sm ws-focus">Reports</Link>
        <Link href="/admin/work" className="ws-btn ws-btn-quiet ws-btn-sm ws-focus">Tasks &amp; approvals</Link>
        <Link href="/admin/settings" className="ws-btn ws-btn-quiet ws-btn-sm ws-focus">Settings</Link>
      </div>
    </section>
  );
}
