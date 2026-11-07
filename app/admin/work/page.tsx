"use client";

import "./workspace.css";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { areaLabels, ownerLabels, statusLabels, needsApproval, isClosed } from "@/lib/ops/workspace";
import { areas, assignees, type OpsTask } from "@/lib/ops/types";
import { createRefreshQueue } from "@/lib/ops/refresh-queue";
import { presentationHref, readableResultTitle, sourceLinkLabel } from "@/lib/ops/workspace-presentation";
import { ReportText } from "@/components/ops/workspace/ReportText";
import { ConnectionsPanel } from "@/components/ops/workspace/ConnectionChecks";
import { sendingState } from "@/lib/ops/connection-status";
import { resultLabels, type WorkspaceCard, type WorkspaceData, type WorkspaceResult } from "@/lib/ops/workspace-types";
import type { OpsArtifact } from "@/lib/ops/action-types";
import type { PaymentCase } from "@/lib/ops/payment-policy";
import { useToast } from "@/components/ui/Toast";
import {
  Avatar, Chip, Icon, Lane, Row, Segmented, areaColour, fullDate, outcomeMeta, ownerColour, when,
} from "@/components/ops/workspace/WorkspaceUI";
import {
  PreparedWorkPanel, artifactKindLabel, artifactStatusLabels, artifactTone, emptyControls, type ActionControls,
} from "@/components/ops/workspace/PreparedWorkPanel";
import { PaymentCasePanel } from "@/components/ops/workspace/PaymentCasePanel";

type Summary = { artifacts: OpsArtifact[]; payments: PaymentCase[]; controls: ActionControls };
type Drawer =
  | { kind: "task"; id: string }
  | { kind: "card"; id: string }
  | { kind: "result"; id: string }
  | { kind: "artifact"; id: string }
  | { kind: "payment"; id: string }
  | { kind: "connections" }
  | null;
type CodexFilter = "all" | "review" | "reports" | "work";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { cache: "no-store", ...init });
  const body = await r.json();
  if (!r.ok) throw Error(body.error || "Could not load this information. Please try again.");
  return body;
}
function dayBucket(ts: number) {
  const key = (d: Date) => d.toLocaleDateString("en-GB", { timeZone: "Europe/London" });
  const now = new Date();
  const d = new Date(ts);
  if (key(d) === key(now)) return "Today";
  if (key(d) === key(new Date(now.getTime() - 864e5))) return "Yesterday";
  if (now.getTime() - ts < 7 * 864e5) return "This week";
  return "Earlier";
}
function greeting() {
  const h = Number(new Date().toLocaleString("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/London" }));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}
function bool(v: unknown) {
  return typeof v === "boolean" ? v : null;
}
function cardLink(card: WorkspaceCard) {
  return card.id.startsWith("client:") || card.id.startsWith("message:") || card.id.startsWith("checkin:") || card.id.startsWith("missing-checkin:") || card.id.startsWith("activity")
    ? "Open client"
    : "Open";
}

