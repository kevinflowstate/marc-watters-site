"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import AttentionCard from "./AttentionCard";
import TeamActivity from "./TeamActivity";
import { Icon } from "./workspace/WorkspaceUI";
import { AreaChart, Bars, CountUp, Funnel, GlassCard, Ring } from "./charts/Glass";

import type { BusinessOverviewSnapshot } from "@/lib/ops/business-overview-snapshot";

type Revenue = BusinessOverviewSnapshot["revenue"];
type Snapshot = Omit<BusinessOverviewSnapshot, "revenue"> & { revenue?: Revenue };
type Overview = {
  capabilities: { canViewRevenue: boolean; canViewTeamActivity: boolean };
  snapshot: Snapshot | null;
};
type Calls = NonNullable<Snapshot["operations"]["calls"]> & {
  follow_up?: number;
  unqualified?: number;
  no_show?: number;
  unmarked?: number;
};
type ReceiptCount = NonNullable<Snapshot["operations"]["hubdoc"]> & {
  codexForwarded?: number | null;
  codexRecordedDays?: number;
  sentReconciled?: number | null;
};

const money = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
const money0 = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });
const london = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const fmt = (opts: Intl.DateTimeFormatOptions) => (date: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...opts }).format(new Date(date + "T12:00:00Z"));
const dayShort = fmt({ day: "numeric", month: "short" });
const weekday = fmt({ weekday: "short" });
const weekdayLong = fmt({ weekday: "long", day: "numeric", month: "short" });
const periodStart = fmt({ day: "numeric", month: "long" });
function addDays(date: string, n: number) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function receiptSource(receipts?: ReceiptCount | null) {
  const notes = [];
  if (receipts?.codexRecordedDays) {
    notes.push("Codex reported on " + receipts.codexRecordedDays + " of " + receipts.expectedDays + " weekdays");
  }
  if (receipts?.sentReconciled != null) {
    const count = receipts.sentReconciled;
    notes.push("Separate Sent mail check found " + count + (count === 1 ? " qualifying item" : " qualifying items"));
  }
  return notes.join(" · ") || "Source: Marc’s Codex receipt-forwarding job";
}

function Num({ value, format }: { value: number | null | undefined; format?: (n: number) => string }) {
  return value == null ? <span className="lg-await">Awaiting source</span> : <CountUp value={value} format={format} />;
}

function RevenueCard({ snapshot, revenue }: { snapshot: Snapshot; revenue: Revenue }) {
  const daily = revenue.daily ?? null;
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date(snapshot.asOf));
  const month = useMemo(() => {
    if (!daily) return null;
    let sum = 0;
    return daily
      .filter((d) => d.date >= snapshot.monthStart)
      .map((d) => {
        sum = Math.round((sum + d.netGBP) * 100) / 100;
        return { label: dayShort(d.date), value: sum, detail: "Month to date by " + weekdayLong(d.date) };
      });
  }, [daily, snapshot.monthStart]);
  const week = useMemo(() => {
    if (!daily) return null;
    const byDate = new Map(daily.map((d) => [d.date, d.netGBP]));
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(snapshot.weekStart, i);
      const ahead = date > todayKey;
      return {
        label: weekday(date),
        value: ahead ? 0 : (byDate.get(date) ?? 0),
        detail: weekdayLong(date) + (ahead ? " · still to come" : " · net"),
      };
    });
  }, [daily, snapshot.weekStart, todayKey]);
  const share =
    revenue.week.netGBP != null && revenue.month.netGBP && revenue.month.netGBP > 0
      ? Math.max(0, Math.min(100, Math.round((100 * revenue.week.netGBP) / revenue.month.netGBP)))
      : null;
  return (
    <GlassCard
      index={1}
      title="Revenue"
      sub={"Stripe collections after refunds · since " + periodStart(snapshot.monthStart)}
      action={
        revenue.coverage !== "complete" ? (
          <span className="lg-pill" style={{ "--c": "var(--ws-attn)" } as CSSProperties}>
            Coverage {revenue.coverage}
          </span>
        ) : null
      }
    >
      <div className="lg-card-body">
        <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
          <div>
            <div className="lg-metric-l">Month to date</div>
            <div className="lg-metric-n" style={{ fontSize: 38 }}>
              <Num value={revenue.month.netGBP} format={(n) => money0.format(n)} />
            </div>
            <div className="lg-metric-s">
              {revenue.month.payments != null && <b>{revenue.month.payments} payments</b>}
              {revenue.month.refundsGBP ? " · " + money.format(revenue.month.refundsGBP) + " refunded" : ""}
            </div>
          </div>
          <div>
            <div className="lg-metric-l">Week to date</div>
            <div className="lg-metric-n is-sm">
              <Num value={revenue.week.netGBP} format={(n) => money0.format(n)} />
            </div>
            <div className="lg-metric-s">
              Since {periodStart(snapshot.weekStart)}
              {revenue.week.refundsGBP ? " · " + money.format(revenue.week.refundsGBP) + " refunded" : ""}
            </div>
          </div>
          {share != null && !daily && (
            <div className="min-w-[180px] flex-1">
              <div className="lg-progress-top">
                <span>This week’s share of the month</span>
                <span>{share}%</span>
              </div>
              <div className="lg-funnel-bar">
                <i style={{ "--w": share + "%" } as CSSProperties} />
              </div>
            </div>
          )}
        </div>
        {month && month.length > 1 && (
          <div className="mt-5">
            <AreaChart
              points={month}
              format={(n) => money.format(n)}
              ariaLabel={"Cumulative month-to-date revenue, " + money.format(month.at(-1)!.value)}
            />
          </div>
        )}
        {week && (
          <div className="mt-4">
            <div className="lg-metric-l mb-2">This week by day</div>
            <Bars points={week} height={96} format={(n) => money.format(n)} ariaLabel="Net revenue for each day this week" />
          </div>
        )}
        <p className="ws-caption mt-4">
          Cash and bank transfers await reconciliation.
          {revenue.otherCurrencies?.length ? " GBP figures exclude " + revenue.otherCurrencies.join(", ") + " payments." : ""}
          {!daily ? " The daily trend appears from the next refresh." : ""}
          {revenue.coverage !== "complete"
            ? " Payment source coverage is " +
              revenue.coverage +
              ": " +
              revenue.accounts
                .filter((a) => a.coverage !== "complete")
                .map((a) => a.label)
                .join(", ") +
              "."
            : ""}
        </p>
      </div>
    </GlassCard>
  );
}

