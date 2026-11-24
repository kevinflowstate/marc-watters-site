"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { outcomeLabels, type CallOutcome } from "@/lib/ops/call-outcomes";

type Row = {
  id: string;
  name: string;
  startTime: string;
  status: string;
  outcome: CallOutcome | null;
  revision: string | null;
};
type Period = {
  calls: Row[];
  canEdit: boolean;
  upcoming: Row[];
  stats: {
    won: number;
    qualified_decisions: number;
    close_rate: number | null;
  };
  range: { from: number; to: number };
};
const dateLabel = (time: number | string) =>
  new Date(time).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  });

export default function SalesCallRegister({
  compact = false,
}: {
  compact?: boolean;
}) {
  const [data, setData] = useState<Period | null>(null);
  const [error, setError] = useState("");
  const [before, setBefore] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "follow_up">("all");
  const [target, setTarget] = useState("");
  const focused = useRef("");
  useEffect(() => {
    if (compact) return;
    function locate() {
      const hash = window.location.hash.slice(1);
      if (!hash.startsWith("call-")) return;
      try {
        setTarget(decodeURIComponent(hash));
        focused.current = "";
        setFilter("all");
        setBefore("");
      } catch {
        // Ignore an invalid URL fragment.
      }
    }
    locate();
    window.addEventListener("hashchange", locate);
    return () => window.removeEventListener("hashchange", locate);
  }, [compact]);
  useEffect(() => {
    if (!data || !target || focused.current === target) return;
    const row = document.getElementById(target);
    if (row) {
      row.focus({ preventScroll: true });
      row.scrollIntoView({ block: "center" });
      focused.current = target;
    }
  }, [data, target, filter]);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const res = await fetch(
          "/api/admin/sales-calls" + (before ? "?before=" + before : ""),
          { cache: "no-store", signal },
        );
        if (!res.ok) throw Error("Sales calls could not be loaded.");
        const body = await res.json();
        if (!signal?.aborted) {
          setData(body);
          setError("");
        }
      } catch (err) {
        if (!signal?.aborted)
          setError(
            err instanceof Error ? err.message : "Could not load sales calls.",
          );
      }
    },
    [before],
  );
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const timer = setInterval(() => {
      if (!document.hidden && !before) void load(controller.signal);
    }, 300000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [load, before]);
  async function mark(call: Row, outcome: string) {
    if (!outcome || !data?.canEdit) return;
    setNotice("");
    setBusy(call.id);
    try {
      const res = await fetch("/api/admin/sales-calls", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: call.id,
          startTime: call.startTime,
          revision: call.revision,
          outcome,
        }),
      });
      if (!res.ok)
        throw Error((await res.json()).error || "Could not save outcome.");
      setNotice(`Saved ${outcomeLabels[outcome as CallOutcome]} for ${call.name}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save outcome.");
    } finally {
      setBusy("");
    }
  }
  const pending = data?.calls.filter((call) => !call.outcome && call.status !== "cancelled") ?? [];
  const followUps = data?.calls.filter((call) => call.outcome === "follow_up" && call.status !== "cancelled") ?? [];
  const visible = filter === "pending" ? pending : filter === "follow_up" ? followUps : data?.calls ?? [];
  if (compact) {
    return (
      <p className="ws-note">
        <Link href="/admin/sales-calls" className="ws-focus">
          {pending?.length
            ? `Record sales call outcomes (${pending.length} waiting)`
            : "Open sales call tracker"}
        </Link>
      </p>
    );
  }
  return (
    <main className="ws ws-page">
      <Link href="/admin/work" className="ws-back">
        Workspace
      </Link>
      <h1 className="ws-title">Sales call tracker</h1>
      <p>
        {data && !data.canEdit ? "You can view the recorded outcomes here." : "Choose an outcome next to a completed call to save it."}
        {" "}Conversion rate uses converted calls divided by converted and lost calls.
      </p>
      {notice && <p className="ws-note" role="status">{notice}</p>}
      {error && (
        <p role="alert">
          {error}{" "}
          <button className="ws-btn" onClick={() => void load()}>
            Reload
          </button>
        </p>
      )}
      {data ? (
        <>
          <p className="ws-note">
            {dateLabel(data.range.from)} – {dateLabel(data.range.to - 1)} ·{" "}
            {data.stats.won} converted from {data.stats.qualified_decisions} decided
            calls · Qualified close rate{" "}
            {data.stats.close_rate === null
              ? "pending"
              : data.stats.close_rate + "%"}
          </p>
          {!before && (
            <section className="ws-panel p-4" aria-label="Upcoming strategy calls">
              <h2 className="ws-h2">Upcoming strategy calls · next 7 days</h2>
              {data.upcoming?.length ? data.upcoming.map((call) => (
                <p key={call.id}>{call.name} · {new Date(call.startTime).toLocaleString("en-GB", {
                  timeZone: "Europe/London", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                })}</p>
              )) : <p className="ws-meta">No active bookings in the next 7 days.</p>}
            </section>
          )}
          <h2 className="ws-h2">Past strategy calls</h2>
          <div className="ws-ph-acts flex-wrap" aria-label="Filter calls">
            {([
              ["all", "All calls", data.calls.length],
              ["pending", "Needs outcome", pending.length],
              ["follow_up", "Follow-up", followUps.length],
            ] as const).map(([key, label, count]) => (
              <button key={key} type="button" aria-pressed={filter === key}
                className={`ws-btn ws-focus ${filter === key ? "ws-btn-primary" : "ws-btn-quiet"}`}
                onClick={() => setFilter(key)}>{label} ({count})</button>
            ))}
          </div>
          <div className="ws-ph-acts">
            <button
              className="ws-btn"
              onClick={() => {
                setData(null);
                setBefore(new Date(data.range.from).toISOString().slice(0, 10));
              }}
            >
              Earlier calls
            </button>
            {before && (
              <button
                className="ws-btn"
                onClick={() => {
                  setData(null);
                  setBefore("");
                }}
              >
                Latest calls
              </button>
            )}
          </div>
          {visible.length ? (
            visible.map((call) => (
              <div id={"call-" + call.id} tabIndex={-1} className="ws-row ws-focus flex-wrap" key={call.id}>
                <span>
                  <strong>{call.name}</strong>
                  <br />
                  {dateLabel(call.startTime)} ·{" "}
                  {new Date(call.startTime).toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Europe/London",
                  })}
                </span>
                {call.status === "cancelled" ? (
                  <span>Cancelled</span>
                ) : !data.canEdit ? (
                  <span>{call.outcome ? outcomeLabels[call.outcome] : "Needs outcome"}</span>
                ) : (
                  <select
                    aria-label={"Outcome for " + call.name}
                    className="ws-input"
                    style={{ width: "auto" }}
                    disabled={!!busy}
                    value={call.outcome || ""}
                    onChange={(e) => void mark(call, e.target.value)}
                  >
                    <option value="" disabled>
                      Record outcome
                    </option>
                    {Object.entries(outcomeLabels).map(([key, label]) => (
                      <option value={key} key={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ))
          ) : (
            <p>{filter === "pending" ? "Every completed call in this period has an outcome." : filter === "follow_up" ? "No calls marked for follow-up in this period." : "No completed calls in this period."}</p>
          )}
        </>
      ) : (
        !error && <p role="status">Loading calls…</p>
      )}
    </main>
  );
}
