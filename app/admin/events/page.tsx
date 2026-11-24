"use client";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { OpsTask } from "@/lib/ops/types";
import "./events.css";

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
}: {
  task: OpsTask;
  save: Save;
  busy: boolean;
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
  return (
    <article className="event-task" id={"step-"+task.id}>
      <strong>{task.title}</strong>
      <p className="ws-caption">
        {task.assignee === "marc" ? "Marc" : "Eimear"}
        {task.due_at ? " · Due " + dateLabel(task.due_at) : ""}
      </p>
      {typeof task.payload.event_note === "string" &&
        task.payload.event_note && <p>{task.payload.event_note}</p>}
      <button
        type="button"
        className="ws-link"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? "Close editor" : "Edit task"}
      </button>
      {open && (
        <form onSubmit={submit}>
          <label>
            Stage
            <select name="stage" defaultValue={task.status}>
              {Object.entries(stages).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Owner
            <select name="owner" defaultValue={task.assignee}>
              <option value="eimear">Eimear</option>
              <option value="marc">Marc</option>
            </select>
          </label>
          <label>
            Due date
            <input
              type="date"
              name="due"
              defaultValue={task.due_at?.slice(0, 10)}
            />
          </label>
          <label>
            Note or question
            <textarea
              name="note"
              maxLength={2500}
              defaultValue={String(task.payload.event_note || "")}
            />
          </label>
          <button className="ws-btn ws-btn-primary" disabled={busy}>
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
  return (
    <main className="ws ws-page cbb-events">
      <Link href="/admin/work" className="ws-link">
        Back to Workspace
      </Link>
      <header>
        <h1 className="ws-title">Event planner</h1>
        <button
          className="ws-btn ws-btn-primary"
          onClick={() => setCreating(!creating)}
        >
          {creating ? "Close form" : "New event"}
        </button>
      </header>
      {error && (
        <div className="ws-note is-attn" role="alert">
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
        </div>
      )}
      {creating && (
        <form className="event-create ws-panel" onSubmit={create}>
          <label>
            Event name
            <input name="name" maxLength={180} required />
          </label>
          <label>
            Event date
            <input name="date" type="date" required />
          </label>
          <label>
            Venue
            <input name="venue" maxLength={300} />
          </label>
          <label>
            Times and agenda
            <textarea name="agenda" maxLength={2500} />
          </label>
          <button className="ws-btn ws-btn-primary" disabled={busy}>
            Create preparation board
          </button>
        </form>
      )}
      {loading && <p role="status">Loading events…</p>}
      {!loading && !error && !boards.length && (
        <p>Create a board when the event date is confirmed.</p>
      )}
      {board && (
        <>
          <label className="event-picker">
            Choose event
            <select
              value={board.id}
              onChange={(e) => setSelected(e.target.value)}
            >
              {boards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} · {dateLabel(b.event_date)}
                </option>
              ))}
            </select>
          </label>
          <h2 className="ws-h2">{board.name}</h2>
          <p>
            {dateLabel(board.event_date)}
            {board.venue && " · " + board.venue}
          </p>
          {board.agenda && <p>{board.agenda}</p>}
          <form key={board.id} className="event-add" onSubmit={addStep}>
            <label>
              New task
              <input name="title" maxLength={200} required />
            </label>
            <button disabled={busy} className="ws-btn ws-btn-quiet">
              Add task
            </button>
          </form>
          <div className="event-grid">
            {Object.entries(stages).map(([stage, label]) => {
              const column = tasks.filter(
                (t) =>
                  t.payload.event_board_id === board.id && t.status === stage,
              );
              return (
                <section className="event-column" key={stage}>
                  <h2 className="ws-h2">
                    {label} <small>{column.length}</small>
                  </h2>
                  {column.map((task) => (
                    <Task
                      key={task.id + task.updated_at}
                      task={task}
                      save={save}
                      busy={busy}
                    />
                  ))}
                </section>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
