import type { businessDashboard } from "@/lib/ops/business-dashboard";
import { scheduledStrategyCalls } from "@/lib/ops/call-outcomes";
type Dashboard = Awaited<ReturnType<typeof businessDashboard>>;
const amount = (n: number, currency: string) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(n);
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
  const value = (n: number | null | undefined) => n ?? "Awaiting source";
  function receipts(r: Dashboard["receipts"]) {
    return r?.forwarded == null
      ? "Awaiting source"
      : r.forwarded +
          " forwarded" +
          (r.coverage === "partial" ? " (partial evidence)" : "");
  }
  return (
    <section className="ws-panel p-5 mb-5">
      <h2 className="ws-h2">Business dashboard</h2>
      <dl className="grid gap-3 sm:grid-cols-2 mt-3">
        {[
          ["New leads in the sales pipeline", value(data.leads)],
          [
            "Strategy calls scheduled in this period",
            value(calls?.connected ? scheduledStrategyCalls(calls.current) : null),
          ],
          [
            "New bookings made in this period",
            value(calls?.connected ? calls.current?.booked : null),
          ],
          ["Sales won", value(data.calls?.won)],
          [
            "Qualified close rate",
            data.calls?.close_rate != null
              ? data.calls.close_rate + "%"
              : "Awaiting decided calls",
          ],
          ["Recurring payments received", value(data.recurring)],
          ["Published social posts", value(data.posts)],
          [
            "Open tasks",
            outstanding?.connected
              ? Object.values(outstanding.by_area || {}).reduce(
                  (a, b) => a + b,
                  0,
                )
              : "Awaiting source",
          ],
          [
            "Tasks completed",
            value(
              current?.tasks_completed?.connected
                ? current.tasks_completed.total
                : null,
            ),
          ],
          ["Supplier receipts this week", receipts(data.receipts)],
          ["Supplier receipts last week", receipts(data.previousReceipts)],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="ws-meta">{k}</dt>
            <dd>
              <strong>{v}</strong>
            </dd>
          </div>
        ))}
      </dl>
      <p className="ws-meta mt-3">
        Wins and losses determine the close rate. Receipt counts reflect
        forwards to Hubdoc. Delivery confirmation is checked separately.
      </p>
      {"monthly" in data && <>
        <h3 className="ws-h2 mt-4">Month-to-date payments</h3>
        {data.monthly?.length ? (
          data.monthly.map((a) => (
            <p key={a.account}>
              <strong>{a.account}</strong> ·{" "}
              {!a.connected
                ? "Awaiting source"
                : Object.entries(a.current || {})
                    .map(
                      ([c, x]) =>
                        amount(x.amount, c) +
                        (x.refunded
                          ? " (" + amount(x.refunded, c) + " refunded)"
                          : ""),
                    )
                    .join(" · ") || "No payments"}{" "}
              {a.connected && <small>· {a.basis}</small>}
            </p>
          ))
        ) : (
          <p>Awaiting payment data.</p>
        )}
      </>}
      {"priorities" in data && <>
        <h3 className="ws-h2 mt-4">Priority actions</h3>
        {data.priorities?.length ? (
          <ul>
            {data.priorities.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        ) : (
          <p>
            {data.priorities
              ? "No open high-priority tasks."
              : "Priority tasks unavailable."}
          </p>
        )}
      </>}
    </section>
  );
}