function SalesCard({ ops, snapshot, index }: { ops: Snapshot["operations"]; snapshot: Snapshot; index: number }) {
  const calls = ops.calls as Calls | null;
  const outcomes = calls
    ? [
        { key: "won", label: "Converted", value: calls.won ?? 0, color: "var(--ws-ok)" },
        { key: "lost", label: "Did not convert", value: calls.lost ?? 0, color: "var(--ws-bad)" },
        { key: "follow_up", label: "Follow-up", value: calls.follow_up ?? 0, color: "var(--ws-accent-ink)" },
        { key: "no_show", label: "No-show", value: calls.no_show ?? 0, color: "var(--ws-attn)" },
        { key: "unqualified", label: "Not qualified", value: calls.unqualified ?? 0, color: "var(--ws-team)" },
      ].filter((o) => o.value > 0)
    : [];
  return (
    <GlassCard
      index={index}
      title="Sales this week"
      sub={"Since " + periodStart(snapshot.weekStart)}
      action={
        <Link className="lg-link ws-focus" href="/admin/sales-calls">
          Sales calls <Icon name="chevron" size={12} />
        </Link>
      }
    >
      <div className="lg-card-body">
        <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <Funnel
            rows={[
              { label: "New leads", value: ops.leads },
              { label: "Bookings made", value: ops.bookingsMade, note: "For appointments up to 60 days ahead" },
              { label: "Strategy calls scheduled", value: calls?.scheduled },
              { label: "Sales won", value: calls?.won, color: "var(--ws-ok)" },
            ]}
          />
          <div className="flex flex-col items-center gap-2">
            <Ring
              value={calls?.close_rate ?? null}
              color="var(--ws-ok)"
              label={calls?.close_rate == null ? "-" : <CountUp value={calls.close_rate} format={(n) => Math.round(n) + "%"} />}
              caption="Close rate"
            />
            <span className="ws-caption text-center">
              {calls ? (calls.close_rate == null ? "Awaiting decisions" : calls.won + " won · " + calls.lost + " lost") : "Awaiting source"}
            </span>
          </div>
        </div>
        {(outcomes.length > 0 || calls?.unmarked) && (
          <div className="mt-5">
            {outcomes.length > 0 && (
              <div className="lg-split" aria-hidden="true">
                {outcomes.map((o, i) => (
                  <i key={o.key} style={{ flex: o.value, "--c": o.color, "--i": i } as CSSProperties} />
                ))}
              </div>
            )}
            <div className="lg-legend mt-3">
              {outcomes.map((o) => (
                <span key={o.key}>
                  <i style={{ background: o.color }} />
                  {o.label} {o.value}
                </span>
              ))}
              {calls?.unmarked ? (
                <Link href="/admin/sales-calls" className="ws-link">
                  {calls.unmarked} {calls.unmarked === 1 ? "call needs" : "calls need"} an outcome
                </Link>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  );
}

function OperationsCard({ ops, index }: { ops: Snapshot["operations"]; index: number }) {
  const receipts = ops.hubdoc as ReceiptCount | null | undefined;
  const expected = receipts?.expectedDays ?? 0;
  const recorded = receipts?.codexRecordedDays ?? 0;
  return (
    <GlassCard
      index={index}
      title="Operations this week"
      sub="Finance admin, content and tasks"
      action={
        <Link className="lg-link ws-focus" href="/admin/work">
          Workspace <Icon name="chevron" size={12} />
        </Link>
      }
    >
      <div className="lg-card-body">
        <div className="flex items-center gap-5">
          <Ring
            value={expected ? recorded : null}
            max={expected || 1}
            size={104}
            stroke={9}
            color="var(--ws-eimear)"
            label={receipts?.codexForwarded == null ? "-" : <CountUp value={receipts.codexForwarded} />}
            caption="to Hubdoc"
          />
          <div className="min-w-0">
            <div className="text-[13.5px] font-medium" style={{ color: "var(--ws-ink)" }}>
              Invoices and receipts forwarded to Hubdoc
            </div>
            <p className="ws-caption mt-1">
              {receipts?.codexForwarded == null ? "Awaiting Codex forwarding record. " : ""}
              {receiptSource(receipts)}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2.5 mt-5">
          {(
            [
              ["Published posts", ops.posts, "var(--ws-accent-ink)"],
              ["Completed tasks", ops.tasks?.completed, "var(--ws-ok)"],
              ["Recurring payments", ops.recurring, "var(--ws-eimear)"],
            ] as const
          ).map(([label, value, dot]) => (
            <div key={label} className="min-w-0 rounded-xl px-3 py-2.5" style={{ background: "var(--lg-track)" }}>
              <div className="lg-metric-l items-start leading-tight">
                <span className="ws-dot shrink-0 mt-1" style={{ background: dot }} />
                <span>{label}</span>
              </div>
              <div className="lg-metric-n" style={{ fontSize: 22, marginTop: 6 }}>
                <Num value={value} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}

function SkeletonGrid() {
  return (
    <div className="lg-grid lg-grid-hero" aria-hidden="true">
      {[0, 1].map((i) => (
        <div key={i} className="lg-card lg-rise p-5" style={{ "--i": i } as CSSProperties}>
          <div className="lg-skel" style={{ height: 14, width: 120 }} />
          <div className="lg-skel mt-4" style={{ height: 34, width: 180 }} />
          <div className="lg-skel mt-6" style={{ height: 150 }} />
        </div>
      ))}
    </div>
  );
}

async function loadOverview(method: "GET" | "POST", signal?: AbortSignal): Promise<Overview> {
  const response = await fetch("/api/admin/business-overview", { method, signal, cache: "no-store" });
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
        if (!request.signal.aborted) setError("The business overview could not be loaded. Try Refresh.");
      })
      .finally(() => {
        if (!request.signal.aborted) setBusy(false);
      });
    return () => request.abort();
  }, []);
  const [revision, setRevision] = useState(0);
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
      setRevision((n) => n + 1);
    }
  }
  const snapshot = overview?.snapshot;
  const revenue = overview?.capabilities.canViewRevenue ? snapshot?.revenue : undefined;
  const ops = snapshot?.operations;
  const showRevenue = Boolean(revenue && snapshot);
  return (
    <section aria-label="Business overview" className="ws-stack lg-stage">
      <header className="lg-hello lg-rise">
        <div>
          <h1>Business overview</h1>
          <p className={`lg-live ${busy ? "is-busy" : ""}`} aria-live="polite">
            <i aria-hidden="true" />
            {snapshot
              ? "Updated " + london.format(new Date(snapshot.asOf)) + " UK time"
              : busy
                ? "Loading figures…"
                : "Awaiting a business snapshot"}
            {" · daily at 08:00"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {overview?.capabilities.canViewTeamActivity && (
            <a className="lg-btn ws-focus" href="#workspace-activity">
              <Icon name="users" size={14} />
              Eimear’s activity
            </a>
          )}
          <button type="button" className="lg-btn ws-focus" disabled={busy} onClick={refresh}>
            <Icon name="refresh" size={14} className={busy && overview ? "lg-spin" : ""} />
            {busy && overview ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>
      {error && (
        <div role="alert" className="ws-note is-attn">
          <Icon name="alert" size={15} />
          <span>{error}</span>
        </div>
      )}
      {!overview && busy ? (
        <SkeletonGrid />
      ) : (
        <div className={`lg-grid ${showRevenue ? "lg-grid-hero" : ""}`}>
          {revenue && snapshot && <RevenueCard snapshot={snapshot} revenue={revenue} />}
          <AttentionCard revision={revision} index={showRevenue ? 2 : 1} />
        </div>
      )}
      {ops && snapshot && (
        <div className="lg-grid lg-grid-2">
          <SalesCard ops={ops} snapshot={snapshot} index={3} />
          <OperationsCard ops={ops} index={4} />
        </div>
      )}
      {overview?.capabilities.canViewTeamActivity && (
        <div id="workspace-activity" className="scroll-mt-16">
          <TeamActivity key={snapshot?.asOf} index={5} />
        </div>
      )}
    </section>
  );
}
