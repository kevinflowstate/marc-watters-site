function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
const labels: Record<string, string> = {
  outstanding: "Work awaiting action",
  clients: "Clients",
  lessons: "Lessons",
  approvals_waiting: "Approvals waiting",
  flags: "Open flags",
  total: "Total clients",
  past_due: "Past due",
  by_area: "By area",
  payment_statuses: "Payments",
  by_status: "Preparation status",
};
const money = (n: unknown, cur: string) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: cur || "GBP" }).format(Number(n) || 0);

function CallsAndPayments({ data }: { data: Record<string, unknown> }) {
  const calls = object(data.strategy_calls);
  const pay = object(data.payments_received);
  const accounts = Array.isArray(pay.accounts) ? (pay.accounts as Record<string, unknown>[]) : [];
  const callRow = (label: string, p: Record<string, unknown>) => (
    <p className="text-sm text-text-secondary mb-1" key={label}>
      <b className="text-text-primary">{label}:</b> {String(p.booked ?? 0)} booked · {String(p.scheduled ?? 0)} calls due
      {" "}({String(p.showed ?? 0)} showed, {String(p.no_show ?? 0)} no-show, {String(p.cancelled ?? 0)} cancelled, {String(p.not_yet_marked ?? 0)} not marked)
    </p>
  );
  const payRow = (label: string, p: Record<string, unknown>) => {
    const entries = Object.entries(object(p));
    return (
      <p className="text-sm text-text-secondary mb-1" key={label}>
        <b className="text-text-primary">{label}:</b>{" "}
        {entries.length
          ? entries
              .map(([cur, v]) => {
                const x = object(v);
                return `${money(x.amount, cur)} from ${String(x.payments)} payment${x.payments === 1 ? "" : "s"}${Number(x.refunded) ? `, ${money(x.refunded, cur)} refunded` : ""}`;
              })
              .join(" · ")
          : "no payments"}
      </p>
    );
  };
  if (!("strategy_calls" in data) && !("payments_received" in data)) return null;
  return (
    <div className="grid sm:grid-cols-2 gap-4 mb-6">
      <section className="v2-surface p-5">
        <h2 className="font-heading font-bold mb-3">Strategy calls</h2>
        {!calls.connected ? (
          <p className="text-text-muted">Not connected</p>
        ) : (
          <>
            {callRow("This week so far", object(calls.current))}
            {callRow("Last week", object(calls.previous))}
          </>
        )}
      </section>
      <section className="v2-surface p-5">
        <h2 className="font-heading font-bold mb-3">Payments received</h2>
        {!accounts.length ? (
          <p className="text-text-muted">Not connected</p>
        ) : (
          accounts.map((a) => (
            <div className="mb-3" key={String(a.account)}>
              <p className="text-sm font-semibold mb-1">{String(a.account)}</p>
              {!a.connected ? (
                <p className="text-sm text-text-muted">{String(a.note || "Not connected")}</p>
              ) : (
                <>
                  {payRow("This week so far", object(a.current))}
                  {payRow("Last week", object(a.previous))}
                </>
              )}
            </div>
          ))
        )}
        <p className="text-xs text-text-muted mt-2">Money taken by card or bank in Stripe, not invoices raised or payouts.</p>
      </section>
    </div>
  );
}

export default function ReportSummary({
  data,
}: {
  data: Record<string, unknown>;
}) {
  return (
    <>
    <CallsAndPayments data={data} />
    <div className="grid sm:grid-cols-3 gap-4 mb-6">
      {Object.entries({
        outstanding: ["approvals_waiting", "flags", "by_area"],
        clients: ["total", "payment_statuses"],
        lessons: ["past_due", "by_status"],
      }).map(([key, fields]) => {
        const source = object(data[key]);
        return (
          <section className="v2-surface p-5" key={key}>
            <h2 className="font-heading font-bold mb-3">{labels[key]}</h2>
            {!source.connected ? (
              <p className="text-text-muted">Not connected</p>
            ) : (
              fields.map((field) => (
                <div className="mb-3" key={field}>
                  <span className="text-sm text-text-secondary">
                    {labels[field]}
                    {typeof source[field] === "number"
                      ? `: ${source[field]}`
                      : ""}
                  </span>
                  {typeof source[field] === "object" && (
                    <div className="flex flex-wrap gap-2 mt-1">
                      {Object.entries(object(source[field])).map(
                        ([name, count]) => (
                          <span
                            className="text-xs px-2 py-1 rounded-lg bg-accent/10 text-accent-bright"
                            key={name}
                          >
                            {name.replaceAll("_", " ")}: {String(count)}
                          </span>
                        ),
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </section>
        );
      })}
    </div>
    </>
  );
}
