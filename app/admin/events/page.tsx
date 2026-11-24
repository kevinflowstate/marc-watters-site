"use client";
import Link from "next/link";
import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from "react";
import type { OpsTask } from "@/lib/ops/types";
import { GlassCard, CountUp } from "@/components/ops/charts/Glass";
import { Icon, dueLabel } from "@/components/ops/workspace/WorkspaceUI";

type Board = {
  id: string;
  name: string;
  event_date: string;
  venue: string;
  agenda: string;
};
const stages = {
  open: "To do",
  in_progress: "In progress",
  awaiting_approval: "Questions for Marc",
  done: "Done",
} as const;
const stageColour: Record<keyof typeof stages, string> = {
  open: "var(--ws-team)",
  in_progress: "var(--ws-accent-ink)",
  awaiting_approval: "var(--ws-attn)",
  done: "var(--ws-ok)",
};
const api = "/api/admin/event-boards";
type Save = (
  method: "PATCH" | "POST",
  data: Record<string, unknown>,
) => Promise<boolean>;
const dateLabel = (date: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
function Task({
  task,
  save,
  busy,
  index,
}: {
  task: OpsTask;
  save: Save;
  busy: boolean;
  index: number;
}) {
  const [open, setOpen] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    if (
      await save("PATCH", {
        ...data,
        board: task.payload.event_board_id,
        id: task.id,
        version: task.updated_at,
      })
    )
      setOpen(false);
  }
  const due = task.due_at ? dueLabel(task.due_at) : null;
  const owner = task.assignee === "marc" ? "Marc" : "Eimear";
  return (
    <article className="lg-task" id={"step-" + task.id} style={{ "--i": index } as CSSProperties}>
      <div className="lg-task-t">{task.title}</div>
      <div className="lg-task-m">
        <span className="lg-pill" style={{ "--c": task.assignee === "marc" ? "var(--ws-marc)" : "var(--ws-eimear)" } as CSSProperties}>
          {owner}
        </span>
        {task.due_at && task.status !== "done" && (
          <span
            className="lg-pill"
            title={dateLabel(task.due_at)}
            style={{ "--c": due?.tone === "bad" ? "var(--ws-bad)" : due?.tone === "attn" ? "var(--ws-attn)" : "var(--ws-ink-3)" } as CSSProperties}
          >
            {due?.text === "Overdue" ? "Overdue" : "Due " + (due?.text ?? dateLabel(task.due_at))}
          </span>
        )}
      </div>
      {typeof task.payload.event_note === "string" && task.payload.event_note && (
        <p className="lg-task-n">{task.payload.event_note}</p>
      )}
      <button type="button" className="lg-task-edit ws-focus" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? "Close editor" : "Edit task"}
      </button>
      {open && (
        <form onSubmit={submit}>
          <label className="lg-field">
            Stage
            <select className="ws-input" name="stage" defaultValue={task.status}>
              {Object.entries(stages).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-2.5">
            <label className="lg-field">
              Owner
              <select className="ws-input" name="owner" defaultValue={task.assignee}>
                <option value="eimear">Eimear</option>
                <option value="marc">Marc</option>
              </select>
            </label>
            <label className="lg-field">
              Due date
              <input className="ws-input" type="date" name="due" defaultValue={task.due_at?.slice(0, 10)} />
            </label>
          </div>
          <label className="lg-field">
            Note or question
            <textarea className="ws-input" name="note" rows={3} maxLength={2500} defaultValue={String(task.payload.event_note || "")} />
          </label>
          <button className="ws-btn ws-btn-primary ws-focus" disabled={busy}>
            Save task
          </button>
        </form>
      )}
    </article>
  );
}
export default function Events() {
  const [boards, setBoards] = useState<Board[]>([]),
    [tasks, setTasks] = useState<OpsTask[]>([]);
  const [selected, setSelected] = useState(""),
    [creating, setCreating] = useState(false);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const [requestId, setRequestId] = useState("");
  const load = useCallback(async () => {
    const response = await fetch(api, { cache: "no-store" });
    if (!response.ok) throw Error("Could not load event boards.");
    const data = await response.json();
    setBoards(data.boards);
    setTasks(data.tasks);
    setLoading(false);
  }, []);
  useEffect(() => {
    const boardId = new URLSearchParams(window.location.search).get("board");
    if (boardId) setSelected(boardId);
    load().catch((e) => {
      setError(e.message);
      setLoading(false);
    });
  }, [load]);
  const board = boards.find((b) => b.id === selected) || boards[0];
  useEffect(() => {
    if (!loading && window.location.hash.startsWith("#step-"))
      document.getElementById(window.location.hash.slice(1))?.scrollIntoView({block: "center"});
  }, [loading, board?.id]);
  const save: Save = async (method, data) => {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(api, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!r.ok) throw Error((await r.json()).error || "Could not save.");
      await load();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
      return false;
    } finally {
      setBusy(false);
    }
  };
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const id = requestId || crypto.randomUUID();
    setRequestId(id);
    if (
      await save("POST", {
        action: "create",
        id,
        ...Object.fromEntries(new FormData(e.currentTarget)),
      })
    ) {
      setSelected(id);
      setCreating(false);
      setRequestId("");
    }
  }
  async function addStep(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const id = form.dataset.requestId || crypto.randomUUID();
    form.dataset.requestId = id;
    if (
      await save("POST", {
        action: "add_step",
        id,
        board: board.id,
        title: new FormData(form).get("title"),
      })
    ) {
      form.reset();
      delete form.dataset.requestId;
    }
  }
  const boardTasks = board ? tasks.filter((t) => t.payload.event_board_id === board.id) : [];
  const doneCount = boardTasks.filter((t) => t.status === "done").length;
  const progress = boardTasks.length ? Math.round((100 * doneCount) / boardTasks.length) : 0;
  const daysTo = board
    ? Math.round((Date.parse(board.event_date.slice(0, 10) + "T00:00:00Z") - Date.parse(new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" }) + "T00:00:00Z")) / 86400000)
    : 0;
  return (
    <main className="ws ws-page lg-stage">
      <Link href="/admin/work" className="ws-back ws-focus">
        <Icon name="chevron" size={14} className="ws-back-ic" />
        Workspace
      </Link>
      <header className="lg-hello lg-rise">
        <div>
          <h1>Event planner</h1>
          <p className="ws-meta mt-1.5">Preparation boards for each event. Questions for Marc appear on his Dashboard.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {boards.length > 1 && board && (
            <label className="sr-only" htmlFor="event-picker">
              Choose event
            </label>
          )}
          {boards.length > 1 && board && (
            <select id="event-picker" className="ws-input" style={{ width: "auto", maxWidth: 260 }} value={board.id} onChange={(e) => setSelected(e.target.value)}>
              {boards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} · {dateLabel(b.event_date)}
                </option>
              ))}
            </select>
          )}
          <button className="lg-btn is-primary ws-focus" onClick={() => setCreating(!creating)}>
            <Icon name={creating ? "close" : "plus"} size={14} />
            {creating ? "Close form" : "New event"}
          </button>
        </div>
      </header>
      {error && (
        <div className="ws-note is-attn" role="alert">
          <Icon name="alert" size={15} />
          <span>
            {error}{" "}
            <button
              className="ws-link"
              onClick={() =>
                load()
                  .then(() => setError(""))
                  .catch((e) => setError(e.message))
              }
            >
              Refresh
            </button>
          </span>
        </div>
      )}
      {creating && (
        <GlassCard index={0} title="New event" sub="Starter tasks are added when the board is created">
          <form className="lg-card-body grid gap-3 sm:grid-cols-2" onSubmit={create}>
            <label className="lg-field">
              Event name
              <input className="ws-input" name="name" maxLength={180} required />
            </label>
            <label className="lg-field">
              Event date
              <input className="ws-input" name="date" type="date" required />
            </label>
            <label className="lg-field sm:col-span-2">
              Venue
              <input className="ws-input" name="venue" maxLength={300} />
            </label>
            <label className="lg-field sm:col-span-2">
              Times and agenda
              <textarea className="ws-input" name="agenda" rows={3} maxLength={2500} />
            </label>
            <div className="sm:col-span-2">
              <button className="ws-btn ws-btn-primary ws-focus" disabled={busy}>
                Create preparation board
              </button>
            </div>
          </form>
        </GlassCard>
      )}
      {loading && (
        <div className="lg-board" role="status" aria-label="Loading events">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="lg-card lg-col">
              <div className="lg-skel" style={{ height: 12, width: 90, margin: "6px 6px 14px" }} />
              <div className="lg-skel" style={{ height: 72, borderRadius: 12 }} />
            </div>
          ))}
        </div>
      )}
      {!loading && !error && !boards.length && (
        <div className="lg-card lg-clear">
          <span className="lg-q-ic" style={{ "--c": "var(--ws-attn)" } as CSSProperties} aria-hidden="true">
            <Icon name="events" size={16} />
          </span>
          <span>Create a board when the event date is confirmed.</span>
        </div>
      )}
      {board && (
        <>
          <GlassCard index={1}>
            <div className="lg-hero-event">
              <div className="lg-countdown">
                <b>{daysTo < 0 ? "Done" : <CountUp value={daysTo} />}</b>
                <span>{daysTo < 0 ? "event held" : daysTo === 1 ? "day to go" : daysTo === 0 ? "today" : "days to go"}</span>
              </div>
              <div className="min-w-0" style={{ flex: "2 1 240px" }}>
                <h2>{board.name}</h2>
                <p className="ws-meta mt-1">
                  {dateLabel(board.event_date)}
                  {board.venue && " · " + board.venue}
                </p>
                {board.agenda && <p className="ws-caption mt-2" style={{ whiteSpace: "pre-wrap" }}>{board.agenda}</p>}
              </div>
              <div className="lg-progress">
                <div className="lg-progress-top">
                  <span>{doneCount} of {boardTasks.length} tasks done</span>
                  <span>{progress}%</span>
                </div>
                <div className="lg-funnel-bar">
                  <i key={board.id + progress} style={{ "--w": progress + "%", "--c": "var(--ws-ok)" } as CSSProperties} />
                </div>
              </div>
            </div>
            <form key={board.id} className="flex flex-wrap items-end gap-2 px-5 pb-5" onSubmit={addStep}>
              <label className="lg-field flex-1" style={{ minWidth: 200 }}>
                New task
                <input className="ws-input" name="title" maxLength={200} required placeholder="e.g. Confirm catering numbers" />
              </label>
              <button disabled={busy} className="ws-btn ws-focus">
                <Icon name="plus" size={14} />
                Add task
              </button>
            </form>
          </GlassCard>
          <div className="lg-board">
            {(Object.entries(stages) as [keyof typeof stages, string][]).map(([stage, label], col) => {
              const column = boardTasks.filter((t) => t.status === stage);
              return (
                <section className="lg-card lg-rise lg-col" key={stage} style={{ "--i": 2 + col } as CSSProperties} aria-label={label}>
                  <h2 className="lg-col-head">
                    <span className="ws-dot" style={{ background: stageColour[stage] }} />
                    {label}
                    <em>{column.length}</em>
                  </h2>
                  {column.length ? (
                    column.map((task, i) => <Task key={task.id + task.updated_at} task={task} save={save} busy={busy} index={i} />)
                  ) : (
                    <p className="lg-col-empty">{stage === "awaiting_approval" ? "No open questions" : "Nothing here"}</p>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
