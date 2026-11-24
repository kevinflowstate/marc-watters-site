"use client";
import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import type { AttentionItem, AttentionResult } from "@/lib/ops/business-attention";
import { Icon } from "./workspace/WorkspaceUI";

function kind(item: AttentionItem): { icon: string; color: string } {
  if (item.id.startsWith("call:")) return { icon: "target", color: "var(--ws-ok)" };
  if (item.id.endsWith(":message")) return { icon: "chat", color: "var(--ws-accent-ink)" };
  if (item.id.endsWith(":checkin")) return { icon: "checkCircle", color: "var(--ws-eimear)" };
  if (item.href.startsWith("/admin/events")) return { icon: "events", color: "var(--ws-attn)" };
  return { icon: "flag", color: "var(--ws-decide)" };
}

function Action({ item, index }: { item: AttentionItem; index: number }) {
  const { icon, color } = kind(item);
  return (
    <li>
      <Link href={item.href} className="lg-q ws-focus" style={{ "--i": index, "--c": color } as CSSProperties}>
        <span className="lg-q-ic" aria-hidden="true">
          <Icon name={icon} size={16} />
        </span>
        <span className="min-w-0">
          <span className="lg-q-t block">{item.title}</span>
          <span className="lg-q-r block">{item.reason}</span>
        </span>
        <span aria-hidden="true" className="lg-q-go">
          <Icon name="chevron" size={14} />
        </span>
      </Link>
    </li>
  );
}

export default function AttentionCard({ revision, index = 0 }: { revision: number; index?: number }) {
  const [result, setResult] = useState<AttentionResult>();
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const request = new AbortController();
    fetch("/api/admin/business-attention", { cache: "no-store", signal: request.signal })
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
  const shown = expanded ? items : items.slice(0, 5);
  return (
    <section
      className="lg-card lg-rise min-w-0"
      style={{ "--i": index } as CSSProperties}
      aria-label="Needs Marc’s attention"
    >
      <div className="lg-card-head">
        <div className="min-w-0">
          <h2>Needs Marc’s attention</h2>
          <p className="lg-sub">Decisions, call outcomes and coaching replies</p>
        </div>
        {items.length > 0 && <span className="lg-count">{items.length}</span>}
      </div>
      {failed && (
        <div role="status" className="ws-note is-attn m-4">
          <Icon name="alert" size={15} />
          <span>Could not update the attention list. Use Refresh to try again.</span>
        </div>
      )}
      {result?.unavailable?.length ? (
        <p role="status" className="ws-caption px-[18px] pt-3">
          Awaiting records from {result.unavailable?.join(", ")}.
        </p>
      ) : null}
      {!result && !failed && (
        <div className="p-3" role="status" aria-label="Checking tasks, calls and coaching replies">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 p-2.5">
              <div className="lg-skel" style={{ width: 32, height: 32, borderRadius: 10 }} />
              <div className="flex-1">
                <div className="lg-skel" style={{ height: 11, width: "60%" }} />
                <div className="lg-skel mt-2" style={{ height: 9, width: "40%" }} />
              </div>
            </div>
          ))}
        </div>
      )}
      {result && !failed && !items.length && !result.unavailable?.length && (
        <div className="lg-clear">
          <span className="lg-q-ic" aria-hidden="true">
            <Icon name="check" size={16} />
          </span>
          <span>All clear. Marc has no outstanding decisions, call outcomes or coaching replies.</span>
        </div>
      )}
      {items.length > 0 && (
        <ul className="lg-queue">
          {shown.map((item, i) => (
            <Action key={item.id} item={item} index={i} />
          ))}
          {items.length > 5 && (
            <li>
              <button type="button" className="lg-more ws-focus" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
                {expanded ? "Show fewer" : `Show ${items.length - 5} more`}
              </button>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
