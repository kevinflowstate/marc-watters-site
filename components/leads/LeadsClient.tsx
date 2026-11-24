"use client";

import "./leads.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chip, Empty, Icon, Segmented, SkeletonRows, fullDate, when } from "@/components/ops/workspace/WorkspaceUI";
import { useToast } from "@/components/ui/Toast";
import { InstagramLogo } from "./InstagramLogo";

type Status = "pending" | "ready" | "needs_marc" | "skipped" | "sent" | "edited_sent";
type Lead = {
  id: string;
  contact_name: string | null;
  profile_photo: string | null;
  inbound_at: string;
  inbound_text: string | null;
  status: Status;
  for_marc: boolean;
  draft_text: string | null;
  final_text: string | null;
  needs_reason: string | null;
  decided_at: string | null;
  decided_by: string | null;
  window_ends_at: string;
};
type Booking = { id: string; name: string; startTime: string; bookedAt: string | null; status: string };
type Data = { waiting: Lead[]; sent: Lead[]; bookings: Booking[]; recentBookings: Booking[]; bookingsError: string | null };
type Line = { id: string; from: "lead" | "marc" | "ai"; text: string; media: number; at: string };
type View = "waiting" | "marc" | "sent";

const MAX_DM = 1000;
const london = "Europe/London";

function initials(name: string) {
  return (
    name
      .replace(/[^A-Za-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() || "IG"
  );
}

/** Instagram display names often carry a tagline after a bar: keep the name. */
const displayName = (name: string | null) => (name || "Instagram user").split("|")[0].trim() || "Instagram user";

function LeadAvatar({ lead, large }: { lead: Pick<Lead, "contact_name" | "profile_photo">; large?: boolean }) {
  const [broken, setBroken] = useState(false);
  const name = displayName(lead.contact_name);
  return (
    <span className={`ld-av${large ? " is-lg" : ""}`} aria-hidden="true">
      {lead.profile_photo && !broken ? (
        // Instagram's own CDN image; plain img so no image proxy is needed.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={lead.profile_photo} alt="" className="ld-av-img" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
      ) : (
        <span className="ld-av-ini">{initials(name)}</span>
      )}
      <InstagramLogo size={large ? 15 : 14} title={null} />
    </span>
  );
}

function timeLeft(endsAt: string, now = Date.now()) {
  const mins = Math.floor((Date.parse(endsAt) - now) / 60_000);
  if (mins <= 0) return { text: "Reply window closed", tone: "bad" as const };
  const text = mins < 60 ? `${mins}m left to reply` : `${Math.floor(mins / 60)}h left to reply`;
  return { text, tone: mins < 4 * 60 ? ("attn" as const) : undefined };
}

function statusChip(lead: Lead) {
  if (lead.status === "sent" || lead.status === "edited_sent") return <Chip tone="ok">{lead.status === "sent" ? "Sent" : "Edited and sent"}</Chip>;
  if (lead.status === "pending") return <Chip>Writing suggestion</Chip>;
  if (lead.status === "needs_marc") return <Chip tone="attn">Check first</Chip>;
  if (lead.status === "skipped") return <Chip>Reply yourself</Chip>;
  return <Chip tone="decide">Suggestion ready</Chip>;
}

function bookingWhen(iso: string) {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: london });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: london });
  return `${day}, ${time}`;
}

function sameLondonDay(a: Date, b: Date) {
  const f = (d: Date) => d.toLocaleDateString("en-GB", { timeZone: london });
  return f(a) === f(b);
}

