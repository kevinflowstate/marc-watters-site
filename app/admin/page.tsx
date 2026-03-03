"use client";

import { useState } from "react";
import Link from "next/link";
import { getClientsSorted, getAllRecentCheckins } from "@/lib/demo-data";
import type { TrafficLight, CheckInMood } from "@/lib/types";

const glowClass: Record<TrafficLight, string> = {
  green: "glow-green",
  amber: "glow-amber",
  red: "glow-red",
};

const statusLabel: Record<TrafficLight, { text: string; dotClass: string; bgClass: string; textClass: string }> = {
  red: { text: "Needs Attention", dotClass: "bg-red-500", bgClass: "bg-red-500/10", textClass: "text-red-400" },
  amber: { text: "Check In Due", dotClass: "bg-amber-500", bgClass: "bg-amber-500/10", textClass: "text-amber-400" },
  green: { text: "On Track", dotClass: "bg-emerald-500", bgClass: "bg-emerald-500/10", textClass: "text-emerald-400" },
};

const moodConfig: Record<CheckInMood, { bgClass: string; textClass: string }> = {
  great: { bgClass: "bg-emerald-500/10", textClass: "text-emerald-400" },
  good: { bgClass: "bg-blue-500/10", textClass: "text-blue-400" },
  okay: { bgClass: "bg-amber-500/10", textClass: "text-amber-400" },
  struggling: { bgClass: "bg-red-500/10", textClass: "text-red-400" },
};

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

