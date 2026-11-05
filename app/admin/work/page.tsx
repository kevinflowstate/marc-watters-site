"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { areas, assignees, type OpsTask } from "@/lib/ops/types";
import {
  areaLabels,
  ownerLabels,
  statusLabels,
  isClosed,
  needsApproval,
  workViews,
} from "@/lib/ops/workspace";
export default function WorkPage() {
  const [tasks, setTasks] = useState<OpsTask[]>([]),
    [tab, setTab] = useState<keyof ReturnType<typeof workViews>>("All current"),
    [loading, setLoading] = useState(true),
    [assignee, setAssignee] = useState("eimear"),
    [selected, setSelected] = useState<OpsTask | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [note, setNote] = useState(""),
    [title, setTitle] = useState(""),
    [area, setArea] = useState("other"),
    [kind, setKind] = useState("task");
  const panel = useRef<HTMLDialogElement>(null);
  const openedLink = useRef(false);
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/work"),
        d = await r.json();
      if (!r.ok) throw Error(d.error);
      setTasks(d.tasks);
      setError("");
      if (!openedLink.current) {
        openedLink.current = true;
        const id = new URLSearchParams(window.location.search).get("task");
        if (id) setSelected(d.tasks.find((x: OpsTask) => x.id === id) ?? null);
      } else
        setSelected((t) =>
          t ? (d.tasks.find((x: OpsTask) => x.id === t.id) ?? null) : null,
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load your tasks");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => {
    if (selected && !panel.current?.open) panel.current?.showModal();
    if (!selected) panel.current?.close();
  }, [selected]);
  const groups = workViews(tasks);
  async function action(path: string, method: string, body: unknown) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(path, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
        d = await r.json();
      if (!r.ok) throw Error(d.error);
      await load();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="max-w-6xl mx-auto">
      <div className="v2-eyebrow">Operations</div>
      <h1 className="v2-page-title mt-2">Your workspace</h1>
      <p className="text-text-secondary mt-2 mb-6">
        See what needs your attention, review prepared work and track what
        happens next.
      </p>
      <Link
        href="/admin/automation"
        className="mb-6 inline-flex min-h-11 items-center text-sm font-semibold text-accent-bright underline"
      >
        Review prepared content, lessons & payment results →
      </Link>
      <form
        className="v2-surface p-4 flex flex-wrap gap-3 mb-6"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await action("/api/admin/work", "POST", {
              title,
              kind,
              area,
              source: "human",
              assignee,
            })
          )
            setTitle("");
        }}
      >
        <input
          aria-label="Task title"
          placeholder="What needs doing?"
          required
          maxLength={300}
          className="ops-input flex-1 min-w-40"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <select
          aria-label="Kind"
          className="ops-input"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          {["task", "approval", "flag"].map((x) => (
            <option key={x} value={x}>
              {
                { task: "Task", approval: "Approval", flag: "Needs attention" }[
                  x
                ]
              }
            </option>
          ))}
        </select>
        <select
          aria-label="Area"
          className="ops-input"
          value={area}
          onChange={(e) => setArea(e.target.value)}
        >
          {areas.map((x) => (
            <option key={x} value={x}>
              {areaLabels[x]}
            </option>
          ))}
        </select>
        <select
          aria-label="Task owner"
          className="ops-input"
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
        >
          {assignees.map((a) => (
            <option key={a} value={a}>
              {ownerLabels[a]}
            </option>
          ))}
        </select>
        <button className="ops-button" disabled={busy}>
          Add work
        </button>
      </form>
      {error && (
        <p role="alert" className="text-amber-600 my-3">
          {error}
        </p>
      )}
      <div
        className="flex flex-wrap gap-2 mb-4"
        role="group"
        aria-label="Work filters"
      >
        {Object.entries(groups).map(([name, items]) => (
          <button
            aria-pressed={tab === name}
            className={`rounded-xl px-4 py-3 ${tab === name ? "bg-accent text-white" : "v2-surface text-text-secondary"}`}
            onClick={() => setTab(name as keyof typeof groups)}
            key={name}
          >
            {name} ({items.length})
          </button>
        ))}
      </div>
      {loading ? (
        <p role="status" className="p-6 text-text-secondary">
          Loading your workspace…
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 items-start gap-5">
            {(["marc", "eimear"] as const).map((owner) => (
              <section
                key={owner}
                aria-labelledby={`tasks-${owner}`}
                className="v2-surface min-w-0 overflow-hidden"
              >
                <div className="p-5 border-b border-current/10 flex items-center justify-between gap-3">
                  <h2
                    id={`tasks-${owner}`}
                    className="font-heading font-bold text-xl"
                  >
                    {ownerLabels[owner]}’s Tasks
                  </h2>
                  <span className="text-text-muted text-sm">
                    {groups[tab].filter((t) => t.assignee === owner).length}
                  </span>
                </div>
                <TaskList
                  tasks={groups[tab].filter((t) => t.assignee === owner)}
                  onSelect={(t) => {
                    setSelected(t);
                    setNote("");
                  }}
                />
              </section>
            ))}
          </div>
          <section
            className="v2-surface mt-5 overflow-hidden"
            aria-labelledby="tasks-support"
          >
            <div className="p-5 border-b border-current/10">
              <h2 id="tasks-support" className="font-heading font-bold">
                With Flowstate & automation
              </h2>
              <p className="text-text-muted text-sm mt-1">
                Track work assigned to us or the connected automation. Each item
                shows its actual status.
              </p>
            </div>
            <TaskList
              tasks={groups[tab].filter((t) =>
                ["flowstate", "system"].includes(t.assignee),
              )}
              onSelect={(t) => {
                setSelected(t);
                setNote("");
              }}
            />
          </section>
        </>
      )}
      <dialog
        aria-labelledby="work-detail-title"
        ref={panel}
        onCancel={() => setSelected(null)}
        onClick={(e) => {
          if (e.target === panel.current) setSelected(null);
        }}
        className="ops-dialog"
      >
        {selected && (
          <div className="p-6">
            <div className="flex justify-between gap-4">
              <h2
                id="work-detail-title"
                className="font-heading font-bold text-xl break-words"
              >
                {selected.title}
              </h2>
              <button
                onClick={() => setSelected(null)}
                aria-label="Close work detail"
              >
                ✕
              </button>
            </div>
            <p className="text-text-secondary text-sm my-3">
              {areaLabels[selected.area]} ·{" "}
              {needsApproval(selected)
                ? "Needs approval"
                : statusLabels[selected.status]}
            </p>
            {selected.kind === "approval" && (
              <p className="rounded-xl bg-accent/10 p-3 my-4 text-sm">
                {selected.status === "approved"
                  ? "Approval recorded. The next action is still pending; this is not yet completed."
                  : selected.status === "rejected"
                    ? "Changes requested. The revised version will need a new approval."
                    : selected.status === "done"
                      ? "This item has been marked completed."
                      : selected.status === "cancelled"
                        ? "This item has been cancelled."
                        : "Review the linked version before approving. Approval records your decision; it does not by itself publish, send or schedule anything."}
              </p>
            )}
            <p className="whitespace-pre-wrap break-words my-4">
              {selected.detail || "No additional detail."}
            </p>
            {[...selected.links, ...selected.outputs].map((l, i) => (
              <a
                className="block text-accent-bright underline break-all my-2"
                href={l.url}
                target="_blank"
                rel="noreferrer"
                key={i}
              >
                {l.label}
              </a>
            ))}
            <label className="block mt-5">
              Assign to
              <select
                className="ops-input block w-full mt-2"
                value={selected.assignee}
                disabled={busy}
                onChange={(e) =>
                  void action(`/api/admin/work/${selected.id}`, "PATCH", {
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
            <label className="block mt-4">
              Decision note
              <textarea
                className="ops-input block w-full mt-2"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            {selected.decision_note && (
              <p className="text-text-secondary my-3">
                Previous note: {selected.decision_note}
              </p>
            )}
            <div className="flex flex-wrap gap-3 mt-5">
              {needsApproval(selected) && (
                <>
                  <button
                    className="ops-button"
                    disabled={busy}
                    onClick={() =>
                      void action(`/api/admin/work/${selected.id}`, "POST", {
                        decision: "approved",
                        note,
                      })
                    }
                  >
                    Approve
                  </button>
                  <button
                    className="ops-input"
                    disabled={busy || !note.trim()}
                    onClick={() =>
                      void action(`/api/admin/work/${selected.id}`, "POST", {
                        decision: "rejected",
                        note,
                      })
                    }
                  >
                    Request changes
                  </button>
                </>
              )}
              {!isClosed(selected) && !needsApproval(selected) && (
                <button
                  className="ops-input"
                  disabled={busy}
                  onClick={() =>
                    void action(`/api/admin/work/${selected.id}`, "PATCH", {
                      status: "done",
                      decision_note: note,
                    })
                  }
                >
                  Mark done
                </button>
              )}
            </div>
            {error && (
              <p role="alert" className="text-amber-600 mt-3">
                {error}
              </p>
            )}
          </div>
        )}
      </dialog>
      <style jsx global>{`
        .ops-input {
          border: 1px solid var(--border-color, #8a8a9838);
          border-radius: 10px;
          padding: 10px 12px;
          background: var(--color-bg-secondary);
          color: var(--color-text-primary);
        }
        .ops-button {
          border-radius: 10px;
          background: #2272de;
          color: white;
          padding: 10px 18px;
          font-weight: 600;
        }
        .ops-dialog {
          margin: 0 0 0 auto;
          height: 100dvh;
          max-height: 100dvh;
          width: min(560px, 100%);
          max-width: 100%;
          border: 0;
          border-left: 1px solid #8883;
          background: var(--color-bg-primary, #050507);
          color: var(--color-text-primary);
          overflow: auto;
        }
        .ops-dialog::backdrop {
          background: #0006;
        }
        .ops-input:disabled,
        .ops-button:disabled {
          opacity: 0.5;
        }
      `}</style>
    </div>
  );
}

function TaskList({
  tasks,
  onSelect,
}: {
  tasks: OpsTask[];
  onSelect: (task: OpsTask) => void;
}) {
  if (!tasks.length)
    return (
      <p className="p-6 text-text-muted text-sm">No tasks in this view.</p>
    );
  return (
    <div className="divide-y divide-current/10">
      {tasks.map((t) => (
        <button
          type="button"
          onClick={() => onSelect(t)}
          key={t.id}
          className="w-full text-left p-5 hover:bg-accent/5 focus-visible:outline-2 focus-visible:outline-accent"
        >
          <span className="flex flex-wrap items-center gap-2 text-xs mb-2">
            <span className="rounded-lg px-2 py-1 bg-accent/10 text-accent-bright">
              {areaLabels[t.area]}
            </span>
            <span className="text-text-secondary">
              {needsApproval(t)
                ? "Needs approval"
                : t.kind === "flag" && t.status === "open"
                  ? "Needs attention"
                  : statusLabels[t.status]}
            </span>
          </span>
          <strong className="block break-words">{t.title}</strong>
          <span className="text-text-muted text-sm block mt-2">
            {t.client_profiles?.users?.full_name || ownerLabels[t.assignee]}
            {t.due_at
              ? ` · Due ${new Date(t.due_at).toLocaleDateString("en-GB")}`
              : ""}
          </span>
          {t.links.length > 0 && (
            <span className="text-sm text-accent-bright block mt-2 break-words">
              {t.links.map((l) => l.label).join(" · ")}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