function Bookings({ data, loading }: { data: Data | null; loading: boolean }) {
  const [all, setAll] = useState(false);
  const [selected, setSelected] = useState<"upcoming" | "recent" | null>(null);
  const upcoming = data?.bookings ?? [];
  const recent = data?.recentBookings ?? [];
  const view = selected ?? (upcoming.length || !recent.length ? "upcoming" : "recent");
  const rows = view === "upcoming" ? upcoming : recent;
  const now = new Date();
  const shown = all ? rows : rows.slice(0, 6);
  return (
    <section className="ws-panel ld-books" aria-label="Strategy calls">
      <div className="ws-panel-head">
        <div className="ld-book-head">
          <Icon name="calendar" size={15} />
          <span className="ws-h2">Strategy calls</span>

        </div>
        <div className="flex flex-wrap gap-1" aria-label="Strategy call period">
          {(["upcoming", "recent"] as const).map((period) => (
            <button key={period} type="button" className="ws-btn ws-btn-sm ws-focus" aria-pressed={view === period}
              onClick={() => { setSelected(period); setAll(false); }}>
              {period === "upcoming" ? "Next 7 days" : "Past 28 days"}{data && !data.bookingsError && ` (${period === "upcoming" ? upcoming.length : recent.length})`}
            </button>
          ))}
        </div>
      </div>
      {loading && !data ? (
        <SkeletonRows count={2} />
      ) : data?.bookingsError ? (
        <div className="ws-note is-bad" role="alert" style={{ margin: 12 }}>
          <Icon name="alert" size={15} />
          <div className="min-w-0">{data.bookingsError}</div>
        </div>
      ) : rows.length === 0 ? (
        <Empty icon="calendar" title={view === "upcoming" ? "No upcoming strategy calls" : "No recent strategy calls"} text={view === "upcoming" ? "No active bookings in the next 7 days." : "No call slots in the past 28 days."} />
      ) : (
        <>
          <div className="ld-book-rows">
            {shown.map((b) => {
              const isNew = b.bookedAt ? now.getTime() - Date.parse(b.bookedAt) < 24 * 3_600_000 : false;
              const today = sameLondonDay(new Date(b.startTime), now);
              return (
                <div key={b.id} className="ld-book" title={b.bookedAt ? `Booked ${fullDate(b.bookedAt)}` : undefined}>
                  <span className={`ld-book-dot${isNew ? " is-new" : today ? " is-today" : ""}`} aria-hidden="true" />
                  <span className="ld-book-n">
                    {b.name}
                    {view === "recent" && <span className="ws-caption"> · {b.status === "noshow" ? "No-show" : b.status}</span>}
                    {isNew && <span className="ws-caption"> · booked {when(b.bookedAt)}</span>}
                  </span>
                  <span className="ld-book-w" title={fullDate(b.startTime)}>
                    {today ? `Today, ${new Date(b.startTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: london })}` : bookingWhen(b.startTime)}
                  </span>
                </div>
              );
            })}
          </div>
          {rows.length > 6 && (
            <div className="ld-book-more">
              <button type="button" className="ws-btn ws-btn-sm ws-btn-quiet ws-focus" onClick={() => setAll((v) => !v)}>
                {all ? "Show fewer" : `Show ${rows.length - 6} more`}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Thread({ lead, refreshKey }: { lead: Lead; refreshKey: string }) {
  const [lines, setLines] = useState<Line[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);
  const first = displayName(lead.contact_name).split(" ")[0];

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/leads/${lead.id}/thread`, { cache: "no-store" })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error || "Could not load the conversation.");
        if (!cancelled) {
          setLines(body.lines as Line[]);
          setError(null);
        }
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Could not load the conversation."));
    return () => {
      cancelled = true;
    };
  }, [lead.id, refreshKey]);

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [lines]);

  if (error) {
    return (
      <div className="ld-thread-load">
        <div className="ws-note is-bad" role="alert">
          <Icon name="alert" size={15} />
          <div className="min-w-0">{error}</div>
        </div>
      </div>
    );
  }
  if (!lines) return <div className="ld-thread-load"><SkeletonRows count={3} /></div>;
  const recent = lines.slice(-20);
  return (
    <div className="ld-thread" ref={scroller} aria-label={`Conversation with ${first}`}>
      {lines.length > recent.length && <div className="ws-caption" style={{ textAlign: "center" }}>Earlier messages are in Instagram</div>}
      {recent.map((l) => (
        <div key={l.id} className={`ld-msg${l.from === "lead" ? "" : " is-own"}`}>
          <div className="ld-bub">
            {l.text}
            {l.media > 0 && (
              <div className="ld-bub-media">
                {l.media > 1 ? `${l.media} attachments` : "Photo, video, reel or voice note"} - open Instagram to see it
              </div>
            )}
          </div>
          <span className="ld-msg-w" title={fullDate(l.at)}>
            {l.from === "lead" ? first : l.from === "ai" ? "AI setter" : "Marc"} · {when(l.at)}
          </span>
        </div>
      ))}
    </div>
  );
}

function ReplyBox({ lead, onDone }: { lead: Lead; onDone: (message: string) => Promise<void> }) {
  const hasDraft = Boolean(lead.draft_text) && (lead.status === "ready" || lead.status === "needs_marc");
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(hasDraft ? lead.draft_text || "" : "");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const first = displayName(lead.contact_name).split(" ")[0];
  const writing = !hasDraft || editing;

  async function act(action: "send" | "for_marc" | "unassign" | "dismiss") {
    setBusy(action);
    setError(null);
    try {
      const body: Record<string, unknown> = { action };
      if (action === "send") body.text = writing ? text : lead.draft_text;
      const res = await fetch(`/api/admin/leads/${lead.id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      await onDone(
        action === "send" ? `Sent to ${first} on Instagram` : action === "for_marc" ? "Left for Marc" : action === "unassign" ? "Moved back to the list" : "Marked as no reply needed",
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong.";
      setError(message);
      if (action === "send") toast("Not sent", "error");
    } finally {
      setBusy(null);
    }
  }

  if (lead.status === "sent" || lead.status === "edited_sent") {
    return (
      <div className="ld-reply">
        <div className="ws-note is-ok" role="note">
          <Icon name="checkCircle" size={15} />
          <div className="min-w-0">
            <strong>{lead.status === "sent" ? "Sent as suggested" : "Edited and sent"}</strong>
            {lead.decided_by ? ` by ${lead.decided_by}` : ""} · {fullDate(lead.decided_at)}
          </div>
        </div>
      </div>
    );
  }

  const over = text.length > MAX_DM;
  return (
    <div className="ld-reply">
      {lead.for_marc && (
        <div className="ws-note is-info" role="note">
          <Icon name="owner" size={15} />
          <div className="min-w-0" style={{ flex: 1 }}>
            <strong>Left for Marc.</strong> Marc can send the suggestion or write his own here.
          </div>
        </div>
      )}
      {lead.status === "needs_marc" && lead.needs_reason && (
        <div className="ws-note is-attn" role="note">
          <Icon name="alert" size={15} />
          <div className="min-w-0">
            <strong>Check first:</strong> {lead.needs_reason}
          </div>
        </div>
      )}
      {lead.status === "skipped" && (
        <div className="ws-note is-info" role="note">
          <Icon name="info" size={15} />
          <div className="min-w-0">
            <strong>No suggestion:</strong> {lead.needs_reason || "this one needs your own words."}
          </div>
        </div>
      )}
      {lead.status === "pending" && (
        <div className="ld-wait" role="status">
          <Icon name="sparkle" size={13} />
          Writing a suggestion. It appears here within a couple of minutes; you can also write your own now.
        </div>
      )}

      {hasDraft && !editing ? (
        <div className="ld-sugg" aria-label="Suggested reply">
          <div className="ld-sugg-head">
            <Icon name="sparkle" size={13} />
            Suggested reply
            <span className="ld-sugg-meta">Not sent until you press Send</span>
          </div>
          <div className="ld-sugg-text">{lead.draft_text}</div>
        </div>
      ) : (
        <div>
          <textarea
            className="ws-input ld-edit ws-focus"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Reply to ${first} on Instagram...`}
            aria-label={`Reply to ${first}`}
          />
          <span className={`ld-count${over ? " is-over" : ""}`}>
            {text.length}/{MAX_DM}
          </span>
        </div>
      )}

      {error && <div className="ld-err" role="alert">{error}</div>}

      <div className="ld-acts">
        <button
          type="button"
          className="ws-btn ws-btn-primary ws-btn-sm ws-focus"
          onClick={() => void act("send")}
          disabled={busy !== null || (writing && (!text.trim() || over))}
        >
          <Icon name="send" size={13} />
          {busy === "send" ? "Sending..." : editing ? "Send edited reply" : "Send"}
        </button>
        {hasDraft && !editing && (
          <button type="button" className="ws-btn ws-btn-sm ws-focus" onClick={() => setEditing(true)} disabled={busy !== null}>
            Edit and send
          </button>
        )}
        {editing && (
          <button
            type="button"
            className="ws-btn ws-btn-sm ws-btn-quiet ws-focus"
            onClick={() => {
              setEditing(false);
              setText(lead.draft_text || "");
            }}
            disabled={busy !== null}
          >
            Cancel
          </button>
        )}
        {lead.for_marc ? (
          <button type="button" className="ws-btn ws-btn-sm ws-focus" onClick={() => void act("unassign")} disabled={busy !== null}>
            Back to the list
          </button>
        ) : (
          <button type="button" className="ws-btn ws-btn-sm ws-focus" onClick={() => void act("for_marc")} disabled={busy !== null}>
            {busy === "for_marc" ? "Moving..." : "Leave for Marc"}
          </button>
        )}
        <span className="ld-spacer" />
        <button type="button" className="ws-btn ws-btn-sm ws-btn-quiet ws-focus" onClick={() => void act("dismiss")} disabled={busy !== null}>
          No reply needed
        </button>
      </div>
    </div>
  );
}

export default function LeadsClient() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("waiting");
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const { toast } = useToast();

  const load = useCallback(async (sync = false) => {
    try {
      const res = await fetch("/api/admin/leads", { method: sync ? "POST" : "GET", cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not load leads.");
      setData(body as Data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load leads.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
  }, [load]);

  const hasPending = Boolean(data?.waiting.some((l) => l.status === "pending"));
  useEffect(() => {
    const t = setInterval(() => {
      void load();
      setTick((n) => n + 1);
    }, hasPending ? 15_000 : 60_000);
    return () => clearInterval(t);
  }, [load, hasPending]);

  const lists = useMemo(() => {
    const waiting = data?.waiting ?? [];
    return {
      waiting: waiting.filter((l) => !l.for_marc),
      marc: waiting.filter((l) => l.for_marc),
      sent: data?.sent ?? [],
    };
  }, [data]);
  const rows = lists[view];
  const lead = useMemo(() => [...lists.waiting, ...lists.marc, ...lists.sent].find((l) => l.id === selected) ?? null, [lists, selected]);

  // Keep a selection on desktop so the reply box is always one click away.
  useEffect(() => {
    if (!selected && rows.length && typeof window !== "undefined" && window.matchMedia("(min-width: 1100px)").matches) setSelected(rows[0].id);
  }, [rows, selected]);

  async function refresh() {
    setSyncing(true);
    await load(true);
    setSyncing(false);
    setTick((n) => n + 1);
  }

  async function onDone(message: string) {
    toast(message);
    setSelected(null);
    setOpen(false);
    await load();
  }

  const window_ = lead && lead.status !== "sent" && lead.status !== "edited_sent" ? timeLeft(lead.window_ends_at) : null;

  return (
    <div className={`ws ws-page ld-page${open ? " is-open" : ""}`}>
      <div className="ws-ph ld-title">
        <div className="min-w-0">
          <h1 className="ws-title">Leads</h1>
          <p className="ws-meta mt-1">Instagram messages waiting for a reply in the last 24 hours, and recent and upcoming strategy calls.</p>
        </div>
        <div className="ws-ph-acts">
          <button type="button" className="ws-btn ws-focus" onClick={() => void refresh()} disabled={syncing}>
            <Icon name="refresh" size={14} />
            {syncing ? "Checking..." : "Check for new messages"}
          </button>
        </div>
      </div>

      {error && (
        <div className="ws-note is-bad" role="alert">
          <Icon name="alert" size={15} />
          <div className="min-w-0">{error}</div>
        </div>
      )}

      <Bookings data={data} loading={loading} />

      <div className="ld-backrow">
        <button type="button" className="ws-btn ws-btn-quiet ws-focus ld-back" onClick={() => setOpen(false)}>
          <Icon name="chevron" size={14} />
          Back to messages
        </button>
      </div>

      <div className="ld-grid">
        <section className="ws-panel ld-list" aria-label="Instagram messages">
          <div className="ld-list-head">
            <InstagramLogo size={20} />
            <span className="ws-h2">Instagram DMs</span>
            <span className="ws-caption">{lists.waiting.length} waiting</span>
          </div>
          <div className="ld-seg">
            <Segmented<View>
              label="Show"
              value={view}
              onChange={(v) => {
                setView(v);
                setSelected(null);
              }}
              options={[
                { value: "waiting", label: "Waiting", count: lists.waiting.length },
                { value: "marc", label: "For Marc", count: lists.marc.length },
                { value: "sent", label: "Sent", count: lists.sent.length },
              ]}
            />
          </div>
          <div className="ld-rows">
            {loading && !data ? (
              <SkeletonRows count={4} />
            ) : rows.length === 0 ? (
              <Empty
                icon="inboxEmpty"
                title={view === "waiting" ? "All caught up" : view === "marc" ? "Nothing left for Marc" : "Nothing sent yet today"}
                text={
                  view === "waiting"
                    ? "No Instagram messages are waiting for a reply. New ones appear here within two minutes."
                    : view === "marc"
                      ? "Messages Eimear leaves for Marc appear here."
                      : "Replies sent from here in the last 24 hours appear here."
                }
              />
            ) : (
              rows.map((l) => {
                const left = view !== "sent" ? timeLeft(l.window_ends_at) : null;
                return (
                  <button
                    key={l.id}
                    type="button"
                    className={`ld-row ws-focus${l.id === selected ? " is-on" : ""}`}
                    aria-current={l.id === selected ? "true" : undefined}
                    onClick={() => {
                      setSelected(l.id);
                      setOpen(true);
                    }}
                  >
                    <LeadAvatar lead={l} />
                    <span className="ld-row-m">
                      <span className="ld-row-top">
                        <span className="ld-row-n">{displayName(l.contact_name)}</span>
                        <span className="ld-row-w" title={fullDate(view === "sent" ? l.decided_at : l.inbound_at)}>
                          {when(view === "sent" ? l.decided_at : l.inbound_at)}
                        </span>
                      </span>
                      <span className="ld-row-p">{view === "sent" ? `You: ${l.final_text ?? ""}` : l.inbound_text}</span>
                      <span className="ld-row-tags">
                        {statusChip(l)}
                        {left?.tone && <Chip tone={left.tone}>{left.text}</Chip>}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section className="ws-panel ld-conv" aria-label="Conversation">
          {lead ? (
            <>
              <div className="ld-conv-head">
                <LeadAvatar lead={lead} large />
                <div className="min-w-0" style={{ flex: 1 }}>
                  <div className="ws-h2" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {displayName(lead.contact_name)}
                  </div>
                  <div className="ld-conv-meta">
                    <span title={fullDate(lead.inbound_at)}>Messaged {when(lead.inbound_at)}</span>
                    {window_ && <span className={window_.tone ? "is-attn" : undefined}>{window_.text}</span>}
                  </div>
                </div>
              </div>
              <Thread lead={lead} refreshKey={`${lead.id}:${lead.status}:${tick}`} />
              {/* Keyed so the box resets when the lead or its suggestion changes. */}
              <ReplyBox key={`${lead.id}:${lead.status}:${lead.draft_text?.length ?? 0}`} lead={lead} onDone={onDone} />
            </>
          ) : (
            <div className="ld-pick">
              <Empty icon="inbox" title="Choose a message" text="Pick a conversation to read it and see the suggested reply." />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