export default function AdminDashboard() {
  const clients = getClientsSorted();
  const recentCheckins = getAllRecentCheckins();
  const [expandedClient, setExpandedClient] = useState<string | null>(null);

  const greenCount = clients.filter((c) => c.status === "green").length;
  const amberCount = clients.filter((c) => c.status === "amber").length;
  const redCount = clients.filter((c) => c.status === "red").length;
  const unreplied = recentCheckins.filter((c) => !c.admin_reply).length;

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold text-text-primary">Admin Dashboard</h1>
        <p className="text-text-secondary mt-1">Overview of all clients and activity.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(255,255,255,0.04)] rounded-2xl p-6">
          <div className="text-text-muted text-xs uppercase tracking-wider mb-2">Total Clients</div>
          <div className="text-3xl font-heading font-bold text-text-primary">{clients.length}</div>
        </div>
        <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(16,185,129,0.15)] rounded-2xl p-6">
          <div className="text-text-muted text-xs uppercase tracking-wider mb-2">On Track</div>
          <div className="text-3xl font-heading font-bold text-emerald-400">{greenCount}</div>
        </div>
        <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(245,158,11,0.15)] rounded-2xl p-6">
          <div className="text-text-muted text-xs uppercase tracking-wider mb-2">Needs Attention</div>
          <div className={`text-3xl font-heading font-bold ${amberCount + redCount > 0 ? "text-amber-400" : "text-text-primary"}`}>
            {amberCount + redCount}
          </div>
          {redCount > 0 && (
            <div className="text-red-400 text-xs mt-1">{redCount} behind schedule</div>
          )}
        </div>
        <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(255,255,255,0.04)] rounded-2xl p-6">
          <div className="text-text-muted text-xs uppercase tracking-wider mb-2">Unreplied Check-Ins</div>
          <div className={`text-3xl font-heading font-bold ${unreplied > 0 ? "text-red-400" : "text-text-primary"}`}>
            {unreplied}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6">
        {/* Compact client list with expandable detail */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-heading font-bold text-text-primary">Clients</h2>
            <Link href="/admin/clients" className="text-sm text-accent-bright hover:text-accent-light transition-colors no-underline">
              View All
            </Link>
          </div>
          <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(255,255,255,0.04)] rounded-2xl overflow-hidden">
            {clients.map((client) => {
              const sl = statusLabel[client.status];
              const isExpanded = expandedClient === client.id;
              const planTotal = client.business_plan.length;
              const planDone = client.business_plan.filter((p) => p.completed).length;
              const planPct = planTotal > 0 ? Math.round((planDone / planTotal) * 100) : 0;

              return (
                <div key={client.id} className="border-b border-[rgba(255,255,255,0.03)] last:border-b-0">
                  {/* Compact row - name + glow */}
                  <button
                    onClick={() => setExpandedClient(isExpanded ? null : client.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[rgba(255,255,255,0.02)] transition-colors text-left"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 border ${sl.bgClass} ${sl.textClass} ${
                      client.status === "red" ? "border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.2)]"
                      : client.status === "amber" ? "border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                      : "border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                    }`}>
                      {client.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <span className="text-sm font-medium text-text-primary flex-1">{client.name}</span>
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${sl.dotClass}`} />
                    <svg
                      className={`w-3.5 h-3.5 text-text-muted transition-transform duration-200 flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className={`px-4 pb-4 pt-1 border-l-2 ml-4 ${
                      client.status === "red" ? "border-red-500/30" : client.status === "amber" ? "border-amber-500/30" : "border-emerald-500/30"
                    }`}>
                      <div className="bg-[rgba(255,255,255,0.015)] rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <div className="text-xs text-text-muted">{client.business_name} - {client.business_type}</div>
                          </div>
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${sl.bgClass} ${sl.textClass}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${sl.dotClass}`} />
                            {sl.text}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-3 text-xs mb-3">
                          <div>
                            <div className="text-text-muted mb-0.5">Week</div>
                            <div className="text-text-primary font-semibold">{client.current_week}/12</div>
                          </div>
                          <div>
                            <div className="text-text-muted mb-0.5">Last Check-In</div>
                            <div className={`font-semibold ${
                              new Date().getTime() - new Date(client.last_checkin).getTime() > 7 * 24 * 60 * 60 * 1000
                                ? "text-red-400" : "text-text-primary"
                            }`}>
                              {timeAgo(client.last_checkin)}
                            </div>
                          </div>
                          <div>
                            <div className="text-text-muted mb-0.5">Plan</div>
                            <div className="text-text-primary font-semibold">{planDone}/{planTotal} ({planPct}%)</div>
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div className="h-1.5 bg-[rgba(255,255,255,0.03)] rounded-full overflow-hidden mb-3">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              client.status === "red" ? "bg-red-500/60" : client.status === "amber" ? "bg-amber-500/60" : "bg-emerald-500/60"
                            }`}
                            style={{ width: `${planPct}%` }}
                          />
                        </div>

                        <Link
                          href={`/admin/clients/${client.id}`}
                          className="text-xs text-accent-bright hover:text-accent-light transition-colors no-underline inline-flex items-center gap-1"
                        >
                          View Full Profile
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent check-ins - grouped by week */}
        <CheckInsPanel checkins={recentCheckins} />
      </div>
    </>
  );
}

// --- Check-Ins Panel with weekly grouping + expandable items + reply ---

type EnrichedCheckin = ReturnType<typeof getAllRecentCheckins>[number];

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

function CheckInsPanel({ checkins }: { checkins: EnrichedCheckin[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
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
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : "Failed to send reply");
    } finally {
      setSendingReply(null);
    }
  }

  const sections = [
    { key: "this_week", label: "This Week", items: thisWeek },
    { key: "last_week", label: "Last Week", items: lastWeek },
    { key: "earlier", label: "Earlier", items: earlier },
  ].filter((s) => s.items.length > 0);

  return (
    <div>
      <h2 className="text-lg font-heading font-bold text-text-primary mb-4">Recent Check-Ins</h2>
      <div className="space-y-3">
        {sections.map((section) => {
          const isCollapsed = collapsedSections.has(section.key);
          return (
            <div key={section.key} className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(255,255,255,0.04)] rounded-2xl overflow-hidden">
              <button
                onClick={() => toggleSection(section.key)}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-[rgba(255,255,255,0.02)] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-text-primary">{section.label}</span>
                  <span className="text-[10px] text-text-muted bg-[rgba(255,255,255,0.04)] px-2 py-0.5 rounded-full">
                    {section.items.length}
                  </span>
                  {section.items.some((c) => !c.admin_reply && !sentReplies[c.id]) && (
                    <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full font-medium">
                      {section.items.filter((c) => !c.admin_reply && !sentReplies[c.id]).length} pending
                    </span>
                  )}
                </div>
                <svg
                  className={`w-4 h-4 text-text-muted transition-transform duration-200 ${isCollapsed ? "" : "rotate-180"}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {!isCollapsed && (
                <div className="border-t border-[rgba(255,255,255,0.03)]">
                  {section.items.map((checkin) => (
                    <CheckInRow
                      key={checkin.id}
                      checkin={checkin}
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
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CheckInRow({
  checkin,
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
  isExpanded: boolean;
  onToggle: () => void;
  replyText: string;
  onReplyChange: (text: string) => void;
  onReplySubmit: () => void;
  sentReply?: string;
  isSending?: boolean;
  error?: string | null;
}) {
  const mc = moodConfig[checkin.mood];
  const hasReply = checkin.admin_reply || sentReply;

  return (
    <div className="border-b border-[rgba(255,255,255,0.02)] last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-3 py-3 px-5 hover:bg-[rgba(255,255,255,0.02)] transition-colors text-left"
      >
        <span className={`text-[10px] font-semibold px-2 py-1 rounded-full mt-0.5 uppercase tracking-wider flex-shrink-0 ${mc.bgClass} ${mc.textClass}`}>
          {checkin.mood}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium text-text-primary">{checkin.client_name}</span>
            <span className="text-[10px] text-text-muted">Week {checkin.week_number}</span>
          </div>
          {!isExpanded && (
            <p className="text-xs text-text-secondary truncate">
              {checkin.wins || checkin.challenges || checkin.questions || "No details"}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasReply ? (
            <span className="text-[10px] text-emerald-400 font-medium">Replied</span>
          ) : (
            <span className="text-[10px] text-amber-400 font-medium">Pending</span>
          )}
          <svg
            className={`w-3.5 h-3.5 text-text-muted transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isExpanded && (
        <div className="px-5 pb-4 pt-1 ml-[38px]">
          <div className="bg-[rgba(255,255,255,0.015)] border border-[rgba(255,255,255,0.04)] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-text-muted mb-2">
              <span>{checkin.client_business}</span>
              <span>{new Date(checkin.created_at).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</span>
            </div>

            {checkin.wins && (
              <div>
                <div className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider mb-1">Wins</div>
                <p className="text-xs text-text-secondary leading-relaxed">{checkin.wins}</p>
              </div>
            )}
            {checkin.challenges && (
              <div>
                <div className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider mb-1">Challenges</div>
                <p className="text-xs text-text-secondary leading-relaxed">{checkin.challenges}</p>
              </div>
            )}
            {checkin.questions && (
              <div>
                <div className="text-[10px] text-accent-bright font-semibold uppercase tracking-wider mb-1">Questions</div>
                <p className="text-xs text-text-secondary leading-relaxed">{checkin.questions}</p>
              </div>
            )}

            {/* Reply section */}
            {checkin.admin_reply ? (
              <div className="mt-2 pl-3 border-l-2 border-accent/30 bg-accent/5 rounded-r-lg py-2 pr-3">
                <div className="text-[10px] text-accent-bright font-semibold uppercase tracking-wider mb-1">Marc&apos;s Reply</div>
                <p className="text-xs text-text-secondary leading-relaxed">{checkin.admin_reply}</p>
              </div>
            ) : sentReply ? (
              <div className="mt-2 pl-3 border-l-2 border-emerald-500/30 bg-emerald-500/5 rounded-r-lg py-2 pr-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">Marc&apos;s Reply</div>
                  <span className="text-[10px] text-emerald-400/60">Just now</span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">{sentReply}</p>
              </div>
            ) : (
              <div className="mt-2 pt-3 border-t border-[rgba(255,255,255,0.04)]">
                <div className="text-[10px] text-text-muted font-semibold uppercase tracking-wider mb-2">Reply to this check-in</div>
                <textarea
                  value={replyText}
                  onChange={(e) => onReplyChange(e.target.value)}
                  rows={3}
                  placeholder="Type your reply..."
                  disabled={isSending}
                  className="w-full bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-3 py-2.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors resize-none disabled:opacity-50"
                />
                {error && (
                  <div className="text-xs text-red-400 mt-1">{error}</div>
                )}
                <div className="flex justify-end mt-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); onReplySubmit(); }}
                    disabled={!replyText.trim() || isSending}
                    className="px-4 py-2 gradient-accent text-white rounded-lg text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-opacity inline-flex items-center gap-1.5"
                  >
                    {isSending ? (
                      <>
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Sending...
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        Send Reply
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
