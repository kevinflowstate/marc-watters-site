"use client";
import { useCallback, useEffect, useState } from "react";
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
  return (
    <section className="ws-panel p-4 space-y-3">
      <h2 className="ws-h2">Delivery and renewal</h2>
      {details && (
        <dl>
          <dt className="ws-label">Home delivery address</dt>
          <dd>{details.home_address}</dd>
          <dt className="ws-label mt-2">Business address</dt>
          <dd>{details.business_address}</dd>
        </dl>
      )}
      <label className="ws-label block">
        Contract end date
        <input
          className="ws-input mt-1"
          type="date"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
        />
      </label>
      <button
        type="button"
        className="ws-btn"
        disabled={busy || !end || end === pending?.term_end}
        onClick={() => save("pending")}
      >
        Save term end
      </button>
      {pending && end === pending.term_end && (
        <div>
          <p className="ws-caption">
            Eimear checks with Marc one week before the term ends. Record his
            decision here.
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {(["renew_term", "monthly"] as const).map((d) => (
              <button
                key={d}
                type="button"
                className="ws-btn"
                disabled={busy}
                onClick={() => save(d)}
              >
                {labels[d]}
              </button>
            ))}
          </div>
        </div>
      )}
      {terms
        .filter((t) => t.decision !== "pending")
        .map((t) => (
          <p className="ws-caption" key={t.term_end}>
            {t.term_end} · {labels[t.decision]}
          </p>
        ))}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
