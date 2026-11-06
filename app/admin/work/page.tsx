"use client";

import "./workspace.css";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  areaLabels,
  ownerLabels,
  statusLabels,
  needsApproval,
  isClosed,
} from "@/lib/ops/workspace";
import { areas, assignees, type OpsTask } from "@/lib/ops/types";
import { createRefreshQueue } from "@/lib/ops/refresh-queue";
import {
  resultKinds,
  resultLabels,
  type WorkspaceCard,
  type WorkspaceData,
  type WorkspaceResult,
} from "@/lib/ops/workspace-types";
import { useToast } from "@/components/ui/Toast";
import {
  Avatar,
  Icon,
  Lane,
  Segmented,
  areaColour,
  cardTone,
  fullDate,
  outcomeMeta,
  ownerColour,
  when,
} from "@/components/ops/workspace/WorkspaceUI";

const views = [
  "All current",
  "Needs attention",
  "Needs approval",
  "History",
] as const;
type View = (typeof views)[number];
const viewLabels: Record<View, string> = {
  "All current": "Current",
  "Needs attention": "Follow up",
  "Needs approval": "To decide",
  History: "History",
};
type LaneKey = "marc" | "eimear" | "team";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { cache: "no-store", ...init });
  const body = await r.json();
  if (!r.ok)
    throw Error(
      body.error || "Could not load this information. Please try again.",
    );
  return body;
}
function inView(card: WorkspaceCard, view: View) {
  return view === "History"
    ? card.history
    : !card.history &&
        (view === "All current" ||
          (view === "Needs approval" ? card.approval : card.attention));
}
function laneOf(card: WorkspaceCard): LaneKey {
  return card.owner === "marc" || card.owner === "eimear" ? card.owner : "team";
}
function linkLabel(card: WorkspaceCard) {
  return card.id.startsWith("artifact:")
    ? "Review work"
    : card.id.startsWith("payment:")
      ? "Check payment"
      : card.id.startsWith("report:")
        ? "Read report"
        : "Open client";
}
function greeting() {
  const h = Number(
    new Date().toLocaleString("en-GB", {
      hour: "numeric",
      hour12: false,
      timeZone: "Europe/London",
    }),
  );
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default function WorkPage() {
  const { toast } = useToast();
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [view, setView] = useState<View>("All current"),
    [filter, setFilter] = useState("all"),
    [search, setSearch] = useState(""),
    [lane, setLane] = useState<LaneKey>("marc");
  const [taskId, setTaskId] = useState<string | null>(null),
    [cardId, setCardId] = useState<string | null>(null),
    [result, setResult] = useState<WorkspaceResult | null>(null);
  const [busy, setBusy] = useState(false),
    [note, setNote] = useState(""),
    [actionError, setActionError] = useState("");
  const [title, setTitle] = useState(""),
    [owner, setOwner] = useState<(typeof assignees)[number]>("eimear"),
    [newArea, setNewArea] = useState<OpsTask["area"]>("other"),
    [composing, setComposing] = useState(false);
  const [today, setToday] = useState("");
  const panel = useRef<HTMLDialogElement>(null),
    composer = useRef<HTMLDialogElement>(null),
    health = useRef<HTMLDialogElement>(null),
    board = useRef<HTMLDivElement>(null),
    initial = useRef(true),
    refreshQueue = useRef<ReturnType<typeof createRefreshQueue> | null>(null);

  useEffect(() => {
    setToday(
      new Date().toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "Europe/London",
      }),
    );
  }, []);

  const load = useCallback((afterCurrent = false) => {
    if (!refreshQueue.current) {
      refreshQueue.current = createRefreshQueue(async () => {
        setLoading(true);
        try {
          const next = await request<WorkspaceData>("/api/admin/workspace");
          setData(next);
          setError("");
          if (initial.current) {
            initial.current = false;
            const id = new URLSearchParams(window.location.search).get("task");
            if (id && next.tasks.some((t) => t.id === id)) setTaskId(id);
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : "Workspace check failed");
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
  // Refresh only this visible workspace, not a scheduled job or client action.
  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden && !busy) void load();
    }, 60000);
    return () => clearInterval(timer);
  }, [load, busy]);

  const selected = data?.tasks.find((t) => t.id === taskId);
  const selectedCard = data?.cards.find((c) =>
    taskId ? c.task_id === taskId : c.id === cardId,
  );
  const drawerOpen = !!(selected || result || (cardId && selectedCard));
  useEffect(() => {
    if (drawerOpen && !panel.current?.open) panel.current?.showModal();
    if (!drawerOpen) panel.current?.close();
  }, [drawerOpen]);
  function close() {
    setTaskId(null);
    setCardId(null);
    setResult(null);
    setActionError("");
    setNote("");
  }
  async function mutate(path: string, method: string, body: unknown) {
    setBusy(true);
    setActionError("");
    try {
      await request(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
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
    setResult(null);
    setNote("");
    setActionError("");
    if (card.task_id) {
      setCardId(null);
      setTaskId(card.task_id);
    } else {
      setTaskId(null);
      setCardId(card.id);
    }
  }
  function jumpTo(next: View) {
    setView(next);
    board.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function openComposer() {
    setActionError("");
    setComposing(true);
    composer.current?.showModal();
  }
  function closeComposer() {
    setComposing(false);
    setActionError("");
    composer.current?.close();
  }

  const cards = useMemo(() => data?.cards || [], [data]);
  const failed = data?.checks.filter((c) => !c.ok) || [];
  const incomplete = !!failed.length || !!error;
  const visible = cards.filter(
    (c) =>
      inView(c, view) &&
      (filter === "all" ||
        c.area === filter ||
        c.areas?.some((a) => a === filter)) &&
      `${c.title} ${c.detail}`.toLowerCase().includes(search.toLowerCase()),
  );
  const byLane = (k: LaneKey, list: WorkspaceCard[]) =>
    list.filter((c) => laneOf(c) === k);
  const outboundOff = data && !Object.values(data.controls).some(Boolean);
  const latest = resultKinds.map((kind) =>
    data?.results.find((r) => r.kind === kind),
  );
  const decideCount = cards.filter((c) => !c.history && c.approval).length;
  const attnCount = cards.filter((c) => !c.history && c.attention).length;
  const healthy = data ? data.checks.length - failed.length : 0;
  const firstLoad = !data && loading;
  const drawerArea = selected?.area || selectedCard?.area;
  const drawerOwner = selected?.assignee || selectedCard?.owner;

  return (
    <div className="ws mx-auto max-w-[1240px] pb-24 lg:pb-8">
      <div className="ws-ambient" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      {/* Header */}
      <header className="ws-rise flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="ws-kicker">
            {today ? `${greeting()} · ${today}` : " "}
          </p>
          <h1 className="ws-title mt-1.5">Workspace</h1>
          <p className="mt-2 max-w-xl text-[0.95rem] leading-relaxed text-text-secondary">
            Everything waiting on Marc and Eimear, and what Codex has prepared.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="ws-btn ws-btn-glass"
            disabled={loading || busy}
            onClick={() => void load()}
            aria-label={loading ? "Checking the workspace" : "Refresh checks"}
            title={data ? `Last checked ${fullDate(data.checked_at)}` : undefined}
          >
            <Icon name="refresh" size={16} className={loading ? "ws-spin" : ""} />
            <span className="hidden sm:inline">
              {loading ? "Checking…" : "Refresh"}
            </span>
          </button>
          <button
            type="button"
            className="ws-btn ws-btn-primary"
            onClick={openComposer}
          >
            <Icon name="plus" size={16} stroke={2.4} />
            New task
          </button>
        </div>
      </header>

      {data?.mode === "preview" && (
        <div
          className="ws-notice is-info ws-rise mt-5"
          style={{ "--i": 1 } as CSSProperties}
        >
          <Icon name="info" size={17} className="mt-0.5 flex-none" />
          <span>
            <strong className="text-text-primary">Preview workspace.</strong>{" "}
            Client examples are test records. The carousel and imported Codex
            drafts are for review.
          </span>
        </div>
      )}

      {/* Pulse */}
      <div
        className="ws-glass ws-pulse ws-rise mt-5"
        style={{ "--i": 2 } as CSSProperties}
      >
        <button
          type="button"
          className="ws-focus"
          onClick={() => jumpTo("Needs approval")}
        >
          <span className="ws-pulse-label">
            <span className="ws-dot" style={{ color: "var(--ws-decide)" }} />
            To decide
          </span>
          <span className="ws-pulse-value block">
            {data ? (
              <span key={decideCount} className="ws-pop">
                {decideCount}
              </span>
            ) : (
              "–"
            )}
          </span>
          <span className="ws-pulse-sub block">
            Prepared work waiting for review
          </span>
        </button>
        <button
          type="button"
          className="ws-focus"
          onClick={() => jumpTo("Needs attention")}
        >
          <span className="ws-pulse-label">
            <span className="ws-dot" style={{ color: "var(--ws-attn)" }} />
            Follow up
          </span>
          <span className="ws-pulse-value block">
            {data ? (
              <span key={attnCount} className="ws-pop">
                {attnCount}
              </span>
            ) : (
              "–"
            )}
          </span>
          <span className="ws-pulse-sub block">
            Clients and records needing a look
          </span>
        </button>
        <div>
          <span className="ws-pulse-label">
            <Icon name="lock" size={13} stroke={2.2} />
            Sending &amp; publishing
          </span>
          <span className="ws-pulse-value is-text flex items-center gap-2">
            <span
              className="ws-dot is-live"
              style={{
                color: !data
                  ? "var(--ws-ink-3)"
                  : outboundOff
                    ? "var(--ws-ok)"
                    : "var(--ws-attn)",
              }}
            />
            {!data ? "Checking…" : outboundOff ? "Off" : "Some enabled"}
          </span>
          <span className="ws-pulse-sub block">
            {outboundOff || !data
              ? "Approving saves a decision. It sends nothing."
              : "Check the action’s availability first."}
          </span>
        </div>
        <button
          type="button"
          className="ws-focus"
          onClick={() => health.current?.showModal()}
        >
          <span className="ws-pulse-label">
            <Icon name="shield" size={13} stroke={2.2} />
            Sources
          </span>
          <span className="ws-pulse-value is-text flex items-center gap-2">
            <span
              className="ws-dot"
              style={{
                color: !data
                  ? "var(--ws-ink-3)"
                  : failed.length
                    ? "var(--ws-attn)"
                    : "var(--ws-ok)",
              }}
            />
            {!data
              ? "Checking…"
              : failed.length
                ? `${failed.length} need checking`
                : `${healthy} healthy`}
          </span>
          <span className="ws-pulse-sub block">
            {data ? `Checked ${when(data.checked_at)}` : "Not checked yet"}
          </span>
        </button>
      </div>

      {(error || failed.length > 0) && (
        <div className="mt-4 space-y-3">
          {error && (
            <div role="alert" className="ws-notice is-attn ws-rise">
              <Icon name="alert" size={17} className="mt-0.5 flex-none" />
              <span>
                {error}
                {data
                  ? ` Showing the last result from ${fullDate(data.checked_at)}; it may be out of date.`
                  : " No complete workspace result is available."}
              </span>
            </div>
          )}
          {failed.length > 0 && (
            <div role="alert" className="ws-notice is-attn ws-rise">
              <Icon name="alert" size={17} className="mt-0.5 flex-none" />
              <span>
                <strong>Some checks couldn’t finish:</strong>{" "}
                {failed.map((c) => c.label).join(", ")}. Items from these
                sources may be missing. An empty list does not mean everything
                is clear.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Codex reports */}
      <section className="mt-9" aria-labelledby="codex-results-title">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="codex-results-title"
            className="ws-h2 flex items-center gap-2"
          >
            <Icon name="sparkle" size={17} className="text-accent-bright" />
            Prepared by Codex
          </h2>
          <span className="ws-caption">
            Each report shows its own coverage and date
          </span>
        </div>
        <div className="ws-rail">
          {resultKinds.map((kind, index) => {
            const r = latest[index];
            const style = { "--i": index + 3 } as CSSProperties;
            if (!r)
              return (
                <div
                  key={kind}
                  className="ws-report ws-glass ws-rise"
                  style={style}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="ws-report-icon"
                      style={{
                        color: "var(--ws-ink-3)",
                        background: "rgba(255,255,255,0.04)",
                        borderColor: "var(--ws-edge)",
                      }}
                    >
                      <Icon name={kind} size={16} />
                    </span>
                    <span className="text-xs font-semibold text-text-muted">
                      {resultLabels[kind]}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-text-secondary">
                    {failed.some((c) => c.key === "results")
                      ? "Couldn’t check saved results"
                      : firstLoad
                        ? "Checking saved results…"
                        : "No result received yet"}
                  </p>
                  <p className="ws-caption mt-auto">
                    No successful check is assumed.
                  </p>
                </div>
              );
            const meta = outcomeMeta[r.outcome];
            return (
              <button
                key={kind}
                type="button"
                className="ws-report ws-glass ws-rise ws-focus"
                style={style}
                onClick={() => {
                  setTaskId(null);
                  setCardId(null);
                  setActionError("");
                  setResult(r);
                }}
              >
                <div className="flex items-center gap-2.5">
                  <span className="ws-report-icon">
                    <Icon name={kind} size={16} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold text-text-secondary">
                    {resultLabels[kind]}
                  </span>
                  <span
                    className="ws-dot"
                    style={{ color: meta.colour }}
                    title={meta.label}
                    aria-label={meta.label}
                  />
                </div>
                <span className="ws-report-title">{r.title}</span>
                <span className="mt-auto flex items-center justify-between gap-2 pt-1 text-xs text-text-muted">
                  <span className="truncate">
                    {meta.label} · {when(r.observed_at)}
                  </span>
                  <Icon name="arrow" size={14} className="ws-arrow flex-none" />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Board */}
      <div ref={board} className="scroll-mt-4 pt-6">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="ws-h2">The team’s work</h2>
          <Link
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-accent-bright hover:underline"
            href="/admin/automation"
          >
            Content, lessons &amp; payments
            <Icon name="arrow" size={14} />
          </Link>
        </div>

        <div className="ws-toolbar ws-glass">
          <Segmented
            label="Work filters"
            value={view}
            onChange={setView}
            options={views.map((v) => ({
              value: v,
              label: viewLabels[v],
              count: cards.filter((c) => inView(c, v)).length,
            }))}
          />
          <label className="ws-search">
            <span className="sr-only">Find client or work</span>
            <Icon name="search" size={16} />
            <input
              className="ws-input"
              aria-label="Find client or work"
              placeholder="Find a client or piece of work"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select
            aria-label="Filter by area"
            className="ws-input ws-select"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">Every area</option>
            {areas.map((a) => (
              <option key={a} value={a}>
                {areaLabels[a]}
              </option>
            ))}
          </select>
        </div>

        <Segmented
          label="Whose work"
          className="ws-owner-switch mt-3 flex w-full [&>button]:flex-1 [&>button]:justify-center"
          value={lane}
          onChange={setLane}
          options={[
            {
              value: "marc",
              label: (
                <>
                  <Avatar owner="marc" size="sm" />
                  Marc
                </>
              ),
              count: byLane("marc", visible).length,
            },
            {
              value: "eimear",
              label: (
                <>
                  <Avatar owner="eimear" size="sm" />
                  Eimear
                </>
              ),
              count: byLane("eimear", visible).length,
            },
            {
              value: "team",
              label: "Flowstate",
              count: byLane("team", visible).length,
            },
          ]}
        />

        <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
          {(["marc", "eimear"] as const).map((k) => (
            <Lane
              key={k}
              laneKey={k}
              owner={k}
              title={`${ownerLabels[k]}’s tasks`}
              subtitle={`${byLane(k, cards.filter((c) => !c.history)).length} open · ${byLane(k, cards.filter((c) => c.history)).length} closed`}
              cards={byLane(k, visible)}
              allCards={byLane(k, cards)}
              history={view === "History"}
              active={lane === k}
              incomplete={incomplete}
              loading={firstLoad}
              onOpen={openCard}
            />
          ))}
          <Lane
            laneKey="team"
            owner="flowstate"
            title="With Flowstate & automation"
            subtitle="Requested changes and prepared work. Nothing here starts an automation."
            cards={byLane("team", visible)}
            allCards={byLane("team", cards)}
            history={view === "History"}
            active={lane === "team"}
            incomplete={incomplete}
            loading={firstLoad}
            onOpen={openCard}
            className="lg:col-span-2"
          />
        </div>
      </div>

      {/* Detail drawer */}
      <dialog
        ref={panel}
        aria-labelledby="work-detail-title"
        onCancel={(e) => {
          if (busy) e.preventDefault();
          else close();
        }}
        className="ws-drawer"
        onClick={(e) => {
          if (e.target === panel.current && !busy) close();
        }}
      >
        <div className="ws ws-sheet">
          <div className="ws-sheet-head">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                {result ? (
                  <>
                    <span className="ws-report-icon h-7 w-7">
                      <Icon name={result.kind} size={14} />
                    </span>
                    <span className="text-sm font-semibold text-text-secondary">
                      {resultLabels[result.kind]}
                    </span>
                  </>
                ) : drawerArea ? (
                  <>
                    <span
                      className="ws-area h-7 w-7 rounded-lg"
                      style={{ "--a": areaColour[drawerArea] } as CSSProperties}
                    >
                      <Icon name={drawerArea} size={14} />
                    </span>
                    <span className="text-sm font-semibold text-text-secondary">
                      {areaLabels[drawerArea]}
                    </span>
                    <span
                      className={`ws-chip is-${selectedCard ? cardTone(selectedCard) : "neutral"}`}
                    >
                      {selected
                        ? statusLabels[selected.status]
                        : selectedCard?.state}
                    </span>
                  </>
                ) : null}
              </div>
              <button
                type="button"
                className="ws-btn ws-btn-glass ws-icon-btn -mr-1 -mt-1"
                aria-label="Close work detail"
                disabled={busy}
                onClick={close}
              >
                <Icon name="close" size={16} />
              </button>
            </div>
            <h2 id="work-detail-title" className="ws-sheet-title mt-3">
              {selected?.title || result?.title || selectedCard?.title}
            </h2>
            {drawerOwner && !result && (
              <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-text-muted">
                <Avatar owner={drawerOwner} size="sm" />
                {ownerLabels[drawerOwner]}
                <span aria-hidden="true">·</span>
                <span>
                  {selectedCard
                    ? `${selectedCard.source} · ${fullDate(selectedCard.observed_at)}`
                    : selected?.source}
                </span>
              </p>
            )}
            {result && (
              <p className="mt-2 text-sm text-text-muted">
                Source check {fullDate(result.observed_at)}
              </p>
            )}
          </div>

          <div className="ws-sheet-body">
            {result && <ResultDetail result={result} />}
            {selected && !result && (
              <TaskDetail
                task={selected}
                card={selectedCard}
                busy={busy}
                note={note}
                setNote={setNote}
                mutate={mutate}
              />
            )}
            {!selected && !result && selectedCard && (
              <CardDetail card={selectedCard} />
            )}
            {actionError && drawerOpen && (
              <div role="alert" className="ws-notice is-attn mt-5">
                <Icon name="alert" size={17} className="mt-0.5 flex-none" />
                <span>{actionError}</span>
              </div>
            )}
          </div>

          <div className="ws-sheet-foot">
            {selected && !result ? (
              needsApproval(selected) ? (
                <>
                  <button
                    type="button"
                    className="ws-btn ws-btn-primary flex-1"
                    disabled={busy}
                    onClick={async () => {
                      if (
                        await mutate(`/api/admin/work/${selected.id}`, "POST", {
                          decision: "approved",
                          note,
                        })
                      ) {
                        close();
                        toast("Approved. Decision saved, nothing was sent.");
                      }
                    }}
                  >
                    <Icon name="check" size={16} stroke={2.4} />
                    Approve
                  </button>
                  <button
                    type="button"
                    className="ws-btn ws-btn-glass flex-1"
                    disabled={busy || !note.trim()}
                    title={
                      !note.trim()
                        ? "Add a note saying what should change"
                        : undefined
                    }
                    onClick={async () => {
                      if (
                        await mutate(`/api/admin/work/${selected.id}`, "POST", {
                          decision: "rejected",
                          note,
                        })
                      ) {
                        close();
                        toast("Changes requested.", "info");
                      }
                    }}
                  >
                    Request changes
                  </button>
                </>
              ) : !isClosed(selected) ? (
                <button
                  type="button"
                  className="ws-btn ws-btn-primary flex-1"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      await mutate(`/api/admin/work/${selected.id}`, "PATCH", {
                        status: "done",
                        decision_note: note,
                      })
                    ) {
                      close();
                      toast("Marked as done.");
                    }
                  }}
                >
                  <Icon name="check" size={16} stroke={2.4} />
                  Mark done
                </button>
              ) : (
                <button
                  type="button"
                  className="ws-btn ws-btn-glass flex-1"
                  onClick={close}
                >
                  This task is closed · Close
                </button>
              )
            ) : selectedCard && !result ? (
              <Link
                className="ws-btn ws-btn-primary flex-1"
                href={selectedCard.url}
              >
                {linkLabel(selectedCard)}
                <Icon name="arrow" size={15} />
              </Link>
            ) : (
              <button
                type="button"
                className="ws-btn ws-btn-glass flex-1"
                onClick={close}
              >
                Done reading
              </button>
            )}
          </div>
        </div>
      </dialog>

      {/* New task */}
      <dialog
        ref={composer}
        aria-labelledby="new-task-title"
        className="ws-modal"
        onCancel={(e) => {
          if (busy) e.preventDefault();
          else closeComposer();
        }}
        onClick={(e) => {
          if (e.target === composer.current && !busy) closeComposer();
        }}
      >
        <form
          className="ws ws-modal-card"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await mutate("/api/admin/work", "POST", {
                title,
                kind: "task",
                area: newArea,
                source: "human",
                assignee: owner,
              })
            ) {
              setTitle("");
              closeComposer();
              toast(`Task added for ${ownerLabels[owner]}.`);
            }
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="new-task-title" className="ws-sheet-title">
                New task
              </h2>
              <p className="ws-caption mt-1">
                Adds to the team’s list. Nothing is sent.
              </p>
            </div>
            <button
              type="button"
              className="ws-btn ws-btn-glass ws-icon-btn -mr-1 -mt-1"
              aria-label="Close new task"
              disabled={busy}
              onClick={closeComposer}
            >
              <Icon name="close" size={16} />
            </button>
          </div>
          <label className="mt-5 block">
            <span className="ws-field-label">What needs doing?</span>
            <input
              className="ws-input"
              aria-label="Task title"
              placeholder="e.g. Chase the October invoice"
              required
              maxLength={300}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <fieldset className="mt-5">
            <legend className="ws-field-label">Who’s looking after it?</legend>
            <div
              className="grid grid-cols-2 gap-2"
              role="radiogroup"
              aria-label="Task owner"
            >
              {assignees.map((a) => (
                <button
                  key={a}
                  type="button"
                  role="radio"
                  aria-checked={owner === a}
                  className="ws-owner-pick ws-focus"
                  style={{ "--c": ownerColour[a] } as CSSProperties}
                  onClick={() => setOwner(a)}
                >
                  <Avatar owner={a} size="md" />
                  {ownerLabels[a]}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="mt-5 block">
            <span className="ws-field-label">Area</span>
            <select
              className="ws-input"
              value={newArea}
              onChange={(e) => setNewArea(e.target.value as OpsTask["area"])}
            >
              {areas.map((a) => (
                <option key={a} value={a}>
                  {areaLabels[a]}
                </option>
              ))}
            </select>
          </label>
          {actionError && composing && (
            <div role="alert" className="ws-notice is-attn mt-4">
              <Icon name="alert" size={17} className="mt-0.5 flex-none" />
              <span>{actionError}</span>
            </div>
          )}
          <div className="mt-6 flex gap-2">
            <button
              type="button"
              className="ws-btn ws-btn-glass flex-1"
              disabled={busy}
              onClick={closeComposer}
            >
              Cancel
            </button>
            <button
              className="ws-btn ws-btn-primary flex-1"
              disabled={busy || !title.trim()}
            >
              <Icon name="plus" size={16} stroke={2.4} />
              Add task
            </button>
          </div>
        </form>
      </dialog>

      {/* Source health */}
      <dialog
        ref={health}
        aria-labelledby="health-title"
        className="ws-modal"
        onClick={(e) => {
          if (e.target === health.current) health.current?.close();
        }}
      >
        <div className="ws ws-modal-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="health-title" className="ws-sheet-title">
                What has been checked
              </h2>
              <p className="ws-caption mt-1">
                {data
                  ? `Workspace checked ${fullDate(data.checked_at)}`
                  : "Not checked yet"}
              </p>
            </div>
            <button
              type="button"
              className="ws-btn ws-btn-glass ws-icon-btn -mr-1 -mt-1"
              aria-label="Close source checks"
              onClick={() => health.current?.close()}
            >
              <Icon name="close" size={16} />
            </button>
          </div>
          <ul className="mt-5 space-y-1">
            {data?.checks.map((c) => (
              <li
                key={c.key}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 odd:bg-white/[0.025]"
              >
                <span
                  className="ws-dot"
                  style={{ color: c.ok ? "var(--ws-ok)" : "var(--ws-attn)" }}
                />
                <span className="min-w-0 flex-1 text-sm font-medium">
                  {c.label}
                </span>
                <span
                  className={`text-right text-xs ${c.ok ? "text-text-muted" : "text-[color:var(--ws-attn)]"}`}
                >
                  {c.ok ? `${c.count} records` : "Couldn’t check"}
                  <span className="block opacity-75">{when(c.checked_at)}</span>
                </span>
              </li>
            ))}
            {!data && (
              <li className="ws-caption">No checks have completed yet.</li>
            )}
          </ul>
          <p className="ws-caption mt-5 leading-relaxed">
            Client flags are recalculated from recorded messages, replies and
            activity when this page refreshes. The scheduled Codex jobs remain
            paused by setup instruction; this page cannot verify their live
            scheduler state or resume them. Live payment accounts are checked
            separately.
          </p>
        </div>
      </dialog>
    </div>
  );
}

function LinkList({ links }: { links: { label: string; url: string }[] }) {
  if (!links.length) return null;
  return (
    <div className="mt-6">
      <span className="ws-field-label">Linked</span>
      <div className="space-y-2">
        {links.map((l, i) => (
          <a
            key={i}
            className="ws-link ws-focus"
            href={l.url}
            target="_blank"
            rel="noreferrer"
          >
            <span className="min-w-0 flex-1">{l.label}</span>
            <Icon name="external" size={16} />
          </a>
        ))}
      </div>
    </div>
  );
}

function ResultDetail({ result }: { result: WorkspaceResult }) {
  const meta = outcomeMeta[result.outcome];
  return (
    <>
      <div
        className={`ws-notice ${result.outcome === "complete" ? "is-info" : "is-attn"}`}
      >
        <span className="ws-dot mt-1.5" style={{ color: meta.colour }} />
        <span>
          <strong className="text-text-primary">{meta.label}.</strong>{" "}
          {result.outcome === "complete"
            ? "The declared check completed."
            : result.outcome === "partial"
              ? "This is a partial check. Missing sources still need attention."
              : "This check failed. Do not rely on an older result as current."}
          <span className="mt-1.5 block">
            <strong className="text-text-primary">Coverage:</strong>{" "}
            {result.coverage}
          </span>
        </span>
      </div>
      <p className="ws-prose mt-6">{result.body}</p>
      <LinkList links={result.links} />
      <p className="ws-caption mt-6">
        Received by the portal {fullDate(result.received_at)}. Reading this
        result sends nothing.
      </p>
    </>
  );
}

function CardDetail({ card }: { card: WorkspaceCard }) {
  return (
    <>
      {card.next && (
        <div className="ws-block">
          <span className="ws-field-label">Next step</span>
          <p className="text-[0.95rem] font-medium leading-relaxed">
            {card.next}
          </p>
        </div>
      )}
      <p className="ws-prose mt-6">{card.detail}</p>
    </>
  );
}

function TaskDetail({
  task,
  card,
  busy,
  note,
  setNote,
  mutate,
}: {
  task: OpsTask;
  card?: WorkspaceCard;
  busy: boolean;
  note: string;
  setNote: (s: string) => void;
  mutate: (path: string, method: string, body: unknown) => Promise<boolean>;
}) {
  const deciding = needsApproval(task);
  return (
    <>
      {card?.next && (
        <div className="ws-block">
          <span className="ws-field-label">Next step</span>
          <p className="text-[0.95rem] font-medium leading-relaxed">
            {card.next}
          </p>
        </div>
      )}
      <p className="ws-prose mt-6">
        {task.detail || "No additional instructions."}
      </p>
      {task.kind === "approval" && (
        <div className="ws-notice is-info mt-5">
          <Icon name="lock" size={16} className="mt-0.5 flex-none" />
          <span>
            Approval records your decision. It does not send or publish
            anything.
          </span>
        </div>
      )}
      <LinkList links={[...task.links, ...task.outputs]} />

      <fieldset className="mt-7">
        <legend className="ws-field-label">Assigned to</legend>
        <div
          className="grid grid-cols-2 gap-2"
          role="radiogroup"
          aria-label="Assign to"
        >
          {assignees.map((a) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={task.assignee === a}
              disabled={busy}
              className="ws-owner-pick ws-focus"
              style={{ "--c": ownerColour[a] } as CSSProperties}
              onClick={() => {
                if (task.assignee !== a)
                  void mutate(`/api/admin/work/${task.id}`, "PATCH", {
                    assignee: a,
                  });
              }}
            >
              <Avatar owner={a} size="md" />
              {ownerLabels[a]}
              {task.assignee === a && (
                <Icon name="check" size={15} stroke={2.4} className="ml-auto" />
              )}
            </button>
          ))}
        </div>
      </fieldset>

      {!isClosed(task) && (
        <label className="mt-6 block">
          <span className="ws-field-label">
            {deciding ? "Decision note" : "Note"}
            {deciding && (
              <span className="ml-1 font-medium opacity-80">
                · required to request changes
              </span>
            )}
          </span>
          <textarea
            className="ws-input"
            value={note}
            placeholder={
              deciding
                ? "Optional to approve. Say what should change if not."
                : "Optional. Saved when you mark it done."
            }
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
      )}
      {task.decision_note && (
        <div className="ws-block mt-4">
          <span className="ws-field-label">Previous note</span>
          <p className="ws-prose">{task.decision_note}</p>
        </div>
      )}
      <p className="ws-caption mt-6 flex items-center gap-1.5">
        <Icon name="clock" size={13} />
        {statusLabels[task.status]}
        {task.decided_at ? ` · decided ${fullDate(task.decided_at)}` : ""}
      </p>
    </>
  );
}
