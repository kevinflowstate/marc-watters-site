"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { areaLabels, ownerLabels } from "@/lib/ops/workspace";
import type { OpsTask } from "@/lib/ops/types";
import type { WorkspaceCard, WorkspaceResult } from "@/lib/ops/workspace-types";

/* ---------- Icons ---------- */

const paths: Record<string, string> = {
  refresh: "M20 11a8 8 0 0 0-14.9-4M4 4v4h4M4 13a8 8 0 0 0 14.9 4M20 20v-4h-4",
  plus: "M12 5v14M5 12h14",
  chevron: "m9 6 6 6-6 6",
  arrow: "M5 12h14M13 6l6 6-6 6",
  external: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  close: "M6 6l12 12M18 6 6 18",
  alert: "M12 9v4M12 17h.01M10.3 4.3 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z",
  info: "M12 8h.01M11 12h1v5h1M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
  check: "m5 12 5 5L20 7",
  checkCircle: "M8 12.5 11 15l5-6M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
  sparkle: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6",
  clock: "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  content: "M4 5h16v14H4zM4 15l4.5-4.5 4 4 2.5-2.5L20 17M15 9h.01",
  lessons: "M5 4.5v15l14-7.5L5 4.5Z",
  payments: "M3 7h18v10H3zM3 11h18M7 15h3",
  onboarding: "M15 19v-1a5 5 0 0 0-10 0v1M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM19 8v6M16 11h6",
  engagement: "M4 5h16v11H9l-5 4V5Zm5 5h.01M12 10h.01M15 10h.01",
  inbox: "M4 13h4l2 3h4l2-3h4M4 13l2.5-8h11L20 13v6H4v-6Z",
  finance: "M15 6.5a4 4 0 0 0-6.5 3V14M7 14h7M7 18h10M8 11h5",
  events: "M7 3v3M17 3v3M4 8h16M5 5h14v15H5z",
  reporting: "M5 20V10M12 20V4M19 20v-7",
  other: "M5 12h.01M12 12h.01M19 12h.01",
  daily_brief: "M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  sales_review: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1Z",
  weekly_report: "M5 20V10M12 20V4M19 20v-7",
  portal_check: "M3 12h4l2-6 4 12 2-6h6",
  plug: "M9 2v5M15 2v5M6 7h12v4a6 6 0 0 1-12 0V7ZM12 17v5",
};

export function Icon({
  name,
  size = 18,
  className,
  stroke = 1.8,
}: {
  name: string;
  size?: number;
  className?: string;
  stroke?: number;
}) {
  const d = paths[name] ?? paths.other;
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={d} />
    </svg>
  );
}

/* ---------- Formatting ---------- */

const london = "Europe/London";
function dayKey(d: Date) {
  return d.toLocaleDateString("en-GB", { timeZone: london });
}
export function fullDate(value: string | null | undefined) {
  return value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: london,
      })
    : "Not recorded";
}
export function when(value: string | null | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) return "";
  const d = new Date(value);
  const now = new Date();
  const time = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: london,
  });
  if (dayKey(d) === dayKey(now)) return time;
  if (dayKey(d) === dayKey(new Date(now.getTime() - 864e5))) return `Yesterday ${time}`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: london });
}

/* ---------- Colours ---------- */

export const areaColour: Record<OpsTask["area"], string> = {
  content: "#a78bfa",
  lessons: "#60a5fa",
  payments: "#f5b84d",
  onboarding: "#3fd0b8",
  engagement: "#f472b6",
  inbox: "#7dd3fc",
  finance: "#4fd98a",
  events: "#fb923c",
  reporting: "#93a4ff",
  other: "#a3abc2",
};

export type Owner = WorkspaceCard["owner"];
export const ownerColour: Record<Owner, string> = {
  marc: "var(--ws-marc)",
  eimear: "var(--ws-eimear)",
  flowstate: "var(--ws-team)",
  system: "var(--ws-team)",
};

export function Avatar({ owner, size }: { owner: Owner; size?: "sm" }) {
  const initial =
    owner === "system" ? <Icon name="sparkle" size={size === "sm" ? 11 : 13} stroke={2.2} /> : ownerLabels[owner][0];
  return (
    <span
      aria-hidden="true"
      className={`ws-avatar ${size ? `is-${size}` : ""}`}
      style={{ "--c": ownerColour[owner] } as CSSProperties}
    >
      {initial}
    </span>
  );
}

/* ---------- Segmented ---------- */

