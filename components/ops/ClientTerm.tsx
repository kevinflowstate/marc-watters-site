"use client";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { Icon } from "./workspace/WorkspaceUI";
type Term = {
  term_end: string;
  decision: "pending" | "renew_term" | "monthly" | "superseded";
};
type Detail = { home_address: string; business_address: string };
const labels = {
  pending: "Awaiting Marc’s decision",
  renew_term: "Renew for another term",
  monthly: "Move to monthly payments",
  superseded: "Corrected date",
};
export default function ClientTerm({ id }: { id: string }) {
  const [terms, setTerms] = useState<Term[]>([]);
  const [details, setDetails] = useState<Detail | null>(null);
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const pending = terms.find((t) => t.decision === "pending");
  const url = "/api/admin/clients/" + id + "/term";
  const load = useCallback(async () => {
    const r = await fetch(url);
    if (!r.ok) throw Error("Contract details could not be loaded.");
    const data = await r.json();
    setTerms(data.terms);
    setDetails(data.details);
    setEnd(
      data.terms.find((t: Term) => t.decision === "pending")?.term_end || "",
    );
  }, [url]);
  useEffect(() => {
    load()
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
  }, [load]);
  async function save(decision: Term["decision"]) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          termEnd: end,
          previous: pending?.term_end || null,
          decision,
        }),
      });
      if (!r.ok) throw Error((await r.json()).error);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the term.");
    } finally {
      setBusy(false);
    }
  }
  const daysLeft = pending
    ? Math.round(
        (Date.parse(pending.term_end + "T00:00:00Z") -
          Date.parse(new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" }) + "T00:00:00Z")) /
          86400000,
      )
    : null;
  const tone = daysLeft == null ? "var(--ws-team)" : daysLeft < 0 ? "var(--ws-bad)" : daysLeft <= 7 ? "var(--ws-attn)" : "var(--ws-ok)";
  const nice = (date: string) =>
    new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(new Date(date + "T12:00:00Z"));
  return (
    <section className="lg-card lg-rise" aria-label="Delivery and renewal">
      <div className="lg-card-head">
        <div className="min-w-0">
          <h2>Delivery and renewal</h2>
          <p className="lg-sub">Contract term, renewal decision and delivery details</p>
        </div>
        {pending && daysLeft != null && (
          <span className="lg-pill" style={{ "--c": tone } as CSSProperties}>
            {daysLeft < 0 ? "Term ended" : daysLeft === 0 ? "Ends today" : daysLeft + (daysLeft === 1 ? " day left" : " days left")}
          </span>
        )}
      </div>
      <div className="lg-card-body space-y-4">
        {pending && daysLeft != null && (
          <div>
            <div className="lg-progress-top">
              <span>Term ends {nice(pending.term_end)}</span>
              <span>{daysLeft <= 7 ? "Eimear checks with Marc this week" : "Reminder one week before"}</span>
            </div>
          </div>
        )}
        {details && (
          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl px-3 py-2.5" style={{ background: "var(--lg-track)" }}>
              <dt className="lg-metric-l">Home delivery address</dt>
              <dd className="mt-1 text-[13px]" style={{ whiteSpace: "pre-wrap", color: "var(--ws-ink)" }}>{details.home_address}</dd>
            </div>
            <div className="rounded-xl px-3 py-2.5" style={{ background: "var(--lg-track)" }}>
              <dt className="lg-metric-l">Business address</dt>
              <dd className="mt-1 text-[13px]" style={{ whiteSpace: "pre-wrap", color: "var(--ws-ink)" }}>{details.business_address}</dd>
            </div>
          </dl>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <label className="lg-field" style={{ minWidth: 180 }}>
            Contract end date
            <input className="ws-input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
          <button
            type="button"
            className="ws-btn ws-focus"
            disabled={busy || !end || end === pending?.term_end}
            onClick={() => save("pending")}
          >
            Save term end
          </button>
        </div>
        {pending && end === pending.term_end && (
          <div>
            <p className="ws-caption">Eimear checks with Marc one week before the term ends. Record his decision here.</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {(["renew_term", "monthly"] as const).map((d) => (
                <button key={d} type="button" className="lg-btn ws-focus" disabled={busy} onClick={() => save(d)}>
                  <Icon name={d === "renew_term" ? "refresh" : "payments"} size={14} />
                  {labels[d]}
                </button>
              ))}
            </div>
          </div>
        )}
        {terms.some((t) => t.decision !== "pending") && (
          <ul className="space-y-1.5">
            {terms
              .filter((t) => t.decision !== "pending")
              .map((t) => (
                <li className="flex items-center gap-2 ws-caption" key={t.term_end}>
                  <Icon name="checkCircle" size={13} />
                  {nice(t.term_end)} · {labels[t.decision]}
                </li>
              ))}
          </ul>
        )}
        {error && (
          <div role="alert" className="ws-note is-attn">
            <Icon name="alert" size={15} />
            <span>{error}</span>
          </div>
        )}
      </div>
    </section>
  );
}
