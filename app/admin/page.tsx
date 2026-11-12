"use client";
import AttentionCard from "@/components/ops/AttentionCard";
import ReplyDraftCard from "@/components/reply-drafts/ReplyDraftCard";
import { initials } from "@/lib/initials";
import { roundStart } from "@/lib/client-health";

import { useState, useEffect, type CSSProperties } from "react";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import type { AdminClient } from "@/lib/admin-data";
import { getQuestionAnswerLabel } from "@/lib/questionnaires";
import type { TrafficLight, CheckInMood, CheckIn, CheckinFormConfig } from "@/lib/types";
import { Chip, Empty, Icon, SkeletonRows, StatusIcon } from "@/components/ops/workspace/WorkspaceUI";

const statusLabel: Record<TrafficLight, { text: string; tone: "bad" | "attn" | "ok"; colour: string }> = {
  red: { text: "Gone quiet", tone: "bad", colour: "var(--ws-bad)" },
  amber: { text: "Behind", tone: "attn", colour: "var(--ws-attn)" },
  green: { text: "On track", tone: "ok", colour: "var(--ws-ok)" },
};

const moodConfig: Record<CheckInMood, { tone?: "ok" | "attn" | "bad" | "decide" }> = {
  great: { tone: "ok" },
  good: { tone: "decide" },
  okay: { tone: "attn" },
  struggling: { tone: "bad" },
  awful: { tone: "bad" },
};

const moodText = (mood: string) => (mood ? mood[0].toUpperCase() + mood.slice(1) : mood);

const BRIEFING_DISMISSAL_STORAGE_PREFIX = "blueprint-briefing-dismissed";

function getLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getBriefingDismissalStorageKey(): string {
  return `${BRIEFING_DISMISSAL_STORAGE_PREFIX}:${getLocalDateKey()}`;
}

function loadDismissedBriefingIds(): Set<string> {
  if (typeof window === "undefined") return new Set();

  try {
    const stored = window.localStorage.getItem(getBriefingDismissalStorageKey());
    const parsed = stored ? JSON.parse(stored) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

function saveDismissedBriefingIds(ids: Set<string>) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(getBriefingDismissalStorageKey(), JSON.stringify([...ids]));
  } catch {
    // Dismissal persistence is a convenience; the dashboard should still work without localStorage.
  }
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return "1 week ago";
  return `${Math.floor(diffDays / 7)} weeks ago`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}


