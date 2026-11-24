"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type {
  AttentionItem,
  AttentionResult,
} from "@/lib/ops/business-attention";

function Action({ item }: { item: AttentionItem }) {
  return (
    <li>
      <Link
        href={item.href}
        className="flex justify-between items-center gap-3 px-4 py-3 ws-focus hover:bg-[var(--ws-hover)]"
      >
        <span className="min-w-0">
          <strong className="block text-sm">{item.title}</strong>
          <span className="ws-caption">{item.reason}</span>
        </span>
        <span aria-hidden="true" className="ws-link">
          →
        </span>
      </Link>
    </li>
  );
}

export default function AttentionCard({ revision }: { revision: number }) {
  const [result, setResult] = useState<AttentionResult>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const request = new AbortController();
    fetch("/api/admin/business-attention", {
      cache: "no-store",
      signal: request.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((data) => {
        if (!request.signal.aborted) {
          setResult(data);
          setFailed(false);
        }
      })
      .catch(() => {
        if (!request.signal.aborted) setFailed(true);
      });
    return () => request.abort();
  }, [revision]);
  const items = result?.items ?? [];
  return (
    <section className="ws-panel" aria-label="Needs Marc’s attention">
      <div className="ws-panel-head">
        <h2 className="ws-h2">Needs Marc’s attention</h2>
      </div>
      {failed && (
        <p role="status" className="ws-meta p-4">
          Could not update the attention list. Use Refresh to try again.
        </p>
      )}
      {result?.unavailable.length ? (
        <p role="status" className="ws-meta p-4">
          Awaiting records from {result.unavailable.join(", ")}.
        </p>
      ) : null}
      {!result && !failed && (
        <p className="ws-meta p-4">
          Checking tasks, calls and coaching replies…
        </p>
      )}
      {result && !failed && !items.length && !result.unavailable.length && (
        <p className="ws-meta p-4">
          Marc has no outstanding decisions, call outcomes or coaching replies.
        </p>
      )}
      {items.length > 0 && (
        <ul className="divide-y divide-[var(--ws-line)]">
          {items.slice(0, 5).map((item) => (
            <Action key={item.id} item={item} />
          ))}
        </ul>
      )}
      {items.length > 5 && (
        <details>
          <summary className="cursor-pointer ws-link px-4 py-3">
            Show {items.length - 5} more
          </summary>
          <ul className="divide-y divide-[var(--ws-line)]">
            {items.slice(5).map((item) => (
              <Action key={item.id} item={item} />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
