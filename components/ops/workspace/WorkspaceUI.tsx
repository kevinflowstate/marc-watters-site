"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { areaLabels, isClosed, ownerLabels } from "@/lib/ops/workspace";
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
  circle: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
  sparkle: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6",
  clock: "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
  history: "M12 7v5l3 2M3.5 12a8.5 8.5 0 1 0 2.5-6M3 3v5h5",
  calendar: "M7 3v3M17 3v3M4 8h16M5 5h14v15H5z",
  owner: "M15 19v-1a5 5 0 0 0-10 0v1M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z",
  tag: "M20 12l-8 8-8-8V4h8l8 8ZM8 8h.01",
  flag: "M5 21V4h11l-1.5 4L16 12H5",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  inboxEmpty: "M4 13h4l2 3h4l2-3h4M4 13l2.5-8h11L20 13v6H4v-6Z",
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

/* ---------- Dates ---------- */

const london = "Europe/London";
const valid = (value: string | null | undefined): value is string => !!value && Number.isFinite(Date.parse(value));
/** Whole days since the epoch, counted in London so "today" flips at local midnight. */
function londonDay(d: Date) {
  const [y, m, day] = d.toLocaleDateString("en-CA", { timeZone: london }).split("-").map(Number);
  return Date.UTC(y, m - 1, day) / 864e5;
}
export function dayDiff(value: string, now = new Date()) {
  return londonDay(new Date(value)) - londonDay(now);
}
const weekday = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "short", timeZone: london });
const shortDate = (d: Date, now = new Date()) =>
  d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
    timeZone: london,
  });

export function fullDate(value: string | null | undefined) {
  return valid(value)
    ? new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: london })
    : "Not recorded";
}

/** How long ago, the way a feed reads it: just now, 12m ago, 2h ago, Yesterday, Mon, 18 Nov. */
export function when(value: string | null | undefined, now = new Date()) {
  if (!valid(value)) return "";
  const d = new Date(value);
  const days = dayDiff(value, now);
  if (days > 0) return shortDate(d, now);
  const mins = Math.round((now.getTime() - d.getTime()) / 6e4);
  if (days === 0) {
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    return `${Math.round(mins / 60)}h ago`;
  }
  if (days === -1) return "Yesterday";
  if (days > -7) return weekday(d);
  return shortDate(d, now);
}

/** Due date the way a task list reads it: Overdue, Today, Tomorrow, a weekday this week, then the date. */
export function dueLabel(value: string | null | undefined, now = new Date()): { text: string; tone?: "attn" | "bad" } | null {
  if (!valid(value)) return null;
  const d = new Date(value);
  const days = dayDiff(value, now);
  if (days < 0) return { text: "Overdue", tone: "bad" };
  if (days === 0) return { text: "Today", tone: "attn" };
  if (days === 1) return { text: "Tomorrow" };
  if (days < 7) return { text: weekday(d) };
  return { text: shortDate(d, now) };
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
    <span aria-hidden="true" className={`ws-avatar ${size ? `is-${size}` : ""}`} style={{ "--c": ownerColour[owner] } as CSSProperties}>
      {initial}
    </span>
  );
}

/* ---------- Status ---------- */

export type Tone = "open" | "decide" | "attn" | "running" | "ok" | "closed";
const toneColour: Record<Tone, string> = {
  open: "var(--ws-ink-4)",
  decide: "var(--ws-decide)",
  attn: "var(--ws-attn)",
  running: "var(--ws-accent-ink)",
  ok: "var(--ws-ok)",
  closed: "var(--ws-ink-4)",
};

/** One glyph per state: hollow is open, a ring with a dot waits on a decision, half full needs a look, full with a tick is finished. */
export function StatusIcon({ tone = "open", size = 14 }: { tone?: Tone; size?: number }) {
  const c = toneColour[tone];
  let inner: ReactNode;
  if (tone === "ok" || tone === "closed")
    inner = (
      <>
        <circle cx="7" cy="7" r="6.2" fill={c} />
        <path d="M4.4 7.2 6.2 9 9.7 5.3" fill="none" stroke="var(--ws-panel)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </>
    );
  else if (tone === "attn" || tone === "running")
    inner = (
      <>
        <circle cx="7" cy="7" r="5.4" fill="none" stroke={c} strokeWidth="1.5" />
        <path d="M7 3.4A3.6 3.6 0 0 1 7 10.6Z" fill={c} />
      </>
    );
  else if (tone === "decide")
    inner = (
      <>
        <circle cx="7" cy="7" r="5.4" fill="none" stroke={c} strokeWidth="1.5" />
        <circle cx="7" cy="7" r="2.3" fill={c} />
      </>
    );
  else inner = <circle cx="7" cy="7" r="5.4" fill="none" stroke={c} strokeWidth="1.5" />;
  return (
    <svg className="ws-status-ic" width={size} height={size} viewBox="0 0 14 14" aria-hidden="true">
      {inner}
    </svg>
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
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)} className="ws-seg-btn ws-focus">
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

/* ---------- Empty and loading ---------- */