export default function AdminDashboard() {
  const { toast } = useToast();
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [recentCheckins, setRecentCheckins] = useState<EnrichedCheckin[]>([]);
  const [checkinConfig, setCheckinConfig] = useState<CheckinFormConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [showOnTrack, setShowOnTrack] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastError, setBroadcastError] = useState("");
  const [broadcastSuccess, setBroadcastSuccess] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ firstName: "", lastName: "", email: "" });
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [clientsRes, meRes, configRes] = await Promise.all([
          fetch("/api/admin/clients"),
          fetch("/api/portal/me"),
          fetch("/api/admin/form-config?type=checkin"),
        ]);
        if (clientsRes.ok) {
          const data = await clientsRes.json();
          setClients(data.clients || []);
          // Build recent checkins from client data
          const checkins = (data.clients || []).flatMap((c: AdminClient) =>
            c.checkins.map((ck: CheckIn) => ({
              ...ck,
              client_name: c.name,
              client_business: c.business_name,
              client_status: c.status,
            }))
          ).sort((a: EnrichedCheckin, b: EnrichedCheckin) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          setRecentCheckins(checkins);
        }
        if (meRes.ok) {
          const meData = await meRes.json();
          if (meData.fullName) {
            setAdminName(meData.fullName.split(" ")[0]);
          }
        }
        if (configRes.ok) {
          const configData = await configRes.json();
          setCheckinConfig(configData.config || null);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="ws ws-page">
        <div>
          <span className="ws-skel" style={{ width: 240, height: 22 }} />
          <span className="ws-skel mt-2" style={{ width: 180, height: 12 }} />
        </div>
        <div className="ws-strip">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="ws-stat" style={{ cursor: "default" }}>
              <span className="ws-skel" style={{ width: 80, height: 10 }} />
              <span className="ws-skel" style={{ width: 36, height: 20 }} />
            </div>
          ))}
        </div>
        <div className="ws-grid2">
          <div className="ws-panel"><SkeletonRows count={6} /></div>
          <div className="ws-panel"><SkeletonRows count={4} /></div>
        </div>
      </div>
    );
  }

  const amberCount = clients.filter((c) => c.status === "amber").length;
  const redCount = clients.filter((c) => c.status === "red").length;

  async function sendBroadcast() {
    const trimmed = broadcastMessage.trim();
    if (!trimmed || broadcastSending) return;

    setBroadcastSending(true);
    setBroadcastError("");
    setBroadcastSuccess("");

    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Failed to send broadcast");
      }

      const summary = `Broadcast sent to ${data.clients} client${data.clients === 1 ? "" : "s"}.`;
      setBroadcastSuccess(summary);
      setBroadcastMessage("");
      toast(summary);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send broadcast";
      setBroadcastError(message);
      toast("Failed to send broadcast", "error");
    } finally {
      setBroadcastSending(false);
    }
  }

  const waitingOnYou =
    clients.filter((c) => c.health?.awaiting_reply_since).length +
    new Set(
      recentCheckins
        .filter((ck) => !ck.admin_reply || (ck.client_reply && ck.client_replied_at && ck.replied_at && Date.parse(ck.client_replied_at) > Date.parse(ck.replied_at)))
        .map((ck) => ck.client_id),
    ).size;
  const checkedInThisRound = clients.filter((c) => c.health?.checked_in_this_round).length;
  const roundOpened = roundStart(new Date(), checkinConfig?.checkin_day || "thursday").toLocaleDateString("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const onTrack = clients.filter((c) => c.status === "green");
  const listed = showOnTrack ? clients : clients.filter((c) => c.status !== "green");

  return (
    <div className="ws ws-page">
      <div className="ws-ph">
        <div className="min-w-0">
          <h1 className="ws-title">Welcome back{adminName ? `, ${adminName}` : ""}</h1>
          <p className="ws-meta mt-1">
            {formatDate(new Date())} · {clients.length} client{clients.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="ws-ph-acts">
          <Link href="/admin/calendar" className="ws-btn ws-btn-quiet ws-focus">
            <Icon name="calendar" size={14} />
            Add to calendar
          </Link>
          <Link href="/admin/training" className="ws-btn ws-btn-quiet ws-focus">
            <Icon name="plus" size={14} />
            Add training
          </Link>
          <button
            type="button"
            onClick={() => {
              setBroadcastOpen(true);
              setBroadcastError("");
              setBroadcastSuccess("");
            }}
            className="ws-btn ws-focus"
          >
            <Icon name="bell" size={14} />
            Broadcasts
          </button>
          <button type="button" onClick={() => setInviteOpen(true)} className="ws-btn ws-btn-primary ws-focus">
            <Icon name="plus" size={14} />
            Invite client
          </button>
        </div>
      </div>

      <AttentionCard />

      {/* Stats */}
      <div className="ws-strip">
        <div className="ws-stat" style={{ cursor: "default" }}>
          <span className="ws-stat-l"><Icon name="reply" size={14} />Waiting on you</span>
          <span className={`ws-stat-n ${waitingOnYou > 0 ? "is-on" : ""}`}>{waitingOnYou}</span>
          <span className="ws-stat-s">{waitingOnYou > 0 ? "messages and check-ins" : "nothing waiting"}</span>
        </div>
        <div className="ws-stat" style={{ cursor: "default" }}>
          <span className="ws-stat-l"><Icon name="checkCircle" size={14} />Checked in this round</span>
          <span className="ws-stat-n">
            {checkedInThisRound}
            <span className="ws-caption" style={{ fontSize: 13, fontWeight: 500 }}> / {clients.length}</span>
          </span>
          <span className="ws-stat-s">since {roundOpened}</span>
        </div>
        <div className="ws-stat" style={{ cursor: "default" }}>
          <span className="ws-stat-l"><Icon name="clock" size={14} />Behind on check-ins</span>
          <span className={`ws-stat-n ${amberCount > 0 ? "is-on" : ""}`}>{amberCount}</span>
          <span className={`ws-stat-s ${amberCount > 0 ? "is-attn" : ""}`}>{amberCount > 0 ? "still active, missed a round" : "nobody behind"}</span>
        </div>
        <div className="ws-stat" style={{ cursor: "default" }}>
          <span className="ws-stat-l"><Icon name="alert" size={14} />Gone quiet</span>
          <span className="ws-stat-n">{redCount}</span>
          <span className="ws-stat-s">{redCount > 0 ? "no activity for 14+ days" : "nobody gone quiet"}</span>
        </div>
      </div>

      <NeedsYou clients={clients} recentCheckins={recentCheckins} />

      <div className="ws-grid2">
        {/* Compact client list with expandable detail */}
        <section className="ws-panel min-w-0" aria-label="Clients">
          <div className="ws-panel-head">
            <h2 className="ws-h2">Clients</h2>
            <span className="ws-caption">{clients.length}</span>
            <Link href="/admin/clients" className="ws-link text-[12.5px]">
              View all
            </Link>
          </div>
          <div>
            {listed.map((client) => {
              const sl = statusLabel[client.status];
              const isExpanded = expandedClient === client.id;
              const activePlans = client.business_plan.filter((p) => p.status === "active");
              const allItems = activePlans.flatMap((plan) => plan.phases.flatMap((ph) => ph.items));
              const planTotal = allItems.length;
              const planDone = allItems.filter((p) => p.completed).length;
              const planPct = planTotal > 0 ? Math.round((planDone / planTotal) * 100) : 0;
              const lateCheckin = (client.health?.missed_rounds ?? 0) > 0;

              return (
                <div key={client.id}>
                  <button
                    type="button"
                    onClick={() => setExpandedClient(isExpanded ? null : client.id)}
                    aria-expanded={isExpanded}
                    className="ws-row ws-focus"
                    style={{ gridTemplateColumns: "26px minmax(0,1fr) auto" }}
                  >
                    <span className="ws-avatar is-md" aria-hidden="true">
                      {initials(client.name)}
                    </span>
                    <span className="min-w-0">
                      <span className="ws-row-title">{client.name}</span>
                      <span className="ws-row-sub" title={client.health?.last_active_at ? fullDate(client.health.last_active_at) : undefined}>
                        {client.health?.last_active_at
                          ? `Active ${whenShort(client.health.last_active_at)}${client.health.last_active_kind ? ` - ${client.health.last_active_kind}` : ""}`
                          : client.business_name}
                      </span>
                    </span>
                    <span className="ws-row-meta">
                      <Chip tone={sl.tone}>{client.health?.label ?? sl.text}</Chip>
                      <Icon name="chevron" size={14} className={`ws-chev ${isExpanded ? "is-open" : ""}`} />
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="ws-expand">
                      <div className="ws-expand-box">
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <span className="ws-caption">
                            {client.business_name} - {client.business_type}
                          </span>
                          <Chip tone={sl.tone}>{client.health?.label ?? sl.text}</Chip>
                        </div>
                        {client.health?.reason && <p className="ws-caption mb-3">{client.health.reason}</p>}
                        <dl className="ws-mini mb-3">
                          <div>
                            <dt>Week</dt>
                            <dd>{client.current_week}/12</dd>
                          </div>
                          <div>
                            <dt>Last check-in</dt>
                            <dd className={lateCheckin ? "is-bad" : ""}>{timeAgo(client.last_checkin)}</dd>
                          </div>
                          <div>
                            <dt>Plan</dt>
                            <dd>
                              {planDone}/{planTotal} ({planPct}%)
                            </dd>
                          </div>
                        </dl>
                        <span className="ws-bar mb-3" style={{ "--c": sl.colour } as CSSProperties}>
                          <i style={{ width: `${planPct}%` }} />
                        </span>
                        <Link href={`/admin/clients/${client.id}`} className="ws-link text-[12.5px] inline-flex items-center gap-1">
                          View full profile
                          <Icon name="chevron" size={12} />
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {clients.length === 0 && <p className="ws-up-none" style={{ padding: "14px" }}>No clients yet.</p>}
            {onTrack.length > 0 && (
              <button type="button" onClick={() => setShowOnTrack((v) => !v)} className="ws-more ws-focus">
                {showOnTrack ? "Hide on-track clients" : `Show ${onTrack.length} on track`}
              </button>
            )}
          </div>
        </section>

        {/* Recent check-ins - grouped by week */}
        <CheckInsPanel checkins={recentCheckins} checkinConfig={checkinConfig} />
      </div>

      {broadcastOpen && (
        <div className="ws-overlay">
          <div
            className="ws-overlay-bg"
            onClick={() => {
              if (!broadcastSending) setBroadcastOpen(false);
            }}
          />
          <div className="ws-dialog is-wide" role="dialog" aria-modal="true" aria-label="Broadcasts">
            <div className="ws-dialog-head">
              <div>
                <h3 className="ws-dialog-title">Broadcasts</h3>
                <p className="ws-caption mt-1">Send one direct inbox message and push notification to every client.</p>
              </div>
              <button
                type="button"
                onClick={() => setBroadcastOpen(false)}
                disabled={broadcastSending}
                className="ws-btn ws-btn-quiet ws-btn-icon ws-focus"
                aria-label="Close broadcast dialog"
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            <div className="ws-dialog-body">
              <div className="ws-note is-info">
                <Icon name="info" size={15} />
                <span>This will appear as an individual message from Marc in each client&apos;s inbox. It will not create a group thread.</span>
              </div>
              <div>
                <label className="ws-label">Message</label>
                <textarea
                  value={broadcastMessage}
                  onChange={(event) => {
                    setBroadcastMessage(event.target.value);
                    setBroadcastError("");
                    setBroadcastSuccess("");
                  }}
                  rows={6}
                  maxLength={2000}
                  placeholder="Type the message all clients should receive..."
                  className="ws-input"
                  style={{ resize: "none" }}
                />
                <div className="mt-2 flex items-center justify-between gap-3 ws-caption">
                  <span>{clients.length} client{clients.length === 1 ? "" : "s"} will receive this.</span>
                  <span>{broadcastMessage.length}/2000</span>
                </div>
              </div>

              {broadcastError && (
                <div className="ws-note is-bad">
                  <Icon name="alert" size={15} />
                  <span>{broadcastError}</span>
                </div>
              )}
              {broadcastSuccess && (
                <div className="ws-note is-ok">
                  <Icon name="checkCircle" size={15} />
                  <span>{broadcastSuccess}</span>
                </div>
              )}

              <div className="ws-dialog-foot">
                <button
                  type="button"
                  onClick={() => setBroadcastOpen(false)}
                  disabled={broadcastSending}
                  className="ws-btn ws-focus"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void sendBroadcast()}
                  disabled={broadcastSending || !broadcastMessage.trim() || clients.length === 0}
                  className="ws-btn ws-btn-primary ws-focus"
                >
                  {broadcastSending ? "Sending..." : "Send to all"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {inviteOpen && (
        <div className="ws-overlay">
          <div className="ws-overlay-bg" onClick={() => { setInviteOpen(false); setInviteError(""); setInviteSuccess(false); }} />
          <div className="ws-dialog" role="dialog" aria-modal="true" aria-label="Invite new client">
            <div className="ws-dialog-head">
              <h3 className="ws-dialog-title">Invite new client</h3>
              <button
                type="button"
                onClick={() => { setInviteOpen(false); setInviteError(""); setInviteSuccess(false); }}
                className="ws-btn ws-btn-quiet ws-btn-icon ws-focus"
                aria-label="Close"
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            {inviteSuccess ? (
              <div className="ws-dialog-body">
                <div className="ws-empty">
                  <span className="ws-empty-glyph" style={{ color: "var(--ws-ok)" }}>
                    <Icon name="checkCircle" size={22} />
                  </span>
                  <p className="ws-empty-h">Invite sent</p>
                  <p>They will receive an email to set up their account.</p>
                </div>
                <div className="ws-dialog-foot" style={{ justifyContent: "center" }}>
                  <button
                    type="button"
                    onClick={() => { setInviteOpen(false); setInviteSuccess(false); setInviteForm({ firstName: "", lastName: "", email: "" }); }}
                    className="ws-btn ws-btn-primary ws-focus"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={async (e) => {
                e.preventDefault();
                setInviteSending(true);
                setInviteError("");
                try {
                  const res = await fetch("/api/admin/create-client", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      email: inviteForm.email,
                      full_name: `${inviteForm.firstName} ${inviteForm.lastName}`.trim(),
                    }),
                  });
                  if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || "Failed to send invite");
                  }
                  setInviteSuccess(true);
                  // Refresh client list
                  const clientsRes = await fetch("/api/admin/clients");
                  if (clientsRes.ok) {
                    const data = await clientsRes.json();
                    setClients(data.clients || []);
                  }
                } catch (err) {
                  setInviteError(err instanceof Error ? err.message : "Failed to send invite");
                } finally {
                  setInviteSending(false);
                }
              }} className="ws-dialog-body">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="ws-label">First name</label>
                    <input
                      type="text"
                      required
                      value={inviteForm.firstName}
                      onChange={(e) => setInviteForm(prev => ({ ...prev, firstName: e.target.value }))}
                      className="ws-input"
                    />
                  </div>
                  <div>
                    <label className="ws-label">Last name</label>
                    <input
                      type="text"
                      required
                      value={inviteForm.lastName}
                      onChange={(e) => setInviteForm(prev => ({ ...prev, lastName: e.target.value }))}
                      className="ws-input"
                    />
                  </div>
                </div>
                <div>
                  <label className="ws-label">Email address</label>
                  <input
                    type="email"
                    required
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="client@example.com"
                    className="ws-input"
                  />
                </div>
                {inviteError && (
                  <div className="ws-note is-bad">
                    <Icon name="alert" size={15} />
                    <span>{inviteError}</span>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={inviteSending}
                  className="ws-btn ws-btn-primary ws-focus w-full"
                >
                  {inviteSending ? "Sending invite..." : "Send invite"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Blueprint AI Overview ---

type NeedsYouAction =
  | { type: "nudge"; clientName: string; userId: string; message: "checkin" | "quiet" }
  | { type: "inbox"; clientId: string }
  | { type: "reply"; clientId: string }
  | { type: "view-plan"; clientId: string };

interface NeedsYouItem {
  id: string;
  clientName: string;
  text: string;
  when?: string | null;
  chip?: { text: string; tone: "bad" | "attn" | "decide" | "ok" };
  action: NeedsYouAction;
}

interface NeedsYouGroup {
  key: string;
  title: string;
  hint: string;
  colour: string;
  items: NeedsYouItem[];
}

const GROUP_ROWS = 5;

/** "2h ago", "Yesterday", "Thu", "18 Nov" - with the full date kept for the title attribute. */
function whenShort(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  const day = (d: Date) => d.toLocaleDateString("en-GB", { timeZone: "Europe/London" });
  if (hours < 24 && day(new Date(t)) === day(new Date())) return `${hours}h ago`;
  const yesterday = new Date(Date.now() - 86_400_000);
  if (day(new Date(t)) === day(yesterday)) return "Yesterday";
  if (diff < 6 * 86_400_000) return new Date(t).toLocaleDateString("en-GB", { timeZone: "Europe/London", weekday: "short" });
  return new Date(t).toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short" });
}

function dayDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short" });
}

function fullDate(iso: string | null | undefined) {
  if (!iso) return undefined;
  return new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

const NUDGE_TEXT = {
  checkin: (first: string) => `Hey ${first}, your weekly check-in is due. Takes 2 minutes - let me know how things are going.`,
  quiet: (first: string) => `Hey ${first}, just checking in - haven't seen you in the portal for a bit. Everything OK? Jump back in when you're ready, your plan is waiting.`,
};

function buildNeedsYou(clients: AdminClient[], recentCheckins: EnrichedCheckin[]): NeedsYouGroup[] {
  const byId = new Map(clients.map((c) => [c.id, c]));

  const messages: NeedsYouItem[] = clients
    .filter((c) => c.health?.awaiting_reply_since)
    .sort((a, b) => Date.parse(a.health.awaiting_reply_since!) - Date.parse(b.health.awaiting_reply_since!))
    .map((c) => ({
      id: `msg-${c.id}-${c.health.awaiting_reply_since}`,
      clientName: c.name,
      text: "Sent you a message",
      when: c.health.awaiting_reply_since,
      chip: c.health.awaiting_reply_unread ? { text: "Unread", tone: "decide" as const } : undefined,
      action: { type: "inbox" as const, clientId: c.id },
    }));

  const checkinMap = new Map<string, EnrichedCheckin[]>();
  for (const ck of recentCheckins) {
    const followUp = Boolean(ck.client_reply && ck.client_replied_at && ck.replied_at && Date.parse(ck.client_replied_at) > Date.parse(ck.replied_at));
    if (ck.admin_reply && !followUp) continue;
    if (!checkinMap.has(ck.client_id)) checkinMap.set(ck.client_id, []);
    checkinMap.get(ck.client_id)!.push(ck);
  }
  const checkins: NeedsYouItem[] = [...checkinMap.entries()].map(([clientId, cks]) => {
    const struggling = cks.some((ck) => ck.mood === "struggling" || ck.mood === "awful");
    const followUp = cks.some((ck) => ck.admin_reply);
    return {
      id: `reply-${clientId}-${cks[0].id}`,
      clientName: cks[0].client_name,
      text: followUp
        ? "Replied to your check-in reply"
        : cks.length > 1
          ? `${cks.length} check-ins without a reply`
          : "Check-in without a reply",
      when: cks[0].client_replied_at || cks[0].created_at,
      chip: struggling ? { text: "Struggling", tone: "bad" as const } : undefined,
      action: { type: "reply" as const, clientId },
    };
  }).sort((a, b) => Number(b.chip?.tone === "bad") - Number(a.chip?.tone === "bad"));

  const behind: NeedsYouItem[] = clients
    .filter((c) => c.status === "amber")
    .map((c) => ({
      id: `behind-${c.id}-${c.health.missed_rounds}`,
      clientName: c.name,
      text: c.health.reason,
      chip: { text: c.health.label, tone: "attn" as const },
      action: { type: "nudge" as const, clientName: c.name, userId: c.user_id, message: c.health.missed_rounds > 0 ? ("checkin" as const) : ("quiet" as const) },
    }));

  const quiet: NeedsYouItem[] = clients
    .filter((c) => c.status === "red")
    .map((c) => ({
      id: `quiet-${c.id}`,
      clientName: c.name,
      text: c.health.reason,
      chip: { text: c.health.label, tone: "bad" as const },
      action: { type: "nudge" as const, clientName: c.name, userId: c.user_id, message: "quiet" as const },
    }));

  // Plans Marc can act on: finished (every item ticked) or none set. Marc, 12 Nov 2026: replaces "Plans stalled",
  // which listed most clients because few tick their items.
  const plansToSet: NeedsYouItem[] = clients.flatMap((c): NeedsYouItem[] => {
    const active = c.business_plan.filter((p) => p.status === "active");
    const name = byId.get(c.id)?.name ?? c.name;
    const action = { type: "view-plan" as const, clientId: c.id };
    if (active.length === 0) {
      const last = c.business_plan.find((p) => p.status === "completed");
      return [{
        id: `plan-none-${c.id}`,
        clientName: name,
        text: last?.completed_at ? `No active plan since ${dayDate(last.completed_at)}` : "No plan set yet",
        chip: { text: "No plan", tone: "attn" as const },
        action,
      }];
    }
    const items = active.flatMap((plan) => plan.phases.flatMap((ph) => ph.items));
    if (items.length === 0) {
      return [{ id: `plan-empty-${c.id}`, clientName: name, text: "Plan has no action items yet", chip: { text: "Empty plan", tone: "attn" as const }, action }];
    }
    if (items.every((i) => i.completed)) {
      const done = items.map((i) => i.completed_at).filter(Boolean).sort().pop();
      return [{
        id: `plan-done-${c.id}-${done ?? ""}`,
        clientName: name,
        text: done ? `Finished every item, last ticked ${dayDate(done)}. Set the next plan.` : "Finished every item. Set the next plan.",
        chip: { text: "Plan finished", tone: "ok" as const },
        action,
      }];
    }
    return [];
  });

  return [
    { key: "messages", title: "Messages waiting on you", hint: "The client spoke last in the last 14 days", colour: "var(--ws-accent)", items: messages },
    { key: "checkins", title: "Check-ins to reply to", hint: "No reply yet, or they answered your reply", colour: "var(--ws-accent)", items: checkins },
    { key: "behind", title: "Behind on check-ins", hint: "Still using the portal but missed a round", colour: "var(--ws-attn)", items: behind },
    { key: "quiet", title: "Gone quiet", hint: "Missed 2+ rounds and nothing in the portal for 14+ days", colour: "var(--ws-bad)", items: quiet },
    { key: "plans", title: "Plans to set up", hint: "Plan finished, or no plan in place", colour: "var(--ws-accent)", items: plansToSet },
  ];
}

function NeedsYou({ clients, recentCheckins }: { clients: AdminClient[]; recentCheckins: EnrichedCheckin[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(loadDismissedBriefingIds);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [nudgeTarget, setNudgeTarget] = useState<{ name: string; userId: string; itemId: string } | null>(null);
  const [nudgeMessage, setNudgeMessage] = useState("");
  const [nudgeSending, setNudgeSending] = useState(false);
  const [nudgeSent, setNudgeSent] = useState(false);

  function dismissItem(id: string) {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveDismissedBriefingIds(next);
      return next;
    });
  }

  const groups = buildNeedsYou(clients, recentCheckins)
    .map((g) => ({ ...g, items: g.items.filter((i) => !dismissed.has(i.id)) }))
    .filter((g) => g.items.length > 0);
  const total = groups.reduce((n, g) => n + g.items.length, 0);

  function openNudge(item: NeedsYouItem) {
    if (item.action.type !== "nudge") return;
    const first = item.action.clientName.split(" ")[0];
    setNudgeTarget({ name: item.action.clientName, userId: item.action.userId, itemId: item.id });
    setNudgeMessage(NUDGE_TEXT[item.action.message](first));
    setNudgeSent(false);
  }

  async function sendNudge() {
    if (!nudgeTarget) return;
    setNudgeSending(true);
    try {
      const res = await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: nudgeTarget.userId,
          title: "Marc Watters",
          body: nudgeMessage,
          url: "/portal",
          tag: "nudge",
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (res.ok && result.sent > 0) {
        setNudgeSent(true);
        dismissItem(nudgeTarget.itemId);
        setTimeout(() => { setNudgeTarget(null); }, 1500);
      } else {
        alert("Push notification could not be delivered. Client may not have notifications enabled.");
      }
    } finally {
      setNudgeSending(false);
    }
  }

  return (
    <>
      <section className="ws-panel" aria-label="What needs you">
        <div className="ws-panel-head">
          <h2 className="ws-h2">What needs you</h2>
          <span className="ws-caption">{total} item{total === 1 ? "" : "s"}</span>
        </div>
        {groups.length === 0 ? (
          <Empty title="All clear" text="No messages or check-ins waiting, and every client is up to date." />
        ) : (
          groups.map((group) => {
            const open = openGroups.has(group.key);
            const shown = open ? group.items : group.items.slice(0, GROUP_ROWS);
            return (
              <div key={group.key} className="ws-ny-group">
                <div className="ws-group" style={{ cursor: "default" }} title={group.hint}>
                  <span className="ws-dot" style={{ color: group.colour }} />
                  <span>{group.title}</span>
                  <span className="ws-cnt">{group.items.length}</span>
                </div>
                {shown.map((item) => (
                  <div key={item.id} className="ws-ny-row">
                    <div className="min-w-0">
                      <div className="ws-ny-title">
                        <span className="ws-row-title">{item.clientName}</span>
                        {item.chip && <Chip tone={item.chip.tone}>{item.chip.text}</Chip>}
                      </div>
                      <div className="ws-row-sub">
                        {item.text}
                        {item.when && (
                          <span title={fullDate(item.when)}> · {whenShort(item.when)}</span>
                        )}
                      </div>
                    </div>
                    <div className="ws-ny-acts">
                      {item.action.type === "inbox" && (
                        <Link href={`/admin/inbox?client=${item.action.clientId}`} className="ws-btn ws-btn-sm ws-focus">
                          <Icon name="chat" size={12} />
                          Open
                        </Link>
                      )}
                      {item.action.type === "reply" && (
                        <Link href={`/admin/clients/${item.action.clientId}`} className="ws-btn ws-btn-sm ws-focus">
                          <Icon name="reply" size={12} />
                          Reply
                        </Link>
                      )}
                      {item.action.type === "view-plan" && (
                        <Link href={`/admin/clients/${item.action.clientId}#plan`} className="ws-btn ws-btn-sm ws-focus">
                          <Icon name="plan" size={12} />
                          Set up plan
                        </Link>
                      )}
                      {item.action.type === "nudge" && (
                        <button type="button" onClick={() => openNudge(item)} className="ws-btn ws-btn-sm ws-focus">
                          <Icon name="bell" size={12} />
                          Nudge
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => dismissItem(item.id)}
                        className="ws-btn ws-btn-sm ws-btn-quiet ws-focus"
                        aria-label={`Hide ${item.clientName} until tomorrow`}
                        title="Hide until tomorrow"
                      >
                        Hide
                      </button>
                    </div>
                  </div>
                ))}
                {group.items.length > GROUP_ROWS && (
                  <button
                    type="button"
                    className="ws-more ws-focus"
                    onClick={() =>
                      setOpenGroups((prev) => {
                        const next = new Set(prev);
                        if (next.has(group.key)) next.delete(group.key);
                        else next.add(group.key);
                        return next;
                      })
                    }
                  >
                    {open ? "Show fewer" : `Show ${group.items.length - GROUP_ROWS} more`}
                  </button>
                )}
              </div>
            );
          })
        )}
      </section>

      {/* Nudge Modal */}
      {nudgeTarget && (
        <div className="ws-overlay">
          <div className="ws-overlay-bg" />
          <div className="ws-dialog" role="dialog" aria-modal="true" aria-label={`Nudge ${nudgeTarget.name.split(" ")[0]}`}>
            <div className="ws-dialog-head">
              <div>
                <h3 className="ws-dialog-title">Nudge {nudgeTarget.name.split(" ")[0]}</h3>
                <p className="ws-caption mt-1">Send a push notification to their device</p>
              </div>
            </div>
            <div className="ws-dialog-body">
              {nudgeSent ? (
                <div className="ws-note is-ok">
                  <Icon name="checkCircle" size={15} />
                  <span>Nudge sent</span>
                </div>
              ) : (
                <textarea
                  value={nudgeMessage}
                  onChange={(e) => setNudgeMessage(e.target.value)}
                  rows={4}
                  placeholder="Type your message..."
                  className="ws-input"
                  style={{ resize: "none" }}
                />
              )}

              <div className="ws-dialog-foot">
                <button type="button" onClick={() => setNudgeTarget(null)} className="ws-btn ws-focus">
                  {nudgeSent ? "Done" : "Cancel"}
                </button>
                {!nudgeSent && (
                  <button
                    type="button"
                    disabled={!nudgeMessage.trim() || nudgeSending}
                    onClick={sendNudge}
                    className="ws-btn ws-btn-primary ws-focus"
                  >
                    {nudgeSending ? (
                      <>
                        <Icon name="refresh" size={14} className="ws-spin" />
                        Sending...
                      </>
                    ) : "Send nudge"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// --- Check-Ins Panel with weekly grouping + expandable items + reply ---

interface EnrichedCheckin {
  id: string;
  client_id: string;
  week_number: number;
  mood: CheckInMood;
  wins?: string;
  challenges?: string;
  questions?: string;
  responses?: Record<string, string>;
  admin_reply?: string;
  replied_at?: string;
  client_reply?: string;
  client_replied_at?: string;
  created_at: string;
  client_name: string;
  client_business: string;
  client_status: TrafficLight;
}

function getWeekBucket(dateStr: string): "this_week" | "last_week" | "earlier" {
  const now = new Date();
  const d = new Date(dateStr);
  const startOfThisWeek = new Date(now);
  const dayOfWeek = now.getDay();
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  startOfThisWeek.setDate(now.getDate() - diffToMonday);
  startOfThisWeek.setHours(0, 0, 0, 0);

  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

  if (d >= startOfThisWeek) return "this_week";
  if (d >= startOfLastWeek) return "last_week";
  return "earlier";
}

interface CheckinAnswer {
  id: string;
  label: string;
  answer: string;
}

function formatResponseId(id: string): string {
  return id
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getCheckinAnswers(
  checkin: EnrichedCheckin,
  checkinConfig: CheckinFormConfig | null,
): CheckinAnswer[] {
  const responseEntries = Object.entries(checkin.responses || {})
    .filter(([id, value]) => !id.endsWith("__other") && Boolean(value?.trim()));

  if (responseEntries.length > 0) {
    const configuredIds = new Set(checkinConfig?.questions.map((question) => question.id) || []);
    const configuredAnswers = (checkinConfig?.questions || []).flatMap((question) => {
      const answer = getQuestionAnswerLabel(question, checkin.responses);
      return answer ? [{ id: question.id, label: question.label, answer }] : [];
    });
    const historicAnswers = responseEntries
      .filter(([id]) => !configuredIds.has(id))
      .map(([id, answer]) => ({
        id,
        label: formatResponseId(id),
        answer,
      }));

    return [...configuredAnswers, ...historicAnswers];
  }

  return [
    checkin.wins ? { id: "wins", label: "Wins", answer: checkin.wins } : null,
    checkin.challenges ? { id: "challenges", label: "Challenges", answer: checkin.challenges } : null,
    checkin.questions ? { id: "questions", label: "Questions", answer: checkin.questions } : null,
  ].filter((item): item is CheckinAnswer => item !== null);
}

function CheckInsPanel({
  checkins,
  checkinConfig,
}: {
  checkins: EnrichedCheckin[];
  checkinConfig: CheckinFormConfig | null;
}) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(checkins.map((checkin) => checkin.id)),
  );
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set(["earlier"]));
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [sentReplies, setSentReplies] = useState<Record<string, string>>({});
  const [replyDraftIds, setReplyDraftIds] = useState<Record<string, string>>({});
  const [sendingReply, setSendingReply] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);

  const thisWeek = checkins.filter((c) => getWeekBucket(c.created_at) === "this_week");
  const lastWeek = checkins.filter((c) => getWeekBucket(c.created_at) === "last_week");
  const earlier = checkins.filter((c) => getWeekBucket(c.created_at) === "earlier");

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSection(key: string) {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleReply(checkinId: string) {
    const text = replies[checkinId];
    if (!text?.trim()) return;
    setSendingReply(checkinId);
    setReplyError(null);

    try {
      const res = await fetch("/api/admin/reply-checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkin_id: checkinId, reply_text: text, reply_draft_id: replyDraftIds[checkinId] }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send reply");
      }

      setSentReplies((prev) => ({ ...prev, [checkinId]: text }));
      setReplies((prev) => ({ ...prev, [checkinId]: "" }));
      toast("Reply sent successfully");
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : "Failed to send reply");
      toast("Failed to send reply", "error");
    } finally {
      setSendingReply(null);
    }
  }

  const sections = [
    { key: "this_week", label: "This week", items: thisWeek },
    { key: "last_week", label: "Last week", items: lastWeek },
    { key: "earlier", label: "Earlier", items: earlier },
  ].filter((s) => s.items.length > 0);

  return (
    <section className="ws-panel min-w-0" aria-label="Recent check-ins">
      <div className="ws-panel-head">
        <h2 className="ws-h2">Recent check-ins</h2>
        <span className="ws-caption">{checkins.length}</span>
      </div>
      <div>
        {sections.length === 0 && <p className="ws-up-none" style={{ padding: "14px" }}>No check-ins yet.</p>}
        {sections.map((section) => {
          const isCollapsed = collapsedSections.has(section.key);
          const pending = section.items.filter((c) => !c.admin_reply && !sentReplies[c.id]).length;
          return (
            <div key={section.key}>
              <button
                type="button"
                onClick={() => toggleSection(section.key)}
                aria-expanded={!isCollapsed}
                className="ws-group ws-focus w-full text-left"
                style={{ background: "transparent", border: 0, borderBottom: "1px solid var(--ws-line)", cursor: "pointer", font: "inherit" }}
              >
                <Icon name="chevron" size={12} className={`ws-chev ${isCollapsed ? "" : "is-open"}`} />
                {section.label}
                <span className="ws-cnt">{section.items.length}</span>
                {pending > 0 && <Chip tone="attn">{pending} pending</Chip>}
              </button>

              {!isCollapsed &&
                section.items.map((checkin) => (
                  <CheckInRow
                    key={checkin.id}
                    checkin={checkin}
                    checkinConfig={checkinConfig}
                    isExpanded={expanded.has(checkin.id)}
                    onToggle={() => toggleExpand(checkin.id)}
                    replyText={replies[checkin.id] || ""}
                    onReplyChange={(text) => setReplies((prev) => ({ ...prev, [checkin.id]: text }))}
                    onReplySubmit={() => handleReply(checkin.id)}
                    onDraftEdit={(text, draftId) => {
                      setReplies((prev) => ({ ...prev, [checkin.id]: text }));
                      setReplyDraftIds((prev) => ({ ...prev, [checkin.id]: draftId }));
                    }}
                    onDraftSent={(text) => setSentReplies((prev) => ({ ...prev, [checkin.id]: text }))}
                    sentReply={sentReplies[checkin.id]}
                    isSending={sendingReply === checkin.id}
                    error={sendingReply === checkin.id ? replyError : null}
                  />
                ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CheckInRow({
  checkin,
  checkinConfig,
  isExpanded,
  onToggle,
  replyText,
  onReplyChange,
  onReplySubmit,
  onDraftEdit,
  onDraftSent,
  sentReply,
  isSending,
  error,
}: {
  checkin: EnrichedCheckin;
  checkinConfig: CheckinFormConfig | null;
  isExpanded: boolean;
  onToggle: () => void;
  replyText: string;
  onReplyChange: (text: string) => void;
  onReplySubmit: () => void;
  onDraftEdit: (text: string, draftId: string) => void;
  onDraftSent: (text: string) => void;
  sentReply?: string;
  isSending?: boolean;
  error?: string | null;
}) {
  const mc = moodConfig[checkin.mood] || moodConfig.struggling;
  const hasReply = checkin.admin_reply || sentReply;
  const answers = getCheckinAnswers(checkin, checkinConfig);

  return (
    <div>
      <button type="button" onClick={onToggle} aria-expanded={isExpanded} className="ws-row ws-focus">
        <StatusIcon tone={hasReply ? "ok" : "decide"} />
        <span className="min-w-0">
          <span className="ws-row-title">
            {checkin.client_name} <span style={{ color: "var(--ws-ink-3)" }}>· Week {checkin.week_number}</span>
          </span>
          {!isExpanded && <span className="ws-row-sub">{answers[0]?.answer || "No details"}</span>}
        </span>
        <span className="ws-row-meta">
          <Chip tone={mc.tone}>{moodText(checkin.mood)}</Chip>
          <span className="ws-row-time" style={hasReply ? undefined : { color: "var(--ws-attn)" }}>
            {hasReply ? "Replied" : "Pending"}
          </span>
        </span>
      </button>

      {isExpanded && (
        <div className="ws-expand">
          <div className="ws-expand-box space-y-3">
            <div className="flex items-center justify-between ws-caption">
              <span>{checkin.client_business}</span>
              <span>{new Date(checkin.created_at).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</span>
            </div>

            {answers.length > 0 ? (
              <div className="space-y-3">
                {answers.map((item) => (
                  <div key={item.id}>
                    <div className="ws-field-l">{item.label}</div>
                    <p className="ws-prose" style={{ fontSize: 13 }}>{item.answer}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="ws-caption">No written responses were submitted.</p>
            )}
            {checkin.client_reply && (
              <div className="ws-quote" style={{ "--c": "var(--ws-ok)" } as CSSProperties}>
                <div className="ws-quote-h">
                  Client reply
                  {checkin.client_replied_at && (
                    <span className="ws-caption" style={{ fontWeight: 400 }}>
                      {new Date(checkin.client_replied_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </span>
                  )}
                </div>
                <p className="ws-prose" style={{ fontSize: 13 }}>{checkin.client_reply}</p>
              </div>
            )}

            {/* Reply section */}
            {checkin.admin_reply ? (
              <div className="ws-quote" style={{ "--c": "var(--ws-accent-ink)" } as CSSProperties}>
                <div className="ws-quote-h">Marc&apos;s reply</div>
                <p className="ws-prose" style={{ fontSize: 13 }}>{checkin.admin_reply}</p>
              </div>
            ) : sentReply ? (
              <div className="ws-quote" style={{ "--c": "var(--ws-ok)" } as CSSProperties}>
                <div className="ws-quote-h">
                  Marc&apos;s reply
                  <span className="ws-caption" style={{ fontWeight: 400 }}>Just now</span>
                </div>
                <p className="ws-prose" style={{ fontSize: 13 }}>{sentReply}</p>
              </div>
            ) : (
              <div className="pt-3" style={{ borderTop: "1px solid var(--ws-line)" }}>
                <div className="mb-2">
                  <ReplyDraftCard scope={{ checkinId: checkin.id }} onEdit={onDraftEdit} onSent={onDraftSent} />
                </div>
                <label className="ws-label">Reply to this check-in</label>
                <textarea
                  value={replyText}
                  onChange={(e) => onReplyChange(e.target.value)}
                  rows={3}
                  placeholder="Type your reply..."
                  disabled={isSending}
                  className="ws-input"
                  style={{ resize: "none" }}
                />
                {error && <div className="ws-caption mt-1" style={{ color: "var(--ws-bad)" }}>{error}</div>}
                <div className="flex justify-end mt-2">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onReplySubmit(); }}
                    disabled={!replyText.trim() || isSending}
                    className="ws-btn ws-btn-primary ws-focus"
                  >
                    {isSending ? (
                      <>
                        <Icon name="refresh" size={14} className="ws-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Icon name="send" size={14} />
                        Send reply
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
