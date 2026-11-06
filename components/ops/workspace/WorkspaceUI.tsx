"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { areaLabels, ownerLabels } from "@/lib/ops/workspace";
import type { OpsTask } from "@/lib/ops/types";
import type { WorkspaceCard, WorkspaceResult } from "@/lib/ops/workspace-types";

/* ---------- Icons ---------- */

const paths: Record<string, string> = {
  refresh: "M20 11a8 8 0 0 0-14.9-4M4 4v4h4M4 13a8 8 0 0 0 14.9 4M20 20v-4h-4",
  plus: "M12 5v14M5 12h14",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-3.5-3.5",
  chevron: "m9 6 6 6-6 6",
  arrow: "M5 12h14M13 6l6 6-6 6",
  external: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  close: "M6 6l12 12M18 6 6 18",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z",
  shield: "M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Zm-3 9 2 2 4-4",
  alert: "M12 9v4M12 17h.01M10.3 4.3 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z",
  info: "M12 8h.01M11 12h1v5h1M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
  check: "m5 12 5 5L20 7",
  checkCircle: "M8 12.5 11 15l5-6M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
  pulse: "M3 12h4l2-6 4 12 2-6h6",
  sparkle: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6",
  clock: "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
  // areas
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
  // reports
  daily_brief: "M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  sales_review: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1Z",
  weekly_report: "M5 20V10M12 20V4M19 20v-7",
  portal_check: "M3 12h4l2-6 4 12 2-6h6",
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
export function fullDate(value: string | null) {
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
export function when(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Not recorded";
  const d = new Date(value);
  const now = new Date();
  const time = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: london,
  });
  if (dayKey(d) === dayKey(now)) return `Today ${time}`;
  if (dayKey(d) === dayKey(new Date(now.getTime() - 864e5)))
    return `Yesterday ${time}`;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: london,
  });
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

