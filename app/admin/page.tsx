"use client";
import AttentionCard from "@/components/ops/AttentionCard";
import { lastPortalActivity } from "@/lib/portal-activity";

import { useState, useEffect, type CSSProperties } from "react";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import type { AdminClient } from "@/lib/admin-data";
import { getQuestionAnswerLabel } from "@/lib/questionnaires";
import type { TrafficLight, CheckInMood, CheckIn, CheckinFormConfig } from "@/lib/types";
import { Chip, Icon, SkeletonRows, StatusIcon } from "@/components/ops/workspace/WorkspaceUI";

const statusLabel: Record<TrafficLight, { text: string; tone: "bad" | "attn" | "ok"; colour: string }> = {
  red: { text: "Needs attention", tone: "bad", colour: "var(--ws-bad)" },
  amber: { text: "Check-in due", tone: "attn", colour: "var(--ws-attn)" },
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

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [recentCheckins, setRecentCheckins] = useState<EnrichedCheckin[]>([]);
  const [checkinConfig, setCheckinConfig] = useState<CheckinFormConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
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

  const greenCount = clients.filter((c) => c.status === "green").length;
  const amberCount = clients.filter((c) => c.status === "amber").length;
  const redCount = clients.filter((c) => c.status === "red").length;
  const unreplied = recentCheckins.filter((c) => !c.admin_reply).length;

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

  const attention = amberCount + redCount;

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
          <span className="ws-stat-l"><Icon name="users" size={14} />Total clients</span>
          <span className="ws-stat-n">{clients.length}</span>
          <span className="ws-stat-s">in the portal</span>
        </div>
        <div className="ws-stat" style={{ cursor: "default" }}>
          <span className="ws-stat-l"><Icon name="checkCircle" size={14} />On track</span>
          <span className="ws-stat-n">{greenCount}</span>
          <span className="ws-stat-s is-ok">{clients.length ? Math.round((greenCount / clients.length) * 100) : 0}% of clients</span>
        </div>
        <div className="ws-stat" style={{ cursor: "default" }}>
          <span className="ws-stat-l"><Icon name="alert" size={14} />Needs attention</span>
          <span className={`ws-stat-n ${attention > 0 ? "is-on" : ""}`}>{attention}</span>
          <span className={`ws-stat-s ${redCount > 0 ? "is-attn" : ""}`}>
            {redCount > 0 ? `${redCount} behind schedule` : "nobody behind schedule"}
          </span>
        </div>
        <div className="ws-stat" style={{ cursor: "default" }}>
          <span className="ws-stat-l"><Icon name="reply" size={14} />Unreplied check-ins</span>
          <span className={`ws-stat-n ${unreplied > 0 ? "is-on" : ""}`}>{unreplied}</span>
          <span className="ws-stat-s">{unreplied > 0 ? "waiting for a reply" : "all replied"}</span>
        </div>
      </div>

      {/* Blueprint AI Overview */}
      <BlueprintOverview clients={clients} recentCheckins={recentCheckins} />

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
            {clients.map((client) => {
              const sl = statusLabel[client.status];
              const isExpanded = expandedClient === client.id;
              const activePlans = client.business_plan.filter((p) => p.status === "active");
              const allItems = activePlans.flatMap((plan) => plan.phases.flatMap((ph) => ph.items));
              const planTotal = allItems.length;
              const planDone = allItems.filter((p) => p.completed).length;
              const planPct = planTotal > 0 ? Math.round((planDone / planTotal) * 100) : 0;
              const lateCheckin = new Date().getTime() - new Date(client.last_checkin).getTime() > 7 * 24 * 60 * 60 * 1000;

              return (
                <div key={client.id}>
                  <button
                    type="button"
                    onClick={() => setExpandedClient(isExpanded ? null : client.id)}
                    aria-expanded={isExpanded}
                    className="ws-row ws-focus"
                    style={{ gridTemplateColumns: "26px minmax(0,1fr) auto" }}
                  >
                    <span className="ws-avatar is-md" aria-hidden="true" style={{ "--c": sl.colour } as CSSProperties}>
                      {initials(client.name)}
                    </span>
                    <span className="min-w-0">
                      <span className="ws-row-title">{client.name}</span>
                      {client.business_name && <span className="ws-row-sub">{client.business_name}</span>}
                    </span>
                    <span className="ws-row-meta">
                      <Chip tone={sl.tone}>{sl.text}</Chip>
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
                          <Chip tone={sl.tone}>{sl.text}</Chip>
                        </div>
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

interface BriefingInsight {
  id: string;
  icon: string;
  text: string;
  action?: { type: "nudge"; clientName: string; userId: string; clientId: string }
    | { type: "reply"; clientId: string }
    | { type: "view-plan"; clientId: string };
}

function BlueprintOverview({ clients, recentCheckins }: { clients: AdminClient[]; recentCheckins: EnrichedCheckin[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(loadDismissedBriefingIds);
  const [showAll, setShowAll] = useState(false);
  const [nudgeTarget, setNudgeTarget] = useState<{ name: string; userId: string } | null>(null);
  const [nudgeMessage, setNudgeMessage] = useState("");
  const [nudgeSending, setNudgeSending] = useState(false);
  const [nudgeSent, setNudgeSent] = useState(false);

  function dismissInsight(insightId: string) {
    setDismissed(prev => {
      const next = new Set(prev);
      next.add(insightId);
      saveDismissedBriefingIds(next);
      return next;
    });
  }

  const redClients = clients.filter(c => c.status === "red");
  const amberClients = clients.filter(c => c.status === "amber");
  const unrepliedCheckins = recentCheckins.filter(c => !c.admin_reply);
  const stalledClients = clients.filter(c => {
    const activePlans = c.business_plan.filter(p => p.status === "active");
    if (activePlans.length === 0) return false;
    const items = activePlans.flatMap((plan) => plan.phases.flatMap(ph => ph.items));
    const total = items.length;
    const done = items.filter(i => i.completed).length;
    return total > 0 && (done / total) < 0.3 && c.current_week > 4;
  });

  const insights: BriefingInsight[] = [];

  for (const c of redClients) {
    const daysSinceActivity = Math.floor((Date.now() - new Date(lastPortalActivity(c.last_login, c.last_checkin)).getTime()) / (1000 * 60 * 60 * 24));
    const daysSinceCheckin = Math.floor((Date.now() - new Date(c.last_checkin).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceActivity > 10) {
      insights.push({ id: `login-${c.id}`, icon: "alert", text: `${c.name} hasn't been active for ${daysSinceActivity} days - consider reaching out`, action: { type: "nudge", clientName: c.name, userId: c.user_id, clientId: c.id } });
    } else if (daysSinceCheckin > 14) {
      insights.push({ id: `checkin-${c.id}`, icon: "alert", text: `${c.name} hasn't checked in for ${daysSinceCheckin} days`, action: { type: "nudge", clientName: c.name, userId: c.user_id, clientId: c.id } });
    }
  }

  for (const c of amberClients) {
    const daysSinceCheckin = Math.floor((Date.now() - new Date(c.last_checkin).getTime()) / (1000 * 60 * 60 * 24));
    insights.push({ id: `amber-${c.id}`, icon: "clock", text: `${c.name} is ${daysSinceCheckin} days since last check-in`, action: { type: "nudge", clientName: c.name, userId: c.user_id, clientId: c.id } });
  }

  if (unrepliedCheckins.length > 0) {
    // Group by client for individual actions
    const byClient = new Map<string, EnrichedCheckin[]>();
    for (const ck of unrepliedCheckins) {
      if (!byClient.has(ck.client_id)) byClient.set(ck.client_id, []);
      byClient.get(ck.client_id)!.push(ck);
    }
    for (const [clientId, cks] of byClient) {
      const name = cks[0].client_name;
      insights.push({ id: `reply-${clientId}`, icon: "reply", text: `${cks.length} unreplied check-in${cks.length > 1 ? "s" : ""} from ${name}`, action: { type: "reply", clientId } });
    }
  }

  for (const c of stalledClients) {
    const items = c.business_plan
      .filter((plan) => plan.status === "active")
      .flatMap((plan) => plan.phases.flatMap(ph => ph.items));
    const pct = Math.round((items.filter(i => i.completed).length / items.length) * 100);
    insights.push({ id: `plan-${c.id}`, icon: "plan", text: `${c.name}'s plan is only ${pct}% complete at week ${c.current_week}`, action: { type: "view-plan", clientId: c.id } });
  }

  const visibleInsights = insights.filter(i => !dismissed.has(i.id));

  if (visibleInsights.length === 0 && insights.length > 0) {
    // All dismissed
    visibleInsights.push({ id: "all-clear", icon: "check", text: "All caught up - no actions remaining" });
  } else if (insights.length === 0) {
    visibleInsights.push({ id: "on-track", icon: "check", text: "All clients are on track - no immediate actions needed" });
  }

  const shownInsights = showAll ? visibleInsights : visibleInsights.slice(0, 3);

  const iconMap: Record<string, React.ReactNode> = {
    alert: <StatusIcon tone="attn" />,
    clock: <StatusIcon tone="attn" />,
    reply: <StatusIcon tone="decide" />,
    plan: <StatusIcon tone="attn" />,
    check: <StatusIcon tone="ok" />,
  };

  function handleNudge(insight: BriefingInsight) {
    if (insight.action?.type !== "nudge") return;
    const firstName = insight.action.clientName.split(" ")[0];
    setNudgeTarget({ name: insight.action.clientName, userId: insight.action.userId });
    setNudgeMessage(`Hey ${firstName}, just checking in - haven't seen you in the portal for a bit. Everything OK? Jump back in when you're ready, your plan is waiting.`);
    setNudgeSent(false);
  }

  async function sendNudge(insightId: string) {
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
        dismissInsight(insightId);
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
      <section className="ws-panel" aria-label="Blueprint AI daily briefing">
        <div className="ws-panel-head">
          <span className="ws-avatar is-sm" aria-hidden="true">
            <Icon name="sparkle" size={11} stroke={2.2} />
          </span>
          <h2 className="ws-h2">
            Blueprint AI <span className="ws-caption" style={{ fontWeight: 400 }}>· your daily briefing</span>
          </h2>
          <span className="ws-caption">
            {visibleInsights.length} item{visibleInsights.length === 1 ? "" : "s"}
          </span>
        </div>
        <div>
          {shownInsights.map((insight) => (
            <div key={insight.id} className="ws-line">
              {iconMap[insight.icon]}
              <div className="min-w-0">
                <span className="text-[13.5px]" style={{ color: "var(--ws-ink)" }}>{insight.text}</span>
                {insight.action && (
                  <div className="ws-acts">
                    {insight.action.type === "nudge" && (
                      <button type="button" onClick={() => handleNudge(insight)} className="ws-btn ws-btn-sm ws-focus">
                        <Icon name="bell" size={12} />
                        Send nudge
                      </button>
                    )}
                    {insight.action.type === "reply" && (
                      <Link href={`/admin/clients/${insight.action.clientId}`} className="ws-btn ws-btn-sm ws-focus">
                        <Icon name="reply" size={12} />
                        Reply now
                      </Link>
                    )}
                    {insight.action.type === "view-plan" && (
                      <Link href={`/admin/clients/${insight.action.clientId}`} className="ws-btn ws-btn-sm ws-focus">
                        <Icon name="plan" size={12} />
                        View plan
                      </Link>
                    )}
                    <button type="button" onClick={() => dismissInsight(insight.id)} className="ws-btn ws-btn-sm ws-btn-quiet ws-focus">
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        {visibleInsights.length > 3 && (
          <button type="button" onClick={() => setShowAll((current) => !current)} className="ws-more ws-focus">
            {showAll ? "Show priority items only" : `Show all ${visibleInsights.length} briefing items`}
          </button>
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
                    onClick={() => {
                      const insightId = insights.find(i => i.action?.type === "nudge" && (i.action as { userId: string }).userId === nudgeTarget.userId)?.id;
                      if (insightId) sendNudge(insightId);
                    }}
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
        body: JSON.stringify({ checkin_id: checkinId, reply_text: text }),
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
