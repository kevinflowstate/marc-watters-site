"use client";
import { useEffect, useState } from "react";
import { CountUp, GlassCard } from "./charts/Glass";

const duration = (n: number) => {
  const m = Math.round(n);
  return m < 60 ? m + "m" : Math.floor(m / 60) + "h " + String(m % 60).padStart(2, "0") + "m";
};

export default function TeamActivity({ report, index = 0 }: { report?: string; index?: number }) {
  const [data, setData] = useState<{
    completed: number;
    actions: number;
    activeMinutes: number;
  } | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/team-activity" + (report ? "?report=" + encodeURIComponent(report) : ""), {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (r) => {
        if (r.status === 404 || r.status === 403) return;
        if (!r.ok) throw Error();
        const d = await r.json();
        if (!controller.signal.aborted) setData(d);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [report]);
  if (error) return <p className="ws-caption">Team activity unavailable for this report.</p>;
  if (!data) return null;
  const perTask = data.completed ? data.actions / data.completed : null;
  const tiles = [
    { label: "Tasks completed", value: data.completed, color: "var(--ws-ok)" },
    { label: "Recorded actions", value: data.actions, color: "var(--ws-accent-ink)" },
    { label: "Estimated active time", value: data.activeMinutes, color: "var(--ws-eimear)", format: duration },
  ];
  return (
    <GlassCard index={index} title="Eimear’s workspace activity" sub="Visible to Marc and Kevin">
      <div className="lg-card-body">
        <div className="grid gap-2.5 sm:grid-cols-3">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-xl px-4 py-3" style={{ background: "var(--lg-track)" }}>
              <div className="lg-metric-l">
                <span className="ws-dot" style={{ background: t.color }} />
                {t.label}
              </div>
              <div className="lg-metric-n" style={{ fontSize: 26 }}>
                <CountUp value={t.value} format={t.format} />
              </div>
            </div>
          ))}
        </div>
        <p className="ws-caption mt-3">
          {perTask != null ? `About ${perTask.toFixed(1)} recorded actions per completed task. ` : ""}
          Active time counts gaps of up to five minutes between recorded workspace actions. Reading, offline work and idle
          sign-in time are outside this measure.
        </p>
      </div>
    </GlassCard>
  );
}