export function Empty({ icon = "checkCircle", title, text }: { icon?: string; title: string; text?: string }) {
  return (
    <div className="ws-empty">
      <span className="ws-empty-glyph">
        <Icon name={icon} size={20} />
      </span>
      <p className="ws-empty-h">{title}</p>
      {text && <p>{text}</p>}
    </div>
  );
}

export function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="ws-skrow">
          <span className="ws-skel" style={{ width: 14, height: 14, borderRadius: "50%" }} />
          <span className="ws-skel" style={{ width: `${38 + ((i * 13) % 30)}%`, height: 10 }} />
          <span className="flex-1" />
          <span className="ws-skel" style={{ width: 54, height: 10 }} />
        </div>
      ))}
    </div>
  );
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
  timeTone,
  onOpen,
}: {
  tone?: Tone;
  title: string;
  sub?: string;
  area?: string;
  areaColour?: string;
  chip?: string;
  chipTone?: "decide" | "attn" | "ok" | "bad";
  time?: string;
  timeTone?: "attn" | "bad";
  onOpen: () => void;
}) {
  return (
    <button type="button" onClick={onOpen} className="ws-row ws-focus">
      <StatusIcon tone={tone ?? "open"} />
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
        {time && <span className={`ws-row-time ${timeTone ? `is-${timeTone}` : ""}`}>{time}</span>}
      </span>
    </button>
  );
}

/** Generic instructions the feed attaches to every task; they belong in the drawer, not the row. */
const boilerplate = /^(Open the task|Review the linked work|Open the report|Open the saved version|Open the client)/;
export const isBoilerplate = (text: string | null | undefined) => !text || boilerplate.test(text);

export type RowToggle = { done: boolean; busy?: boolean; onToggle: () => void };

export function CardRow({
  card,
  onOpen,
  carried,
  toggle,
}: {
  card: WorkspaceCard;
  onOpen: (card: WorkspaceCard) => void;
  /** Open since before this week began. */
  carried?: boolean;
  /** Tick to complete (or untick to reopen) without opening the drawer. */
  toggle?: RowToggle;
}) {
  const tone = card.history ? "closed" : cardTone(card);
  const sub = card.next && !boilerplate.test(card.next) ? card.next : undefined;
  const due = card.history ? null : dueLabel(card.due_at);
  const chip = carried ? "Carried over" : tone === "attn" ? card.state : undefined;
  const row = (
    <Row
      tone={tone}
      title={card.title}
      sub={sub}
      area={areaLabels[card.area]}
      areaColour={areaColour[card.area]}
      chip={chip}
      chipTone={carried ? undefined : tone === "attn" ? "attn" : undefined}
      time={due ? due.text : when(card.observed_at)}
      timeTone={due?.tone}
      onOpen={() => onOpen(card)}
    />
  );
  if (!toggle) return row;
  return (
    <div className={`ws-tickrow ${toggle.done ? "is-done" : ""}`}>
      {row}
      <button
        type="button"
        className="ws-tick ws-focus"
        disabled={toggle.busy}
        aria-pressed={toggle.done}
        aria-label={toggle.done ? `Mark "${card.title}" as not done` : `Mark "${card.title}" as done`}
        title={toggle.done ? "Mark as not done" : "Mark as done"}
        onClick={(e) => {
          e.stopPropagation();
          toggle.onToggle();
        }}
      >
        <StatusIcon tone={toggle.done ? "closed" : "open"} />
        {!toggle.done && <span className="ws-tick-hint" aria-hidden="true"><Icon name="check" size={10} stroke={2.6} /></span>}
      </button>
    </div>
  );
}

/* ---------- Lane ---------- */

type Group = { key: string; label: string; tone: string; cards: WorkspaceCard[] };

export type LaneRowOptions = {
  carried?: (card: WorkspaceCard) => boolean;
  toggle?: (card: WorkspaceCard) => RowToggle | undefined;
};

function groupCards(cards: WorkspaceCard[], history: boolean): Group[] {
  if (history) return [{ key: "history", label: "Closed", tone: "var(--ws-ink-4)", cards }];
  return [
    { key: "decide", label: "Decide", tone: "var(--ws-decide)", cards: cards.filter((c) => c.approval) },
    { key: "attn", label: "Follow up", tone: "var(--ws-attn)", cards: cards.filter((c) => !c.approval && c.attention) },
    { key: "rest", label: "Open", tone: "var(--ws-ink-4)", cards: cards.filter((c) => !c.approval && !c.attention) },
  ].filter((g) => g.cards.length);
}

