"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  areaLabels,
  ownerLabels,
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

const views = [
  "All current",
  "Needs attention",
  "Needs approval",
  "History",
] as const;
type View = (typeof views)[number];
function date(value: string | null) {
  return value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/London",
      })
    : "Not recorded";
}
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
export default function WorkPage() {
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [view, setView] = useState<View>("All current"),
    [filter, setFilter] = useState("all"),
    [search, setSearch] = useState("");
  const [taskId, setTaskId] = useState<string | null>(null),
    [result, setResult] = useState<WorkspaceResult | null>(null);
  const [busy, setBusy] = useState(false),
    [note, setNote] = useState(""),
    [actionError, setActionError] = useState("");
  const [title, setTitle] = useState(""),
    [owner, setOwner] = useState("eimear");
  const panel = useRef<HTMLDialogElement>(null),
    initial = useRef(true),
    refreshQueue = useRef<ReturnType<typeof createRefreshQueue> | null>(null);
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
  useEffect(() => {
    if ((selected || result) && !panel.current?.open)
      panel.current?.showModal();
    if (!selected && !result) panel.current?.close();
  }, [selected, result]);
  function close() {
    setTaskId(null);
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
  const cards = data?.cards || [];
  const failed = data?.checks.filter((c) => !c.ok) || [];
  const visible = cards.filter(
    (c) =>
      inView(c, view) &&
      (filter === "all" ||
        c.area === filter ||
        c.areas?.some((a) => a === filter)) &&
      `${c.title} ${c.detail}`.toLowerCase().includes(search.toLowerCase()),
  );
  const outboundOff = data && !Object.values(data.controls).some(Boolean);
  const latest = resultKinds.map((kind) =>
    data?.results.find((r) => r.kind === kind),
  );
  return (
    <div className="mx-auto max-w-7xl pb-20 lg:pb-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="v2-eyebrow">Your working day</div>
          <h1 className="v2-page-title mt-2">Business workspace</h1>
          <p className="mt-2 max-w-2xl text-text-secondary">
            What needs attention, who’s looking after it, and what Codex has
            prepared.
          </p>
        </div>
        <button
          className="v2-button-secondary"
          disabled={loading || busy}
          onClick={() => void load()}
        >
          {loading ? "Checking…" : "Refresh checks"}
        </button>
      </div>
      {data?.mode === "preview" && (
        <div className="mt-5 rounded-xl border border-accent/20 bg-accent/5 p-4 text-sm">
          <strong>Preview workspace</strong>
          <span className="ml-2">
            Client examples are test records. The carousel and imported Codex
            drafts are for review.
          </span>
        </div>
      )}
      <div className="my-5 grid gap-3 sm:grid-cols-3">
        <div className="v2-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Needs a decision
          </p>
          <p className="mt-2 text-2xl font-bold">
            {data ? cards.filter((c) => !c.history && c.approval).length : "—"}
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            Prepared work waiting for review
          </p>
        </div>
        <div className="v2-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Sending & publication
          </p>
          <p className="mt-2 font-semibold">
            {!data
              ? "Checking settings…"
              : outboundOff
                ? "Off in this workspace"
                : "Some actions are enabled"}
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            {outboundOff
              ? "Approving work saves a decision. It sends nothing."
              : "Check the action’s availability before proceeding."}
          </p>
        </div>
        <div className="v2-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Latest portal check
          </p>
          <p className="mt-2 font-semibold">
            {data ? date(data.checked_at) : "Not checked yet"}
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            {failed.length
              ? `${failed.length} source${failed.length === 1 ? " needs" : "s need"} checking below.`
              : "Saved portal records only; live payment accounts are checked separately."}
          </p>
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-xl bg-amber-500/10 p-4 text-amber-700"
        >
          {error}
          {data
            ? ` Showing the last result from ${date(data.checked_at)}; it may be out of date.`
            : " No complete workspace result is available."}
        </p>
      )}
      {!!failed.length && (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"
        >
          <strong>Some checks couldn’t finish</strong>
          <p className="mt-1 text-sm">
            {failed.map((c) => c.label).join(", ")}. Items from these sources
            may be missing. An empty list does not mean everything is clear.
          </p>
        </div>
      )}
      <section className="mb-7" aria-labelledby="codex-results-title">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="codex-results-title"
            className="font-heading text-xl font-bold"
          >
            Latest from Codex
          </h2>
          <span className="text-xs text-text-muted">
            Saved results · each shows its own coverage and date
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {resultKinds.map((kind, index) => {
            const r = latest[index];
            return r ? (
              <button
                key={kind}
                onClick={() => {
                  setResult(r);
                  setTaskId(null);
                }}
                className="v2-surface min-w-0 p-4 text-left hover:border-accent/40 focus-visible:outline-2 focus-visible:outline-accent"
              >
                <span className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <strong className="text-text-muted">
                    {resultLabels[kind]}
                  </strong>
                  <span
                    className={
                      r.outcome === "complete"
                        ? "text-text-secondary"
                        : "text-amber-700"
                    }
                  >
                    {r.outcome === "complete"
                      ? "Check complete"
                      : r.outcome === "partial"
                        ? "Some sources missing"
                        : "Check failed"}
                  </span>
                </span>
                <strong className="mt-2 block break-words text-sm">
                  {r.title}
                </strong>
                <p className="mt-2 line-clamp-2 text-sm text-text-secondary">
                  {r.summary}
                </p>
                <span className="mt-3 block text-xs text-text-muted">
                  Source check: {date(r.observed_at)} · Read result →
                </span>
              </button>
            ) : (
              <div className="v2-surface min-w-0 p-4" key={kind}>
                <strong className="text-xs text-text-muted">
                  {resultLabels[kind]}
                </strong>
                <p className="mt-2 text-sm">
                  {failed.some((c) => c.key === "results")
                    ? "Couldn’t check saved results"
                    : loading && !data
                      ? "Checking saved results…"
                      : "No result received yet"}
                </p>
                <p className="mt-2 text-xs text-text-muted">
                  No successful check is assumed.
                </p>
              </div>
            );
          })}
        </div>
      </section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-xl font-bold">The team’s work</h2>
        <Link
          className="min-h-11 inline-flex items-center text-sm font-semibold text-accent-bright underline"
          href="/admin/automation"
        >
          Open content, lessons & payments →
        </Link>
      </div>
      <div
        className="mb-4 flex flex-wrap gap-2"
        role="group"
        aria-label="Work filters"
      >
        {views.map((v) => (
          <button
            key={v}
            aria-pressed={view === v}
            onClick={() => setView(v)}
            className={`min-h-11 rounded-xl px-4 py-2 text-sm font-semibold ${view === v ? "bg-accent text-white" : "v2-surface text-text-secondary"}`}
          >
            {v} ({cards.filter((c) => inView(c, v)).length})
          </button>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          className="ops-input min-w-0 flex-1"
          aria-label="Find client or work"
          placeholder="Find a client or piece of work"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Filter by area"
          className="ops-input max-w-full"
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
      {!data && loading ? (
        <p role="status" className="py-10 text-text-secondary">
          Checking the workspace…
        </p>
      ) : (
        <>
          <div className="grid items-start gap-5 lg:grid-cols-2">
            {(["marc", "eimear"] as const).map((owner) => (
              <section
                className="v2-surface min-w-0 overflow-hidden"
                key={owner}
                aria-labelledby={`tasks-${owner}`}
              >
                <div className="flex items-center justify-between gap-3 border-b border-current/10 p-5">
                  <h3
                    id={`tasks-${owner}`}
                    className="font-heading text-xl font-bold"
                  >
                    {ownerLabels[owner]}’s Tasks
                  </h3>
                  <span className="text-sm text-text-muted">
                    {visible.filter((c) => c.owner === owner).length}
                  </span>
                </div>
                <Cards
                  cards={visible.filter((c) => c.owner === owner)}
                  onTask={(id) => {
                    setTaskId(id);
                    setNote("");
                    setActionError("");
                  }}
                  incomplete={!!failed.length || !!error}
                />
              </section>
            ))}
          </div>
          <section
            className="v2-surface mt-5 overflow-hidden"
            aria-labelledby="support-title"
          >
            <div className="border-b border-current/10 p-5">
              <h3 id="support-title" className="font-heading font-bold">
                With Flowstate & automation
              </h3>
              <p className="mt-1 text-sm text-text-secondary">
                Changes requested and work assigned for preparation. This list
                does not start an automation.
              </p>
            </div>
            <Cards
              cards={visible.filter((c) =>
                ["flowstate", "system"].includes(c.owner),
              )}
              onTask={(id) => {
                setTaskId(id);
                setNote("");
                setActionError("");
              }}
              incomplete={!!failed.length || !!error}
            />
          </section>
        </>
      )}
      <details className="v2-surface mt-6 p-5">
        <summary className="cursor-pointer font-semibold">
          Add a task for the team
        </summary>
        <form
          className="mt-4 flex flex-wrap gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await mutate("/api/admin/work", "POST", {
                title,
                kind: "task",
                area: "other",
                source: "human",
                assignee: owner,
              })
            )
              setTitle("");
          }}
        >
          <input
            className="ops-input min-w-0 flex-1"
            aria-label="Task title"
            placeholder="What needs doing?"
            required
            maxLength={300}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <select
            className="ops-input"
            aria-label="Task owner"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
          >
            {assignees.map((a) => (
              <option value={a} key={a}>
                {ownerLabels[a]}
              </option>
            ))}
          </select>
          <button className="v2-button-primary" disabled={busy}>
            Add task
          </button>
        </form>
        {actionError && !selected && (
          <p role="alert" className="mt-3 text-amber-700">
            {actionError}
          </p>
        )}
      </details>
      <details className="v2-surface mt-4 p-5">
        <summary className="cursor-pointer font-semibold">
          What has actually been checked?
        </summary>
        <p className="my-3 text-sm text-text-secondary">
          Client flags are recalculated from recorded messages, replies and
          activity when this page refreshes. The scheduled Codex jobs remain
          paused by setup instruction; this page cannot verify their live
          scheduler state or resume them.
        </p>
        <ul className="space-y-2 text-sm">
          {data?.checks.map((c) => (
            <li key={c.key} className="flex flex-wrap justify-between gap-2">
              <span>{c.label}</span>
              <span className={c.ok ? "text-text-muted" : "text-amber-700"}>
                {c.ok ? `${c.count} records checked` : "Couldn’t check"} ·{" "}
                {date(c.checked_at)}
              </span>
            </li>
          ))}
        </ul>
      </details>
      <dialog
        ref={panel}
        aria-labelledby="work-detail-title"
        onCancel={close}
        className="ops-dialog"
        onClick={(e) => {
          if (e.target === panel.current && !busy) close();
        }}
      >
        <div className="p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <h2
              id="work-detail-title"
              className="break-words font-heading text-xl font-bold"
            >
              {selected?.title || result?.title}
            </h2>
            <button
              className="min-h-11 min-w-11"
              aria-label="Close work detail"
              disabled={busy}
              onClick={close}
            >
              ✕
            </button>
          </div>
          {result && (
            <>
              <p className="mt-3 text-sm text-text-muted">
                {resultLabels[result.kind]} · {date(result.observed_at)}
              </p>
              <p className="my-4 rounded-xl bg-accent/5 p-4 text-sm">
                <strong>Coverage: </strong>
                {result.coverage}
                <br />
                <span className="mt-2 block">
                  {result.outcome === "complete"
                    ? "The declared check completed."
                    : result.outcome === "partial"
                      ? "This is a partial check. Missing sources still need attention."
                      : "This check failed. Do not rely on an older result as current."}
                </span>
              </p>
              <p className="whitespace-pre-wrap break-words text-sm leading-7">
                {result.body}
              </p>
              <div className="mt-5 space-y-3">
                {result.links.map((l, i) => (
                  <a
                    key={i}
                    className="block break-words text-sm text-accent-bright underline"
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {l.label} ↗
                  </a>
                ))}
              </div>
              <p className="mt-5 text-xs text-text-muted">
                Received by the portal {date(result.received_at)}. Reading this
                result sends nothing.
              </p>
            </>
          )}
          {selected && (
            <TaskDetail
              task={selected}
              busy={busy}
              note={note}
              setNote={setNote}
              mutate={mutate}
            />
          )}
          {actionError && (
            <p role="alert" className="mt-4 text-amber-700">
              {actionError}
            </p>
          )}
        </div>
      </dialog>
      <style jsx global>{`
        .ops-input {
          border: 1px solid var(--border-color, #8a8a9838);
          border-radius: 10px;
          padding: 10px 12px;
          min-height: 44px;
          background: var(--color-bg-secondary);
          color: var(--color-text-primary);
        }
        .ops-dialog {
          margin: 0 0 0 auto;
          height: 100dvh;
          max-height: 100dvh;
          width: min(640px, 100%);
          max-width: 100%;
          border: 0;
          border-left: 1px solid #8883;
          background: var(--color-bg-primary, #fff);
          color: var(--color-text-primary);
          overflow: auto;
        }
        .ops-dialog::backdrop {
          background: #0006;
        }
        .ops-input:disabled {
          opacity: 0.5;
        }
      `}</style>
    </div>
  );
}
function Cards({
  cards,
  onTask,
  incomplete,
}: {
  cards: WorkspaceCard[];
  onTask: (id: string) => void;
  incomplete: boolean;
}) {
  const [limit, setLimit] = useState(8);
  if (!cards.length)
    return (
      <p className="p-5 text-sm text-text-muted">
        {incomplete
          ? "Nothing shown in this view. Some sources have not been checked successfully."
          : "No work in this view. Choose another filter to see the other items."}
      </p>
    );
  return (
    <div className="divide-y divide-current/10">
      {cards.slice(0, limit).map((c) => (
        <article key={c.id} className="p-5">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-lg bg-accent/10 px-2 py-1 text-accent-bright">
              {areaLabels[c.area]}
            </span>
            <span className="py-1 text-text-secondary">{c.state}</span>
          </div>
          <h4 className="mt-3 break-words font-semibold">{c.title}</h4>
          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-text-secondary">
            {c.detail}
          </p>
          <p className="mt-3 text-sm leading-6">
            <strong>Next: </strong>
            {c.next}
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-text-muted">
              {c.source} · {date(c.observed_at)}
            </span>
            {c.task_id ? (
              <button
                className="min-h-11 text-sm font-semibold text-accent-bright underline"
                onClick={() => onTask(c.task_id!)}
              >
                Open task →
              </button>
            ) : (
              <Link
                className="inline-flex min-h-11 items-center text-sm font-semibold text-accent-bright underline"
                href={c.url}
              >
                {c.id.startsWith("artifact:")
                  ? "Review work"
                  : c.id.startsWith("payment:")
                    ? "Check payment"
                    : c.id.startsWith("report:")
                      ? "Read report"
                      : "Open client"}{" "}
                →
              </Link>
            )}
          </div>
        </article>
      ))}
      {cards.length > limit && (
        <button
          className="min-h-12 w-full p-4 text-sm font-semibold text-accent-bright"
          onClick={() => setLimit((n) => n + 8)}
        >
          Show more ({cards.length - limit} remaining)
        </button>
      )}
    </div>
  );
}
function TaskDetail({
  task,
  busy,
  note,
  setNote,
  mutate,
}: {
  task: OpsTask;
  busy: boolean;
  note: string;
  setNote: (s: string) => void;
  mutate: (path: string, method: string, body: unknown) => Promise<boolean>;
}) {
  return (
    <>
      <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7">
        {task.detail || "No additional instructions."}
      </p>
      {task.kind === "approval" && (
        <p className="my-4 rounded-xl bg-accent/5 p-3 text-sm">
          Approval records your decision. It does not send or publish anything.
        </p>
      )}
      {[...task.links, ...task.outputs].map((l, i) => (
        <a
          className="my-3 block break-words text-sm text-accent-bright underline"
          href={l.url}
          key={i}
          target="_blank"
          rel="noreferrer"
        >
          {l.label} ↗
        </a>
      ))}
      <label className="mt-5 block text-sm">
        Assign to
        <select
          className="ops-input mt-2 block w-full"
          value={task.assignee}
          disabled={busy}
          onChange={(e) =>
            void mutate(`/api/admin/work/${task.id}`, "PATCH", {
              assignee: e.target.value,
            })
          }
        >
          {assignees.map((a) => (
            <option key={a} value={a}>
              {ownerLabels[a]}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-4 block text-sm">
        Decision note
        <textarea
          className="ops-input mt-2 block w-full"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      {task.decision_note && (
        <p className="my-3 whitespace-pre-wrap text-sm">
          Previous note: {task.decision_note}
        </p>
      )}
      <div className="mt-5 flex flex-wrap gap-3">
        {needsApproval(task) ? (
          <>
            <button
              className="v2-button-primary"
              disabled={busy}
              onClick={() =>
                void mutate(`/api/admin/work/${task.id}`, "POST", {
                  decision: "approved",
                  note,
                })
              }
            >
              Approve
            </button>
            <button
              className="v2-button-secondary"
              disabled={busy || !note.trim()}
              onClick={() =>
                void mutate(`/api/admin/work/${task.id}`, "POST", {
                  decision: "rejected",
                  note,
                })
              }
            >
              Request changes
            </button>
          </>
        ) : (
          !isClosed(task) && (
            <button
              className="v2-button-secondary"
              disabled={busy}
              onClick={() =>
                void mutate(`/api/admin/work/${task.id}`, "PATCH", {
                  status: "done",
                  decision_note: note,
                })
              }
            >
              Mark done
            </button>
          )
        )}
      </div>
    </>
  );
}
