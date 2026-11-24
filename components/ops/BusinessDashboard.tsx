"use client";
import type { CSSProperties } from "react";
import type { businessDashboard } from "@/lib/ops/business-dashboard";
import { scheduledStrategyCalls } from "@/lib/ops/call-outcomes";
import { CountUp, Funnel, GlassCard, Ring } from "./charts/Glass";
import { Icon } from "./workspace/WorkspaceUI";

type Dashboard = Awaited<ReturnType<typeof businessDashboard>>;
const amount = (n: number, currency: string) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(n);

function Tile({ label, value, note, dot, i }: { label: string; value: number | null | undefined; note?: string; dot: string; i: number }) {
  return (
    <div className="rounded-xl px-3.5 py-3 lg-rise" style={{ background: "var(--lg-track)", "--i": i } as CSSProperties}>
      <div className="lg-metric-l">
        <span className="ws-dot shrink-0" style={{ background: dot }} />
        <span className="truncate">{label}</span>
      </div>
      <div className="lg-metric-n" style={{ fontSize: 22, marginTop: 6 }}>
        {value == null ? <span className="lg-await">Awaiting source</span> : <CountUp value={value} />}
      </div>
      {note && <div className="lg-metric-s">{note}</div>}
    </div>
  );
}

export default function BusinessDashboard({
  data,
  snapshot,
}: {
  data: Dashboard;
  snapshot: Record<string, unknown>;
}) {
  const current = snapshot.current as
    | { tasks_completed?: { connected?: boolean; total?: number } }
    | undefined;
  const outstanding = snapshot.outstanding as
    | { connected?: boolean; by_area?: Record<string, number> }
    | undefined;
  const calls = snapshot.strategy_calls as
    | { connected?: boolean; current?: { booked?: number; scheduled?: number; cancelled?: number; non_cancelled_scheduled?: number } }
    | undefined;
  const scheduled = calls?.connected ? scheduledStrategyCalls(calls.current) : null;
  const booked = calls?.connected ? (calls.current?.booked ?? null) : null;
  const openTasks = outstanding?.connected
    ? Object.values(outstanding.by_area || {}).reduce((a, b) => a + b, 0)
    : null;
  const completed = current?.tasks_completed?.connected ? (current.tasks_completed.total ?? null) : null;
  const receipts = (r: Dashboard["receipts"]) => (r?.forwarded == null ? null : r.forwarded);
  const partial = (r: Dashboard["receipts"]) => (r?.coverage === "partial" ? "Partial evidence" : undefined);
  const closeRate = data.calls?.close_rate ?? null;
  return (
    <GlassCard title="Business dashboard" sub="Sales, payments and operations for the report week" className="mb-4">
      <div className="lg-card-body">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <Funnel
            rows={[
              { label: "New leads in the sales pipeline", value: data.leads },
              { label: "New bookings made in this period", value: booked },
              { label: "Strategy calls scheduled in this period", value: scheduled },
              { label: "Sales won", value: data.calls?.won, color: "var(--ws-ok)" },
            ]}
          />
          <div className="flex flex-col items-center gap-2">
            <Ring
              value={closeRate}
              color="var(--ws-ok)"
              label={closeRate == null ? "-" : <CountUp value={closeRate} format={(n) => Math.round(n) + "%"} />}
              caption="Close rate"
            />
            {closeRate == null && <span className="ws-caption">Awaiting decided calls</span>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5 mt-5 lg:grid-cols-3">
          <Tile i={0} label="Recurring payments received" value={data.recurring} dot="var(--ws-eimear)" />
          <Tile i={1} label="Published social posts" value={data.posts} dot="var(--ws-accent-ink)" />
          <Tile i={2} label="Open tasks" value={openTasks} dot="var(--ws-attn)" />
          <Tile i={3} label="Tasks completed" value={completed} dot="var(--ws-ok)" />
          <Tile i={4} label="Supplier receipts this week" value={receipts(data.receipts)} note={partial(data.receipts)} dot="var(--ws-eimear)" />
          <Tile i={5} label="Supplier receipts last week" value={receipts(data.previousReceipts)} note={partial(data.previousReceipts)} dot="var(--ws-team)" />
        </div>
        <p className="ws-caption mt-3">
          Wins and losses determine the close rate. Receipt counts reflect forwards to Hubdoc. Delivery confirmation is
          checked separately.
        </p>
        {"monthly" in data && (
          <div className="mt-5">
            <h3 className="ws-h3 mb-2">Month-to-date payments</h3>
            {data.monthly?.length ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {data.monthly.map((a) => (
                  <div key={a.account} className="rounded-xl px-3.5 py-3" style={{ background: "var(--lg-track)" }}>
                    <div className="lg-metric-l">{a.account}</div>
                    <div className="mt-1 text-[15px] font-semibold" style={{ color: "var(--ws-ink)" }}>
                      {!a.connected
                        ? "Awaiting source"
                        : Object.entries(a.current || {})
                            .map(([c, x]) => amount(x.amount, c))
                            .join(" · ") || "No payments"}
                    </div>
                    {a.connected && (
                      <div className="lg-metric-s">
                        {Object.entries(a.current || {})
                          .filter(([, x]) => x.refunded)
                          .map(([c, x]) => amount(x.refunded, c) + " refunded · ")
                          .join("")}
                        {a.basis}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="ws-meta">Awaiting payment data.</p>
            )}
          </div>
        )}
        {"priorities" in data && (
          <div className="mt-5">
            <h3 className="ws-h3 mb-2">Priority actions</h3>
            {data.priorities?.length ? (
              <ul className="grid gap-1.5">
                {data.priorities.map((t, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[13px]" style={{ color: "var(--ws-ink-2)" }}>
                    <span className="mt-0.5 shrink-0" style={{ color: "var(--ws-attn)" }}>
                      <Icon name="flag" size={13} />
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ws-meta">{data.priorities ? "No open high-priority tasks." : "Priority tasks unavailable."}</p>
            )}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