function GroupList({
  group,
  onOpen,
  limit: initial,
  rows,
}: {
  group: Group;
  onOpen: (card: WorkspaceCard) => void;
  limit: number;
  rows?: LaneRowOptions;
}) {
  const [limit, setLimit] = useState(initial);
  const shown = group.cards.slice(0, limit);
  return (
    <div>
      <div className="ws-group">
        <span className="ws-dot" style={{ color: group.tone }} />
        {group.label}
        <span className="ws-cnt">{group.cards.length}</span>
      </div>
      {shown.map((c) => (
        <CardRow key={c.id} card={c} onOpen={onOpen} carried={rows?.carried?.(c)} toggle={rows?.toggle?.(c)} />
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
  completed = [],
  rows,
}: {
  title: string;
  owner: Owner;
  cards: WorkspaceCard[];
  history: boolean;
  loading: boolean;
  onOpen: (card: WorkspaceCard) => void;
  limit?: number;
  /** Tasks completed this week: listed under "Completed" below the open work until Sunday night. */
  completed?: WorkspaceCard[];
  rows?: LaneRowOptions;
}) {
  const decide = cards.filter((c) => !c.history && c.approval).length;
  const attn = cards.filter((c) => !c.history && !c.approval && c.attention).length;
  const groups = groupCards(cards, history);
  const done: Group | null = !history && completed.length ? { key: "done", label: "Completed this week", tone: "var(--ws-ok)", cards: completed } : null;
  return (
    <section className="ws-panel min-w-0 overflow-hidden" aria-label={`${title}'s work`}>
      <header className="ws-panel-head">
        <Avatar owner={owner} />
        <h2 className="ws-h2 min-w-0 flex-1 truncate">{title}</h2>
        {decide > 0 && <Chip tone="decide">{decide} to decide</Chip>}
        {attn > 0 && <Chip tone="attn">{attn} follow up</Chip>}
        {!decide && !attn && !loading && cards.length > 0 && <span className="ws-caption">{cards.length} open</span>}
      </header>
      {loading ? (
        <SkeletonRows count={4} />
      ) : (
        <>
          {groups.length ? (
            groups.map((g) => <GroupList key={`${g.key}-${history}`} group={g} onOpen={onOpen} limit={limit} rows={rows} />)
          ) : history ? (
            <Empty icon="history" title="Nothing closed yet" text="Finished work will be kept here." />
          ) : (
            <Empty title="All clear" text={`Nothing is waiting on ${title}.`} />
          )}
          {done && <div className="ws-done-group"><GroupList key="done" group={done} onOpen={onOpen} limit={limit} rows={rows} /></div>}
        </>
      )}
    </section>
  );
}

/* ---------- Coming up ---------- */

type DueGroup = { key: string; label: string; bad?: boolean; tasks: OpsTask[] };

export function UpcomingPanel({ tasks, loading, onOpen }: { tasks: OpsTask[]; loading: boolean; onOpen: (taskId: string) => void }) {
  const now = new Date();
  const open = tasks.filter((t) => !isClosed(t) && valid(t.due_at)).sort((a, b) => Date.parse(a.due_at!) - Date.parse(b.due_at!));
  const inRange = (lo: number, hi: number) => open.filter((t) => { const n = dayDiff(t.due_at!, now); return n >= lo && n <= hi; });
  const all: DueGroup[] = [
    { key: "overdue", label: "Overdue", bad: true, tasks: inRange(-9999, -1) },
    { key: "today", label: "Today", tasks: inRange(0, 0) },
    { key: "tomorrow", label: "Tomorrow", tasks: inRange(1, 1) },
    { key: "week", label: "This week", tasks: inRange(2, 7) },
  ];
  // Today always shows; the other groups only when something is in them, so a quiet week is one line, not four.
  const groups = all.filter((g) => g.key === "today" || g.tasks.length);
  const total = groups.reduce((n, g) => n + g.tasks.length, 0);
  return (
    <section className="ws-panel overflow-hidden" aria-label="Coming up">
      <header className="ws-panel-head">
        <h2 className="ws-h2 flex-1">Coming up</h2>
        {!loading && total > 0 && <span className="ws-caption">{total} due</span>}
      </header>
      <div className="pb-2">
        {loading ? (
          <SkeletonRows count={3} />
        ) : (
          groups.map((g) => (
            <div key={g.key}>
              <div className={`ws-up-group ${g.bad ? "is-bad" : ""}`}>
                {g.label}
                <span className="ws-cnt">{g.tasks.length}</span>
              </div>
              {g.tasks.length ? (
                <>
                  {g.tasks.slice(0, 4).map((t) => (
                    <button key={t.id} type="button" className="ws-up-row ws-focus" onClick={() => onOpen(t.id)}>
                      <span className="ws-pdot" style={{ "--c": areaColour[t.area] } as CSSProperties} />
                      <span className="ws-trunc">{t.title}</span>
                      <Avatar owner={t.assignee} size="sm" />
                    </button>
                  ))}
                  {g.tasks.length > 4 && <div className="ws-up-more">+{g.tasks.length - 4} more</div>}
                </>
              ) : (
                <div className="ws-up-none">{all.some((x) => x.key !== "overdue" && x.tasks.length) ? "Nothing due" : "Nothing due this week"}</div>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

/* ---------- Codex result meta ---------- */

export const outcomeMeta: Record<WorkspaceResult["outcome"], { label: string; short: string; tone: "ok" | "attn" | "bad" }> = {
  complete: { label: "Checked", short: "Checked", tone: "ok" },
  partial: { label: "Information missing", short: "Partial", tone: "attn" },
  failed: { label: "Could not finish", short: "Failed", tone: "bad" },
};
