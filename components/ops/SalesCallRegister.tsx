"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
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
    if (!outcome) return;
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
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save outcome.");
    } finally {
      setBusy("");
    }
  }
  if (compact) {
    const pending = data?.calls.filter(
      (c) => !c.outcome && c.status !== "cancelled",
    );
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
      <h1 className="ws-title">Sales call outcomes</h1>
      <p>
        Record an outcome after each strategy call. Qualified close rate uses
        wins divided by wins plus losses. Follow-ups stay open.
      </p>
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
            {data.stats.won} wins from {data.stats.qualified_decisions} decided
            calls · Qualified close rate{" "}
            {data.stats.close_rate === null
              ? "pending"
              : data.stats.close_rate + "%"}
          </p>
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
          {data.calls.length ? (
            data.calls.map((call) => (
              <label className="ws-row" key={call.id}>
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
              </label>
            ))
          ) : (
            <p>No completed calls in this period.</p>
          )}
        </>
      ) : (
        !error && <p role="status">Loading calls…</p>
      )}
    </main>
  );
}