export default function WorkPage() {
  const { toast } = useToast();
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [summary, setSummary] = useState<Summary>({ artifacts: [], payments: [], controls: emptyControls });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [busy, setBusy] = useState(false);
  const [panelBusy, setPanelBusy] = useState(false);
  const [note, setNote] = useState("");
  const [actionError, setActionError] = useState("");
  const [codexFilter, setCodexFilter] = useState<CodexFilter>("all");
  const [history, setHistory] = useState(false);
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState<(typeof assignees)[number]>("eimear");
  const [newArea, setNewArea] = useState<OpsTask["area"]>("other");
  const [today, setToday] = useState("");
  const [firstName, setFirstName] = useState("");
  const [search, setSearch] = useState("");
  const panel = useRef<HTMLDialogElement>(null);
  const composer = useRef<HTMLDialogElement>(null);
  const initial = useRef(true);
  const refreshQueue = useRef<ReturnType<typeof createRefreshQueue> | null>(null);

  useEffect(() => {
    setToday(new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/London" }));
    let cancelled = false;
    fetch("/api/portal/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => {
        if (!cancelled && me && typeof me.fullName === "string") setFirstName(me.fullName.trim().split(/\s+/)[0] || "");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback((afterCurrent = false) => {
    if (!refreshQueue.current) {
      refreshQueue.current = createRefreshQueue(async () => {
        setLoading(true);
        try {
          const [ws, sm] = await Promise.allSettled([
            request<WorkspaceData>("/api/admin/workspace"),
            request<{ artifacts: OpsArtifact[]; payments: PaymentCase[]; controls?: Partial<Record<keyof ActionControls, unknown>> }>("/api/admin/ops/automation"),
          ]);
          if (ws.status === "fulfilled") {
            setData(ws.value);
            setError("");
          } else setError(ws.reason instanceof Error ? ws.reason.message : "Workspace check failed");
          if (sm.status === "fulfilled") {
            const c = sm.value.controls || {};
            setSummary({
              artifacts: sm.value.artifacts || [],
              payments: sm.value.payments || [],
              controls: { content_scheduling: bool(c.content_scheduling), lesson_publication: bool(c.lesson_publication), payment_reminders: bool(c.payment_reminders) },
            });
          }
          if (initial.current) {
            initial.current = false;
            const q = new URLSearchParams(window.location.search);
            const t = q.get("task"), a = q.get("artifact"), p = q.get("payment");
            if (t && ws.status === "fulfilled" && ws.value.tasks.some((x) => x.id === t)) setDrawer({ kind: "task", id: t });
            else if (a && sm.status === "fulfilled" && sm.value.artifacts.some((x) => x.id === a)) setDrawer({ kind: "artifact", id: a });
            else if (p && sm.status === "fulfilled" && sm.value.payments.some((x) => x.id === p)) setDrawer({ kind: "payment", id: p });
          }
        } finally {
          setLoading(false);
        }
      });
    }
    return refreshQueue.current(afterCurrent);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden && !busy && !panelBusy) void load();
    }, 60000);
    return () => clearInterval(timer);
  }, [load, busy, panelBusy]);

  useEffect(() => {
    if (drawer && !panel.current?.open) panel.current?.showModal();
    if (!drawer) panel.current?.close();
  }, [drawer]);
  function close() {
    setDrawer(null);
    setActionError("");
    setNote("");
  }
  async function mutate(path: string, method: string, body: unknown) {
    setBusy(true);
    setActionError("");
    try {
      await request(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      await load(true);
      return true;
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not save");
      return false;
    } finally {
      setBusy(false);
    }
  }
  function openCard(card: WorkspaceCard) {
    setNote("");
    setActionError("");
    if (card.task_id) setDrawer({ kind: "task", id: card.task_id });
    else if (card.id.startsWith("artifact:")) setDrawer({ kind: "artifact", id: card.id.slice(9) });
    else if (card.id.startsWith("payment:")) setDrawer({ kind: "payment", id: card.id.slice(8) });
    else if (card.id.startsWith("report:")) setDrawer({ kind: "result", id: card.id.slice(7) });
    else setDrawer({ kind: "card", id: card.id });
  }
  function openComposer() {
    setActionError("");
    composer.current?.showModal();
  }
  function closeComposer() {
    setActionError("");
    composer.current?.close();
  }

  const cards = useMemo(() => {
    const due = new Map((data?.tasks || []).map((t) => [t.id, t.due_at]));
    return (data?.cards || []).map((c) => (c.task_id && due.has(c.task_id) ? { ...c, due_at: due.get(c.task_id) } : c));
  }, [data]);
  const current = cards.filter((c) => !c.history);
  const q = search.trim().toLowerCase();
  const lane = (owner: WorkspaceCard["owner"][]) =>
    cards.filter(
      (c) =>
        owner.includes(c.owner) &&
        (history ? c.history : !c.history) &&
        (!q || `${c.title} ${c.next} ${c.detail}`.toLowerCase().includes(q)),
    );
  const decideCount = current.filter((c) => c.approval).length;
  const decideMarc = current.filter((c) => c.approval && c.owner === "marc").length;
  const decideEimear = current.filter((c) => c.approval && c.owner === "eimear").length;
  const attnCount = current.filter((c) => !c.approval && c.attention).length;
  const draftCount = summary.artifacts.filter((a) => a.status === "draft" || a.status === "needs_attention").length;
  const outbound = sendingState(data?.controls);
  const firstLoad = !data && loading;

  type CodexRow = { key: string; sort: number; node: React.ReactNode };
  const codexRows: CodexRow[] = useMemo(() => {
    const rows: CodexRow[] = [];
    if (codexFilter !== "reports")
      for (const a of summary.artifacts) {
        if (a.status === "superseded") continue;
        if (codexFilter === "review" && !["draft", "needs_attention"].includes(a.status)) continue;
        rows.push({
          key: `a:${a.id}`,
          sort: Date.parse(a.updated_at),
          node: (
            <Row
              key={`a:${a.id}`}
              tone={a.status === "draft" ? "decide" : a.status === "needs_attention" ? "attn" : a.status === "completed" ? "ok" : undefined}
              title={a.title}
              sub={`Version ${a.version}`}
              area={artifactKindLabel(a)}
              areaColour={areaColour[a.kind === "content" ? "content" : "lessons"]}
              chip={artifactStatusLabels[a.status]}
              chipTone={artifactTone(a.status)}
              time={when(a.updated_at)}
              onOpen={() => setDrawer({ kind: "artifact", id: a.id })}
            />
          ),
        });
      }
    // Codex keeps every revision; show the latest of each kind here.
    const latest = new Map<string, WorkspaceResult>();
    for (const r of data?.results || [])
      if (!latest.has(r.kind) || Date.parse(r.received_at) > Date.parse(latest.get(r.kind)!.received_at)) latest.set(r.kind, r);
    if (codexFilter === "all" || codexFilter === "reports")
      for (const r of latest.values())
        rows.push({
          key: `r:${r.id}`,
          sort: Date.parse(r.observed_at),
          node: (
            <Row
              key={`r:${r.id}`}
              tone={r.outcome === "complete" ? "ok" : r.outcome === "partial" ? "attn" : undefined}
              title={readableResultTitle(r)}
              area={resultLabels[r.kind]}
              areaColour={areaColour.reporting}
              chip={r.outcome === "complete" ? undefined : outcomeMeta[r.outcome].label}
              chipTone={r.outcome === "complete" ? undefined : outcomeMeta[r.outcome].tone}
              time={when(r.observed_at)}
              onOpen={() => setDrawer({ kind: "result", id: r.id })}
            />
          ),
        });
    return rows.sort((a, b) => b.sort - a.sort);
  }, [summary.artifacts, data?.results, codexFilter]);

  const selectedTask = drawer?.kind === "task" ? data?.tasks.find((t) => t.id === drawer.id) : undefined;
  const selectedCard =
    drawer?.kind === "card" ? cards.find((c) => c.id === drawer.id) : drawer?.kind === "task" ? cards.find((c) => c.task_id === drawer.id) : undefined;
  const selectedResult = drawer?.kind === "result" ? data?.results.find((r) => r.id === drawer.id) : undefined;
  const selectedArtifact = drawer?.kind === "artifact" ? summary.artifacts.find((a) => a.id === drawer.id) : undefined;
  const selectedPayment = drawer?.kind === "payment" ? summary.payments.find((p) => p.id === drawer.id) : undefined;
  const taskPaymentId = selectedTask && typeof selectedTask.payload?.payment_case_id === "string" ? selectedTask.payload.payment_case_id : null;

  const drawerTitle =
    drawer?.kind === "connections" ? "Connections"
      : selectedTask ? selectedTask.title
        : selectedCard ? selectedCard.title
          : selectedResult ? readableResultTitle(selectedResult)
            : selectedArtifact ? selectedArtifact.title
              : selectedPayment ? (selectedPayment.customer_name || selectedPayment.contact_email || "Payment")
                : drawer?.kind === "payment" ? "Payment" : drawer?.kind === "artifact" ? "Prepared work" : "";
  const drawerKicker =
    drawer?.kind === "connections" ? "CRM, Drive and sending"
      : selectedTask ? `${areaLabels[selectedTask.area]} · ${ownerLabels[selectedTask.assignee]}`
        : selectedCard ? `${areaLabels[selectedCard.area]} · ${ownerLabels[selectedCard.owner]}`
          : selectedResult ? `${resultLabels[selectedResult.kind]} · ${fullDate(selectedResult.observed_at)}`
            : selectedArtifact ? artifactKindLabel(selectedArtifact)
              : drawer?.kind === "payment" ? "Payment follow-up" : "";

  return (
    <div className="ws mx-auto max-w-[1240px] pb-24 lg:pb-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="ws-kicker">Workspace</p>
          <h1 className="ws-title mt-1">{today ? `${greeting()}${firstName ? `, ${firstName}` : ""}` : "Workspace"}</h1>
          <p className="ws-meta mt-1.5">
            {today}
            {data ? ` · checked ${when(data.checked_at)}` : ""}
            {data?.mode === "preview" ? " · preview data" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="ws-btn ws-btn-quiet hidden sm:inline-flex" onClick={() => setDrawer({ kind: "connections" })}>
            <Icon name="plug" size={15} /> Connections
          </button>
          <button
            type="button"
            className="ws-btn ws-btn-icon"
            disabled={loading || busy}
            onClick={() => void load()}
            aria-label={loading ? "Checking" : "Refresh"}
            title={data ? `Last checked ${fullDate(data.checked_at)}` : undefined}
          >
            <Icon name="refresh" size={16} className={loading ? "ws-spin" : ""} />
          </button>
          <button type="button" className="ws-btn ws-btn-primary" onClick={openComposer}>
            <Icon name="plus" size={15} stroke={2.4} /> New task
          </button>
        </div>
      </header>

      {error && (
        <p role="alert" className="ws-note is-attn mt-4">
          <Icon name="alert" size={16} className="mt-0.5 flex-none" /> <span>{error}</span>
        </p>
      )}

      <div className="ws-strip mt-5" aria-label="Today">
        <button type="button" className="ws-stat ws-focus" onClick={() => setHistory(false)}>
          <span className="ws-stat-l"><Icon name="checkCircle" size={13} /> To decide</span>
          <span className="ws-stat-n">{firstLoad ? "–" : decideCount}</span>
          <span className={`ws-stat-s ${decideCount ? "is-accent" : ""}`}>
            {firstLoad ? " " : decideCount ? `${decideMarc} for Marc · ${decideEimear} for Eimear` : "nothing waiting"}
          </span>
        </button>
        <button type="button" className="ws-stat ws-focus" onClick={() => setHistory(false)}>
          <span className="ws-stat-l"><Icon name="alert" size={13} /> Follow up</span>
          <span className="ws-stat-n">{firstLoad ? "–" : attnCount}</span>
          <span className={`ws-stat-s ${attnCount ? "is-attn" : ""}`}>{firstLoad ? " " : attnCount ? "clients and records needing a look" : "all clear"}</span>
        </button>
        <button type="button" className="ws-stat ws-focus" onClick={() => setCodexFilter("review")}>
          <span className="ws-stat-l"><Icon name="sparkle" size={13} /> Prepared by Codex</span>
          <span className="ws-stat-n">{firstLoad ? "–" : draftCount}</span>
          <span className={`ws-stat-s ${draftCount ? "is-accent" : ""}`}>{firstLoad ? " " : draftCount ? "waiting for review" : "nothing to review"}</span>
        </button>
        <button type="button" className="ws-stat ws-focus" onClick={() => setDrawer({ kind: "connections" })}>
          <span className="ws-stat-l"><Icon name="plug" size={13} /> Sending</span>
          <span className={`ws-stat-n ${outbound === "enabled" ? "is-on" : ""}`}>
            {outbound === "off" ? "Off" : outbound === "enabled" ? "On" : "–"}
          </span>
          <span className={`ws-stat-s ${outbound === "enabled" ? "is-attn" : ""}`}>
            {outbound === "off" ? "approvals send nothing" : outbound === "enabled" ? "some actions are live" : "not confirmed"}
          </span>
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <h2 className="ws-h2">The team’s work</h2>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            className="ws-input ws-search"
            placeholder="Search"
            aria-label="Search the team's work"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Segmented<"open" | "closed">
          label="Show"
          value={history ? "closed" : "open"}
          onChange={(v) => setHistory(v === "closed")}
          options={[{ value: "open", label: "Open" }, { value: "closed", label: "Closed" }]}
          />
        </div>
      </div>
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <Lane title="Marc" owner="marc" cards={lane(["marc"])} history={history} loading={firstLoad} onOpen={openCard} />
        <Lane title="Eimear" owner="eimear" cards={lane(["eimear"])} history={history} loading={firstLoad} onOpen={openCard} />
      </div>
      {lane(["flowstate", "system"]).length > 0 && (
        <details className="ws-panel mt-4 overflow-hidden">
          <summary className="ws-panel-head cursor-pointer list-none">
            <Avatar owner="flowstate" />
            <span className="ws-h2 flex-1">Flowstate and automation</span>
            <span className="ws-caption">{lane(["flowstate", "system"]).length}</span>
          </summary>
          <div>
            {lane(["flowstate", "system"]).slice(0, 12).map((c) => (
              <Row
                key={c.id}
                tone={c.approval ? "decide" : c.attention ? "attn" : undefined}
                title={c.title}
                sub={c.next || undefined}
                area={areaLabels[c.area]}
                areaColour={areaColour[c.area]}
                time={when(c.observed_at)}
                onOpen={() => openCard(c)}
              />
            ))}
          </div>
        </details>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-2">
        <h2 className="ws-h2">Prepared by Codex</h2>
        <Segmented<CodexFilter>
          label="Filter prepared work"
          value={codexFilter}
          onChange={setCodexFilter}
          options={[
            { value: "all", label: "All" },
            { value: "review", label: "Needs review", count: draftCount },
            { value: "work", label: "Content and lessons" },
            { value: "reports", label: "Reports" },
          ]}
        />
      </div>
      <section className="ws-panel mt-3 overflow-hidden" aria-label="Prepared by Codex">
        {firstLoad ? (
          <div className="space-y-3 p-4">{[0, 1, 2].map((i) => <div key={i} className="ws-skel h-9 w-full" />)}</div>
        ) : codexRows.length ? (
          <div>
            {codexRows.map((r, i) => {
              const day = dayBucket(r.sort);
              const prev = i ? dayBucket(codexRows[i - 1].sort) : null;
              return (
                <div key={r.key}>
                  {day !== prev && <div className="ws-day">{day}</div>}
                  {r.node}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="ws-empty">Nothing prepared in this view yet.</p>
        )}
      </section>

      {/* Drawer */}
      <dialog ref={panel} className="ws-drawer" aria-label={drawerTitle} onClose={close} onCancel={(e) => { e.preventDefault(); close(); }}>
        {drawer && (
          <>
            <div className="ws-drawer-head">
              <div className="min-w-0 flex-1">
                {drawerKicker && <p className="ws-caption">{drawerKicker}</p>}
                <h2 className="ws-drawer-title mt-0.5">{drawerTitle}</h2>
              </div>
              <button type="button" className="ws-btn ws-btn-icon ws-btn-quiet -mr-2" onClick={close} aria-label="Close">
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="ws-drawer-body">
              {actionError && <p role="alert" className="ws-note is-bad mb-4">{actionError}</p>}
              {drawer.kind === "connections" && <ConnectionsPanel />}
              {selectedResult && <ResultDetail result={selectedResult} />}
              {selectedArtifact && (
                <PreparedWorkPanel artifact={selectedArtifact} controls={summary.controls} onChanged={() => load(true)} onBusy={setPanelBusy} />
              )}
              {drawer.kind === "artifact" && !selectedArtifact && <p className="ws-caption">This item is no longer listed. Refresh to check.</p>}
              {drawer.kind === "payment" && (
                <PaymentCasePanel paymentId={drawer.id} initial={selectedPayment} remindersEnabled={summary.controls.payment_reminders} />
              )}
              {selectedTask && (
                <TaskDetail task={selectedTask} card={selectedCard} busy={busy} note={note} setNote={setNote} mutate={mutate} />
              )}
              {selectedTask && taskPaymentId && (
                <div className="ws-section">
                  <h3 className="ws-h3">Payment</h3>
                  <PaymentCasePanel paymentId={taskPaymentId} initial={summary.payments.find((p) => p.id === taskPaymentId)} remindersEnabled={summary.controls.payment_reminders} showTaskLink={false} />
                </div>
              )}
              {drawer.kind === "task" && !selectedTask && <p className="ws-caption">This task is no longer listed. Refresh to check.</p>}
              {drawer.kind === "card" && selectedCard && <CardDetail card={selectedCard} />}
            </div>
            {selectedTask && !isClosed(selectedTask) && (
              <div className="ws-drawer-foot">
                {needsApproval(selectedTask) ? (
                  <>
                    <button
                      type="button"
                      className="ws-btn ws-btn-primary"
                      disabled={busy}
                      onClick={async () => {
                        if (await mutate(`/api/admin/work/${selectedTask.id}`, "POST", { decision: "approved", note })) {
                          close();
                          toast("Approved.");
                        }
                      }}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="ws-btn"
                      disabled={busy || !note.trim()}
                      title={note.trim() ? undefined : "Add a note first"}
                      onClick={async () => {
                        if (await mutate(`/api/admin/work/${selectedTask.id}`, "POST", { decision: "rejected", note })) {
                          close();
                          toast("Changes requested.", "info");
                        }
                      }}
                    >
                      Request changes
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="ws-btn ws-btn-primary"
                    disabled={busy}
                    onClick={async () => {
                      if (await mutate(`/api/admin/work/${selectedTask.id}`, "PATCH", { status: "done", decision_note: note })) {
                        close();
                        toast("Marked as done.");
                      }
                    }}
                  >
                    <Icon name="check" size={15} stroke={2.4} /> Mark done
                  </button>
                )}
                {selectedCard && presentationHref(selectedCard.url) && !selectedCard.url.startsWith("/admin/work") && (
                  <Link className="ws-btn ws-btn-quiet ml-auto" href={presentationHref(selectedCard.url)!}>
                    {cardLink(selectedCard)} <Icon name="arrow" size={14} />
                  </Link>
                )}
              </div>
            )}
            {drawer.kind === "card" && selectedCard && presentationHref(selectedCard.url) && (
              <div className="ws-drawer-foot">
                <Link className="ws-btn ws-btn-primary" href={presentationHref(selectedCard.url)!}>
                  {cardLink(selectedCard)} <Icon name="arrow" size={14} />
                </Link>
              </div>
            )}
          </>
        )}
      </dialog>

      {/* New task */}
      <dialog ref={composer} className="ws-modal" aria-label="New task" onClose={closeComposer}>
        <form
          className="p-5"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!title.trim()) return;
            if (await mutate("/api/admin/work", "POST", { title, kind: "task", area: newArea, source: "human", assignee: owner })) {
              setTitle("");
              closeComposer();
              toast("Task added.");
            }
          }}
        >
          <h2 className="ws-drawer-title">New task</h2>
          {actionError && <p role="alert" className="ws-note is-bad mt-3">{actionError}</p>}
          <label className="mt-4 block">
            <span className="ws-label">What needs doing</span>
            <input className="ws-input" value={title} maxLength={300} required disabled={busy} onChange={(e) => setTitle(e.target.value)} placeholder="Short, specific, one line" />
          </label>
          <div className="mt-4">
            <span className="ws-label">For</span>
            <div className="ws-owner" role="radiogroup" aria-label="Assign to">
              {assignees.map((a) => (
                <button key={a} type="button" role="radio" aria-checked={owner === a} className="ws-owner-btn ws-focus" style={{ "--c": ownerColour[a] } as CSSProperties} onClick={() => setOwner(a)}>
                  <Avatar owner={a} size="sm" /> {ownerLabels[a]}
                </button>
              ))}
            </div>
          </div>
          <label className="mt-4 block">
            <span className="ws-label">Area</span>
            <select className="ws-input" value={newArea} disabled={busy} onChange={(e) => setNewArea(e.target.value as OpsTask["area"])}>
              {areas.map((a) => (
                <option key={a} value={a}>{areaLabels[a]}</option>
              ))}
            </select>
          </label>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="ws-btn ws-btn-quiet" onClick={closeComposer} disabled={busy}>Cancel</button>
            <button type="submit" className="ws-btn ws-btn-primary" disabled={busy || !title.trim()}>Add task</button>
          </div>
        </form>
      </dialog>
    </div>
  );
}

function LinkList({ links }: { links: { label: string; url: string }[] }) {
  const safe = links.filter((l) => presentationHref(l.url));
  if (!safe.length) return null;
  return (
    <div className="ws-section">
      <h3 className="ws-h3">Links</h3>
      <div className="flex flex-wrap gap-2">
        {safe.map((l, i) => (
          <a key={i} className="ws-btn" href={presentationHref(l.url)!} target="_blank" rel="noreferrer noopener">
            {sourceLinkLabel(l.label, l.url)} <Icon name="external" size={13} />
          </a>
        ))}
      </div>
    </div>
  );
}

function ResultDetail({ result }: { result: WorkspaceResult }) {
  const meta = outcomeMeta[result.outcome];
  return (
    <div>
      <div className={`ws-note ${meta.tone === "ok" ? "is-ok" : meta.tone === "attn" ? "is-attn" : "is-bad"}`}>
        <Icon name={meta.tone === "ok" ? "checkCircle" : "alert"} size={16} className="mt-0.5 flex-none" />
        <span>
          <strong>{meta.label}.</strong>{" "}
          {result.outcome === "failed" ? "The check stopped before it finished." : result.outcome === "partial" ? "Some sources were unavailable; read the coverage before acting." : "Read the date and coverage before using these findings."}
          <details className="ws-details mt-2">
            <summary>Coverage</summary>
            <ReportText className="mt-2" text={result.coverage} />
          </details>
        </span>
      </div>
      <div className="ws-section">
        <ReportText text={result.summary} />
      </div>
      <div className="ws-section">
        <ReportText text={result.body} />
      </div>
      <LinkList links={result.links} />
      <details className="ws-details ws-section">
        <summary>Saved text and details</summary>
        <dl className="ws-kv mt-3">
          <dt>Title</dt><dd>{result.title}</dd>
          <dt>Report date</dt><dd>{fullDate(result.observed_at)}</dd>
          <dt>Saved</dt><dd>{fullDate(result.received_at)}</dd>
        </dl>
        <pre className="ws-original mt-3">{result.body}</pre>
      </details>
    </div>
  );
}

function CardDetail({ card }: { card: WorkspaceCard }) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={card.approval ? "decide" : card.attention ? "attn" : undefined}>{card.state}</Chip>
        <span className="ws-caption">{when(card.observed_at)}</span>
      </div>
      {card.next && <p className="mt-4 text-[0.95rem] font-medium leading-relaxed">{card.next}</p>}
      <ReportText className="mt-4" text={card.detail} />
    </div>
  );
}

function TaskDetail({
  task, card, busy, note, setNote, mutate,
}: {
  task: OpsTask;
  card?: WorkspaceCard;
  busy: boolean;
  note: string;
  setNote: (s: string) => void;
  mutate: (path: string, method: string, body: unknown) => Promise<boolean>;
}) {
  const deciding = needsApproval(task);
  const closed = isClosed(task);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={deciding ? "decide" : task.kind === "flag" && !closed ? "attn" : closed ? "ok" : undefined}>{statusLabels[task.status]}</Chip>
        {task.due_at && <span className="ws-caption">Due {fullDate(task.due_at)}</span>}
        {task.decided_at && <span className="ws-caption">Decided {fullDate(task.decided_at)}</span>}
      </div>
      {card?.next && <p className="mt-4 text-[0.95rem] font-medium leading-relaxed">{card.next}</p>}
      <ReportText className="mt-4" text={task.detail || ""} />
      <LinkList links={[...task.links, ...task.outputs]} />

      <div className="ws-section">
        <h3 className="ws-h3">Assigned to</h3>
        <div className="ws-owner" role="radiogroup" aria-label="Assign to">
          {assignees.map((a) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={task.assignee === a}
              disabled={busy || closed}
              className="ws-owner-btn ws-focus"
              style={{ "--c": ownerColour[a] } as CSSProperties}
              onClick={() => {
                if (task.assignee !== a) void mutate(`/api/admin/work/${task.id}`, "PATCH", { assignee: a });
              }}
            >
              <Avatar owner={a} size="sm" /> {ownerLabels[a]}
              {task.assignee === a && <Icon name="check" size={14} stroke={2.4} className="ml-auto" />}
            </button>
          ))}
        </div>
      </div>

      {!closed && (
        <label className="ws-section block">
          <span className="ws-label">{deciding ? "Decision note" : "Note"} <span className="font-normal opacity-70">{deciding ? "(required to request changes)" : "(optional, saved when marked done)"}</span></span>
          <textarea className="ws-input" value={note} disabled={busy} maxLength={5000} rows={3} onChange={(e) => setNote(e.target.value)} />
        </label>
      )}
      {task.decision_note && (
        <div className="ws-section">
          <h3 className="ws-h3">Previous note</h3>
          <p className="ws-prose">{task.decision_note}</p>
        </div>
      )}
    </div>
  );
}