export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
  className = "",
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode; count?: number }[];
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={`ws-seg ${className}`}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className="ws-seg-btn ws-focus"
        >
          {o.label}
          {o.count !== undefined && o.count > 0 && <span className="ws-seg-count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ---------- Chip ---------- */

export function Chip({ tone, children }: { tone?: "decide" | "attn" | "ok" | "bad"; children: ReactNode }) {
  return <span className={`ws-chip ${tone ? `is-${tone}` : ""}`}>{children}</span>;
}

/* ---------- Rows ---------- */

export function cardTone(card: WorkspaceCard): "decide" | "attn" | undefined {
  if (card.history) return undefined;
  if (card.approval) return "decide";
  if (card.attention) return "attn";
  return undefined;
}

export function Row({
  tone,
  title,
  sub,
  area,
  areaColour: areaTint,
  chip,
  chipTone,
  time,
  onOpen,
}: {
  tone?: "decide" | "attn" | "ok" | "closed";
  title: string;
  sub?: string;
  area?: string;
  areaColour?: string;
  chip?: string;
  chipTone?: "decide" | "attn" | "ok" | "bad";
  time?: string;
  onOpen: () => void;
}) {
  return (
    <button type="button" onClick={onOpen} className="ws-row ws-focus">
      <span className={`ws-status ${tone ? `is-${tone}` : ""}`} aria-hidden="true" />
      <span className="min-w-0">
        <span className="ws-row-title">{title}</span>
        {sub && <span className="ws-row-sub">{sub}</span>}
      </span>
      <span className="ws-row-meta">
        {chip && <Chip tone={chipTone}>{chip}</Chip>}
        {area && (
          <span className="ws-tag">
            <span className="ws-dot" style={{ color: areaTint }} />
            {area}
          </span>
        )}
        {time && <span className="ws-row-time">{time}</span>}
      </span>
    </button>
  );
}

/** Generic instructions the feed attaches to every task; they belong in the drawer, not the row. */
const boilerplate = /^(Open the task|Review the linked work|Open the report|Open the saved version|Open the client)/;

export function CardRow({ card, onOpen }: { card: WorkspaceCard; onOpen: (card: WorkspaceCard) => void }) {
  const tone = card.history ? "closed" : cardTone(card);
  const sub = card.next && !boilerplate.test(card.next) ? card.next : undefined;
  return (
    <Row
      tone={tone}
      title={card.title}
      sub={sub}
      area={areaLabels[card.area]}
      areaColour={areaColour[card.area]}
      chip={tone === "attn" ? card.state : undefined}
      chipTone={tone === "attn" ? "attn" : undefined}
      time={when(card.observed_at)}
      onOpen={() => onOpen(card)}
    />
  );
}

/* ---------- Lane ---------- */

type Group = { key: string; label: string; tone: string; cards: WorkspaceCard[] };

function groupCards(cards: WorkspaceCard[], history: boolean): Group[] {
  if (history) return [{ key: "history", label: "Closed", tone: "var(--ws-ink-3)", cards }];
  return [
    { key: "decide", label: "Decide", tone: "var(--ws-decide)", cards: cards.filter((c) => c.approval) },
    { key: "attn", label: "Follow up", tone: "var(--ws-attn)", cards: cards.filter((c) => !c.approval && c.attention) },
    { key: "rest", label: "Open", tone: "var(--ws-ink-3)", cards: cards.filter((c) => !c.approval && !c.attention) },
  ].filter((g) => g.cards.length);
}

function GroupList({ group, onOpen, limit: initial }: { group: Group; onOpen: (card: WorkspaceCard) => void; limit: number }) {
  const [limit, setLimit] = useState(initial);
  const shown = group.cards.slice(0, limit);
  return (
    <div>
      <div className="ws-group">
        <span className="ws-dot" style={{ color: group.tone }} />
        {group.label}
        <span className="opacity-70">{group.cards.length}</span>
      </div>
      {shown.map((c) => (
        <CardRow key={c.id} card={c} onOpen={onOpen} />
      ))}
      {group.cards.length > limit && (
        <button type="button" className="ws-more ws-focus" onClick={() => setLimit((n) => n + 10)}>
          Show {Math.min(10, group.cards.length - limit)} more
        </button>
      )}
    </div>
  );
}

export function Lane({
  title,
  owner,
  cards,
  history,
  loading,
  onOpen,
  limit = 6,
}: {
  title: string;
  owner: Owner;
  cards: WorkspaceCard[];
  history: boolean;
  loading: boolean;
  onOpen: (card: WorkspaceCard) => void;
  limit?: number;
}) {
  const decide = cards.filter((c) => !c.history && c.approval).length;
  const attn = cards.filter((c) => !c.history && !c.approval && c.attention).length;
  const groups = groupCards(cards, history);
  return (
    <section className="ws-panel min-w-0 overflow-hidden" aria-label={`${title}'s work`}>
      <header className="ws-panel-head">
        <Avatar owner={owner} />
        <h2 className="ws-h2 min-w-0 flex-1 truncate">{title}</h2>
        {decide > 0 && <Chip tone="decide">{decide} to decide</Chip>}
        {attn > 0 && <Chip tone="attn">{attn} follow up</Chip>}
        {!decide && !attn && !loading && cards.length > 0 && <span className="ws-caption">{cards.length}</span>}
      </header>
      {loading ? (
        <div className="space-y-3 p-4" role="status" aria-label="Loading">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="ws-skel h-7 w-7 flex-none" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="ws-skel h-3 w-3/4" />
                <div className="ws-skel h-2.5 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : groups.length ? (
        groups.map((g) => <GroupList key={`${g.key}-${history}`} group={g} onOpen={onOpen} limit={limit} />)
      ) : (
        <p className="ws-empty">{history ? "Nothing closed yet." : "Nothing waiting."}</p>
      )}
    </section>
  );
}

/* ---------- Codex result meta ---------- */

export const outcomeMeta: Record<WorkspaceResult["outcome"], { label: string; tone: "ok" | "attn" | "bad" }> = {
  complete: { label: "Checked", tone: "ok" },
  partial: { label: "Information missing", tone: "attn" },
  failed: { label: "Could not finish", tone: "bad" },
};