export function Avatar({
  owner,
  size,
}: {
  owner: Owner;
  size?: "sm" | "md";
}) {
  const initial =
    owner === "system" ? (
      <Icon name="sparkle" size={size === "sm" ? 12 : 15} stroke={2.2} />
    ) : (
      ownerLabels[owner][0]
    );
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

/* ---------- Segmented control with a sliding glass thumb ---------- */

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
  const wrap = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ x: number; w: number } | null>(null);
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const place = () => {
      const active = el.querySelector<HTMLElement>(`[data-seg="${value}"]`);
      if (active) setThumb({ x: active.offsetLeft, w: active.offsetWidth });
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(el);
    return () => ro.disconnect();
  }, [value, options.length]);
  return (
    <div
      ref={wrap}
      role="group"
      aria-label={label}
      className={`ws-seg ${className}`}
    >
      {thumb && (
        <span
          className="ws-seg-thumb"
          style={{ width: thumb.w, transform: `translateX(${thumb.x}px)` }}
        />
      )}
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          data-seg={o.value}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className="ws-seg-btn ws-focus"
        >
          {o.label}
          {o.count !== undefined && (
            <span className="ws-seg-count">
              <span key={o.count} className="ws-pop">
                {o.count}
              </span>
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ---------- Task row ---------- */

export function cardTone(card: WorkspaceCard) {
  if (card.history) return "neutral";
  if (card.approval) return "decide";
  if (card.attention) return "attn";
  return "neutral";
}

export function TaskRow({
  card,
  index,
  onOpen,
}: {
  card: WorkspaceCard;
  index: number;
  onOpen: (card: WorkspaceCard) => void;
}) {
  const tone = cardTone(card);
  return (
    <button
      type="button"
      onClick={() => onOpen(card)}
      className="ws-row ws-rise ws-focus"
      style={{ "--i": Math.min(index, 10) } as CSSProperties}
    >
      <span
        className="ws-area"
        style={{ "--a": areaColour[card.area] } as CSSProperties}
      >
        <Icon name={card.area} size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="ws-row-title">{card.title}</span>
        {card.next && <span className="ws-row-next">{card.next}</span>}
        <span className="ws-row-meta">
          <span className={`ws-chip is-${tone}`}>{card.state}</span>
          <span>{areaLabels[card.area]}</span>
          <span aria-hidden="true">·</span>
          <span title={fullDate(card.observed_at)}>{when(card.observed_at)}</span>
        </span>
      </span>
      <Icon name="chevron" size={16} className="ws-row-chev" />
    </button>
  );
}

/* ---------- Lane ---------- */

type Group = { key: string; label: string; tone: string; cards: WorkspaceCard[] };

function groupCards(cards: WorkspaceCard[], history: boolean): Group[] {
  if (history)
    return [{ key: "history", label: "Completed & closed", tone: "neutral", cards }];
  return [
    { key: "decide", label: "Decide", tone: "decide", cards: cards.filter((c) => c.approval) },
    {
      key: "attn",
      label: "Follow up",
      tone: "attn",
      cards: cards.filter((c) => !c.approval && c.attention),
    },
    {
      key: "rest",
      label: "On the list",
      tone: "neutral",
      cards: cards.filter((c) => !c.approval && !c.attention),
    },
  ].filter((g) => g.cards.length);
}

const toneColour: Record<string, string> = {
  decide: "var(--ws-decide)",
  attn: "var(--ws-attn)",
  neutral: "var(--ws-ink-3)",
};

function GroupList({
  group,
  onOpen,
}: {
  group: Group;
  onOpen: (card: WorkspaceCard) => void;
}) {
  const [limit, setLimit] = useState(5);
  const shown = group.cards.slice(0, limit);
  return (
    <div className="pb-2">
      <div className="ws-group-label">
        <span className="ws-dot" style={{ color: toneColour[group.tone] }} />
        {group.label}
        <span className="font-semibold opacity-70">{group.cards.length}</span>
      </div>
      {shown.map((c, i) => (
        <TaskRow key={c.id} card={c} index={i} onOpen={onOpen} />
      ))}
      {group.cards.length > limit && (
        <button
          type="button"
          className="ws-more ws-focus"
          onClick={() => setLimit((n) => n + 10)}
        >
          Show {Math.min(10, group.cards.length - limit)} more
          <span className="opacity-60">
            of {group.cards.length - limit}
          </span>
        </button>
      )}
    </div>
  );
}

export function Lane({
  laneKey,
  title,
  subtitle,
  owner,
  cards,
  allCards,
  history,
  active,
  incomplete,
  loading,
  onOpen,
  className = "",
}: {
  laneKey: "marc" | "eimear" | "team";
  title: string;
  subtitle: string;
  owner: Owner;
  cards: WorkspaceCard[];
  allCards: WorkspaceCard[];
  history: boolean;
  active: boolean;
  incomplete: boolean;
  loading: boolean;
  onOpen: (card: WorkspaceCard) => void;
  className?: string;
}) {
  const decide = allCards.filter((c) => !c.history && c.approval).length;
  const attn = allCards.filter((c) => !c.history && !c.approval && c.attention).length;
  const groups = groupCards(cards, history);
  return (
    <section
      className={`ws-lane ws-glass ${className}`}
      data-owner={laneKey}
      data-active={active}
      aria-labelledby={`lane-${laneKey}`}
    >
      <div className="ws-lane-glow" />
      <header className="ws-lane-head">
        <Avatar owner={owner} />
        <div className="min-w-0 flex-1">
          <h2 id={`lane-${laneKey}`} className="ws-lane-name">
            {title}
          </h2>
          <p className="ws-caption truncate">{subtitle}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          {decide > 0 && (
            <span className="ws-chip is-decide">
              <span key={decide} className="ws-pop">{decide}</span> to decide
            </span>
          )}
          {attn > 0 && (
            <span className="ws-chip is-attn">
              <span key={attn} className="ws-pop">{attn}</span> follow up
            </span>
          )}
        </div>
      </header>
      {loading ? (
        <div className="space-y-4 p-5" role="status" aria-label="Loading tasks">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="ws-skel h-[34px] w-[34px] flex-none" />
              <div className="flex-1 space-y-2">
                <div className="ws-skel h-3.5 w-4/5" />
                <div className="ws-skel h-3 w-3/5" />
              </div>
            </div>
          ))}
        </div>
      ) : groups.length ? (
        groups.map((g) => <GroupList key={`${g.key}-${history}`} group={g} onOpen={onOpen} />)
      ) : (
        <div className="ws-empty" style={{ "--c": incomplete ? "var(--ws-attn)" : "var(--ws-ok)" } as CSSProperties}>
          <span className="ws-empty-orb">
            <Icon name={incomplete ? "alert" : "checkCircle"} size={22} />
          </span>
          <p className="font-semibold">
            {incomplete ? "Nothing to show yet" : history ? "No closed work here" : "All clear"}
          </p>
          <p className="ws-caption max-w-xs">
            {incomplete
              ? "Some sources haven’t been checked successfully, so this list may be missing items."
              : "Nothing matches this view. Try another filter or search."}
          </p>
        </div>
      )}
    </section>
  );
}

/* ---------- Codex report tile ---------- */

export const outcomeMeta: Record<
  WorkspaceResult["outcome"],
  { label: string; colour: string }
> = {
  complete: { label: "Information checked", colour: "var(--ws-ok)" },
  partial: { label: "Information missing", colour: "var(--ws-attn)" },
  failed: { label: "Couldn’t finish checking", colour: "var(--ws-bad)" },
};
