"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { CountUp, GlassCard, Ring } from "./charts/Glass";
import { Icon } from "./workspace/WorkspaceUI";
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
const outcomeColour: Record<CallOutcome, string> = {
  won: "var(--ws-ok)",
  lost: "var(--ws-bad)",
  follow_up: "var(--ws-accent-ink)",
  unqualified: "var(--ws-team)",
  no_show: "var(--ws-attn)",
};
const part = (time: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(time).toLocaleString("en-GB", { timeZone: "Europe/London", ...opts });
function DateTile({ time }: { time: string }) {
  return (
    <span className="lg-date" aria-hidden="true">
      <b>{part(time, { day: "numeric" })}</b>
      <span>{part(time, { month: "short" })}</span>
    </span>
  );
}
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
  const decided = data?.calls.filter((c) => c.outcome && c.status !== "cancelled") ?? [];
  const split = (Object.keys(outcomeLabels) as CallOutcome[])
    .map((key) => ({ key, value: decided.filter((c) => c.outcome === key).length }))
    .filter((o) => o.value > 0);
  return (
    <main className="ws ws-page lg-stage">
      <Link href="/admin/work" className="ws-back ws-focus">
        <Icon name="chevron" size={14} className="ws-back-ic" />
        Workspace
      </Link>
      <header className="lg-hello lg-rise">
        <div>
          <h1>Sales call tracker</h1>
          <p className="ws-meta mt-1.5">
            {data && !data.canEdit ? "You can view the recorded outcomes here." : "Choose an outcome next to a completed call to save it."}
            {" "}Conversion rate uses converted calls divided by converted and lost calls.
          </p>
        </div>
      </header>
      {notice && (
        <div className="ws-note is-ok" role="status">
          <Icon name="checkCircle" size={15} />
          <span>{notice}</span>
        </div>
      )}
      {error && (
        <div role="alert" className="ws-note is-attn">
          <Icon name="alert" size={15} />
          <span>
            {error}{" "}
            <button className="ws-link" onClick={() => void load()}>
              Reload
            </button>
          </span>
        </div>
      )}
      {data ? (
        <>
          <div className="lg-grid lg-grid-hero">
            <GlassCard index={1} title="This period" sub={dateLabel(data.range.from) + " – " + dateLabel(data.range.to - 1)}>
              <div className="lg-card-body flex flex-wrap items-center gap-6">
                <Ring
                  value={data.stats.close_rate}
                  color="var(--ws-ok)"
                  size={120}
                  label={data.stats.close_rate === null ? "-" : <CountUp value={data.stats.close_rate} format={(n) => Math.round(n) + "%"} />}
                  caption={data.stats.close_rate === null ? "Pending" : "Close rate"}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-x-8 gap-y-3">
                    <div>
                      <div className="lg-metric-l">Converted</div>
                      <div className="lg-metric-n is-sm"><CountUp value={data.stats.won} /></div>
                    </div>
                    <div>
                      <div className="lg-metric-l">Decided calls</div>
                      <div className="lg-metric-n is-sm"><CountUp value={data.stats.qualified_decisions} /></div>
                    </div>
                    <div>
                      <div className="lg-metric-l">Needs outcome</div>
                      <div className="lg-metric-n is-sm" style={pending.length ? { color: "var(--ws-attn)" } : undefined}>
                        <CountUp value={pending.length} />
                      </div>
                    </div>
                  </div>
                  {split.length > 0 && (
                    <>
                      <div className="lg-split mt-4" aria-hidden="true">
                        {split.map((o, i) => (
                          <i key={o.key} style={{ flex: o.value, "--c": outcomeColour[o.key], "--i": i } as CSSProperties} />
                        ))}
                      </div>
                      <div className="lg-legend mt-2.5">
                        {split.map((o) => (
                          <span key={o.key}>
                            <i style={{ background: outcomeColour[o.key] }} />
                            {outcomeLabels[o.key]} {o.value}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </GlassCard>
            {!before && (
              <GlassCard index={2} title="Upcoming strategy calls" sub="Next 7 days" aria-label="Upcoming strategy calls">
                <div className="lg-card-body">
                  {data.upcoming?.length ? (
                    <div className="grid gap-2">
                      {data.upcoming.map((call, i) => (
                        <div key={call.id} className="lg-up" style={{ "--i": i } as CSSProperties}>
                          <DateTile time={call.startTime} />
                          <span className="min-w-0">
                            <span className="lg-call-t block">{call.name}</span>
                            <span className="lg-call-s block">
                              {part(call.startTime, { weekday: "long" })} · {part(call.startTime, { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="ws-meta">No active bookings in the next 7 days.</p>
                  )}
                </div>
              </GlassCard>
            )}
          </div>
          <GlassCard
            index={3}
            title="Past strategy calls"
            action={
              <div className="flex flex-wrap gap-2">
                <button
                  className="lg-btn ws-focus"
                  onClick={() => {
                    setData(null);
                    setBefore(new Date(data.range.from).toISOString().slice(0, 10));
                  }}
                >
                  <Icon name="history" size={14} />
                  Earlier calls
                </button>
                {before && (
                  <button
                    className="lg-btn ws-focus"
                    onClick={() => {
                      setData(null);
                      setBefore("");
                    }}
                  >
                    Latest calls
                  </button>
                )}
              </div>
            }
          >
            <div className="px-[18px] pt-3">
              <div className="lg-seg" aria-label="Filter calls" role="group">
                {([
                  ["all", "All calls", data.calls.length],
                  ["pending", "Needs outcome", pending.length],
                  ["follow_up", "Follow-up", followUps.length],
                ] as const).map(([key, label, count]) => (
                  <button key={key} type="button" aria-pressed={filter === key} className="ws-focus" onClick={() => setFilter(key)}>
                    {label}
                    <em>{count}</em>
                  </button>
                ))}
              </div>
            </div>
            {visible.length ? (
              <ul className="lg-calls">
                {visible.map((call, i) => (
                  <li id={"call-" + call.id} tabIndex={-1} className="lg-call ws-focus" key={call.id} style={{ "--i": Math.min(i, 12) } as CSSProperties}>
                    <DateTile time={call.startTime} />
                    <span className="min-w-0">
                      <span className="lg-call-t block">{call.name}</span>
                      <span className="lg-call-s block">
                        {part(call.startTime, { weekday: "short" })} {dateLabel(call.startTime)} ·{" "}
                        {part(call.startTime, { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </span>
                    {call.status === "cancelled" ? (
                      <span className="lg-pill" style={{ "--c": "var(--ws-ink-4)" } as CSSProperties}>Cancelled</span>
                    ) : !data.canEdit ? (
                      <span className="lg-pill" style={{ "--c": call.outcome ? outcomeColour[call.outcome] : "var(--ws-attn)" } as CSSProperties}>
                        {call.outcome ? outcomeLabels[call.outcome] : "Needs outcome"}
                      </span>
                    ) : (
                      <select
                        aria-label={"Outcome for " + call.name}
                        className="lg-outcome"
                        style={{ "--c": call.outcome ? outcomeColour[call.outcome] : "var(--ws-attn)" } as CSSProperties}
                        disabled={!!busy}
                        value={call.outcome || ""}
                        onChange={(e) => void mark(call, e.target.value)}
                      >
                        <option value="" disabled>
                          {busy === call.id ? "Saving…" : "Record outcome"}
                        </option>
                        {Object.entries(outcomeLabels).map(([key, label]) => (
                          <option value={key} key={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="lg-clear">
                <span className="lg-q-ic" aria-hidden="true"><Icon name="check" size={16} /></span>
                <span>{filter === "pending" ? "Every completed call in this period has an outcome." : filter === "follow_up" ? "No calls marked for follow-up in this period." : "No completed calls in this period."}</span>
              </div>
            )}
          </GlassCard>
        </>
      ) : (
        !error && (
          <div className="lg-card p-4" role="status" aria-label="Loading calls">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-2.5">
                <div className="lg-skel" style={{ width: 40, height: 42, borderRadius: 10 }} />
                <div className="flex-1">
                  <div className="lg-skel" style={{ height: 11, width: "45%" }} />
                  <div className="lg-skel mt-2" style={{ height: 9, width: "30%" }} />
                </div>
                <div className="lg-skel" style={{ width: 120, height: 30, borderRadius: 999 }} />
              </div>
            ))}
          </div>
        )
      )}
    </main>
  );
}
