"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import TeamActivity from "./TeamActivity";

import type { BusinessOverviewSnapshot } from "@/lib/ops/business-overview-snapshot";

type Snapshot = Omit<BusinessOverviewSnapshot, "revenue"> & {
  revenue?: BusinessOverviewSnapshot["revenue"];
};
type Overview = {
  capabilities: { canViewRevenue: boolean; canViewTeamActivity: boolean };
  snapshot: Snapshot | null;
};
const money = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});
const london = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
function periodStart(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "long",
  }).format(new Date(date + "T12:00:00Z"));
}
function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: ReactNode;
  note?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="ws-meta">{label}</dt>
      <dd className="mt-1 text-xl font-semibold">
        {value ?? <span className="ws-caption">Awaiting source</span>}
      </dd>
      {note && <dd className="ws-caption">{note}</dd>}
    </div>
  );
}
function Panel({
  title,
  link,
  href,
  children,
}: {
  title: string;
  link?: string;
  href?: string;
  children: ReactNode;
}) {
  return (
    <section className="ws-panel min-w-0">
      <div className="ws-panel-head">
        <h2 className="ws-h2">{title}</h2>
        {href && (
          <Link className="ws-link text-sm" href={href}>
            {link}
          </Link>
        )}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}
async function loadOverview(
  method: "GET" | "POST",
  signal?: AbortSignal,
): Promise<Overview> {
  const response = await fetch("/api/admin/business-overview", {
    method,
    signal,
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Business overview unavailable");
  return response.json();
}
export default function BusinessOverview() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const request = new AbortController();
    loadOverview("GET", request.signal)
      .then(setOverview)
      .catch(() => {
        if (!request.signal.aborted)
          setError("The business overview could not be loaded. Try Refresh.");
      })
      .finally(() => {
        if (!request.signal.aborted) setBusy(false);
      });
    return () => request.abort();
  }, []);
  async function refresh() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      setOverview(await loadOverview("POST"));
    } catch {
      setError("Refresh failed. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }
  const snapshot = overview?.snapshot;
  const revenue = overview?.capabilities.canViewRevenue && snapshot?.revenue;
  const ops = snapshot?.operations;
  const calls = ops?.calls;
  return (
    <section aria-label="Business overview" className="ws-stack">
      <header className="ws-ph">
        <div>
          <h1 className="ws-title">Business overview</h1>
          <p className="ws-meta mt-1" aria-live="polite">
            {snapshot
              ? "Updated " + london.format(new Date(snapshot.asOf)) + " UK time"
              : busy
                ? "Loading figures…"
                : "Awaiting a business snapshot"}{" "}
            · Daily at 08:00 UK time
          </p>
        </div>
        <button
          type="button"
          className="ws-btn ws-focus"
          disabled={busy}
          onClick={refresh}
        >
          {busy && overview ? "Refreshing…" : "Refresh"}
        </button>
      </header>
      {error && (
        <p role="alert" className="ws-meta">
          {error}
        </p>
      )}
      {revenue && snapshot && (
        <Panel title="Revenue">
          <dl className="grid gap-5 sm:grid-cols-2">
            {(
              [
                ["Week to date", snapshot.weekStart, revenue.week],
                ["Month to date", snapshot.monthStart, revenue.month],
              ] as const
            ).map(([label, date, period]) => (
              <Metric
                key={label}
                label={label}
                value={
                  period.netGBP == null ? null : money.format(period.netGBP)
                }
                note={
                  "Since " +
                  periodStart(date) +
                  (period.refundsGBP == null
                    ? ""
                    : " · " + money.format(period.refundsGBP) + " refunded")
                }
              />
            ))}
          </dl>
          <p className="ws-caption mt-4">
            Stripe collections after refunds. Cash and bank transfers await
            reconciliation.{" "}
            {revenue.otherCurrencies?.length
              ? "GBP figures exclude " +
                revenue.otherCurrencies.join(", ") +
                " payments."
              : ""}
          </p>
          {revenue.coverage !== "complete" && (
            <p className="ws-meta mt-2">
              Payment source coverage is {revenue.coverage}.{" "}
              {revenue.accounts
                .filter((a) => a.coverage !== "complete")
                .map((a) => a.label)
                .join(" · ")}
            </p>
          )}
        </Panel>
      )}
      {ops && snapshot && (
        <>
          <Panel
            title={"Sales since " + periodStart(snapshot.weekStart)}
            link="Sales call register"
            href="/admin/sales-calls"
          >
            <dl className="grid grid-cols-2 gap-x-4 gap-y-5 lg:grid-cols-4">
              <Metric label="New leads" value={ops.leads} />
              <Metric
                label="Strategy calls scheduled this week"
                value={calls?.scheduled}
              />
              <Metric
                label="Bookings made this week"
                value={ops.bookingsMade}
              />
              <Metric label="Sales won" value={calls?.won} />
              <Metric
                label="Qualified close rate"
                value={
                  calls ? (
                    calls.close_rate == null ? (
                      <span className="ws-caption">Awaiting decisions</span>
                    ) : (
                      calls.close_rate + "%"
                    )
                  ) : null
                }
                note={
                  calls
                    ? calls.won + " won · " + calls.lost + " lost"
                    : undefined
                }
              />
            </dl>
          </Panel>
          <Panel
            title="Operations this week"
            link="Open Workspace"
            href="/admin/work"
          >
            <dl className="grid grid-cols-2 gap-x-4 gap-y-5 lg:grid-cols-4">
              <Metric
                label="Invoices forwarded to Hubdoc"
                value={ops.hubdoc?.forwarded}
                note={
                  ops.hubdoc?.coverage === "partial"
                    ? "Partial forwarding records"
                    : "Forwarding evidence only"
                }
              />
              <Metric label="Published posts" value={ops.posts} />
              <Metric label="Completed tasks" value={ops.tasks.completed} />
              <Metric
                label="Open tasks"
                value={ops.tasks.open}
                note={
                  ops.tasks.priority == null
                    ? undefined
                    : ops.tasks.priority + " priority"
                }
              />
              <Metric
                label="Recurring payments received"
                value={ops.recurring}
              />
            </dl>
          </Panel>
        </>
      )}
      {overview?.capabilities.canViewTeamActivity && (
        <TeamActivity key={snapshot?.asOf} />
      )}
    </section>
  );
}
