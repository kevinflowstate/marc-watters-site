"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getClientById } from "@/lib/demo-data";
import type { TrafficLight, CheckInMood, BusinessPlanItem } from "@/lib/types";

const glowClass: Record<TrafficLight, string> = {
  green: "glow-green",
  amber: "glow-amber",
  red: "glow-red",
};

const statusConfig: Record<TrafficLight, { label: string; dotClass: string; bgClass: string; textClass: string; ringClass: string }> = {
  red: { label: "Needs Attention", dotClass: "bg-red-500", bgClass: "bg-red-500/10", textClass: "text-red-400", ringClass: "ring-red-500" },
  amber: { label: "Check In Due", dotClass: "bg-amber-500", bgClass: "bg-amber-500/10", textClass: "text-amber-400", ringClass: "ring-amber-500" },
  green: { label: "On Track", dotClass: "bg-emerald-500", bgClass: "bg-emerald-500/10", textClass: "text-emerald-400", ringClass: "ring-emerald-500" },
};

const moodConfig: Record<CheckInMood, { bgClass: string; textClass: string }> = {
  great: { bgClass: "bg-emerald-500/10", textClass: "text-emerald-400" },
  good: { bgClass: "bg-blue-500/10", textClass: "text-blue-400" },
  okay: { bgClass: "bg-amber-500/10", textClass: "text-amber-400" },
  struggling: { bgClass: "bg-red-500/10", textClass: "text-red-400" },
};

const categoryIcons: Record<string, string> = {
  "Financial Foundation": "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  "Pipeline & Sales": "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
  "Team & People": "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
  "Systems & Operations": "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  "Standards & Quality": "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
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

export default function ClientDetailPage() {
  const { id } = useParams();
  const client = getClientById(id as string);
  const [planItems, setPlanItems] = useState<BusinessPlanItem[]>(client?.business_plan || []);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(
    client ? [...new Set(client.business_plan.map((p) => p.category))] : []
  ));
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [sentReplies, setSentReplies] = useState<Record<string, string>>({});
  const [sendingReply, setSendingReply] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);

  async function handleReply(checkinId: string) {
    const text = replyTexts[checkinId];
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
      setReplyTexts((prev) => ({ ...prev, [checkinId]: "" }));
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : "Failed to send reply");
    } finally {
      setSendingReply(null);
    }
  }

  if (!client) {
    return (
      <div className="text-text-muted">
        <Link href="/admin/clients" className="text-accent-bright hover:text-accent-light transition-colors no-underline text-sm">
          Back to Clients
        </Link>
        <p className="mt-4">Client not found.</p>
      </div>
    );
  }

  const sc = statusConfig[client.status];
  const planTotal = planItems.length;
  const planDone = planItems.filter((p) => p.completed).length;
  const planPct = planTotal > 0 ? Math.round((planDone / planTotal) * 100) : 0;

  // Group plan items by category
  const categories = [...new Set(planItems.map((p) => p.category))];
  const grouped = categories.map((cat) => ({
    name: cat,
    items: planItems.filter((p) => p.category === cat),
    done: planItems.filter((p) => p.category === cat && p.completed).length,
    total: planItems.filter((p) => p.category === cat).length,
  }));

  function toggleItem(itemId: string) {
    setPlanItems((prev) =>
      prev.map((p) =>
        p.id === itemId
          ? { ...p, completed: !p.completed, completed_at: !p.completed ? new Date().toISOString() : undefined }
          : p
      )
    );
  }

  function toggleCategory(cat: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  // Week progress
  const totalWeeks = 12;
  const currentWeek = client.current_week;

  // Calculate alert context for red/amber clients
  const now = new Date();
  const lastLoginDays = Math.floor((now.getTime() - new Date(client.last_login).getTime()) / (1000 * 60 * 60 * 24));
  const lastCheckinDays = Math.floor((now.getTime() - new Date(client.last_checkin).getTime()) / (1000 * 60 * 60 * 24));
  // Expected weekly check-ins: count how many weeks since start with no check-in
  const weeksSinceStart = Math.floor((now.getTime() - new Date(client.start_date).getTime()) / (1000 * 60 * 60 * 24 * 7));
  const expectedCheckins = weeksSinceStart;
  const actualCheckins = client.checkins.length;
  const missedCheckins = Math.max(0, expectedCheckins - actualCheckins);

  return (
    <>
      <Link
        href="/admin"
        className="text-text-muted text-sm hover:text-text-secondary transition-colors no-underline inline-flex items-center gap-1 mb-6"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Dashboard
      </Link>

      {/* Header with glow */}
      <div className={`bg-bg-card/80 backdrop-blur-sm border rounded-2xl p-6 mb-6 transition-all duration-300 ${glowClass[client.status]}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold ${sc.bgClass} ${sc.textClass} border ${
              client.status === "red" ? "border-red-500/30" : client.status === "amber" ? "border-amber-500/30" : "border-emerald-500/30"
            }`}>
              {client.name.split(" ").map((n) => n[0]).join("")}
            </div>
            <div>
              <h1 className="text-2xl font-heading font-bold text-text-primary">{client.name}</h1>
              <p className="text-text-secondary text-sm">{client.email} - {client.phone}</p>
              <p className="text-text-muted text-xs mt-0.5">{client.business_name} ({client.business_type})</p>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${sc.bgClass} ${sc.textClass}`}>
            <span className={`w-2 h-2 rounded-full ${sc.dotClass}`} />
            {sc.label}
          </span>
        </div>
      </div>

      {/* Status alert banner */}
      {client.status === "red" && (
        <div className="flex items-start gap-3 bg-red-500/[0.06] border border-red-500/20 rounded-2xl px-5 py-4 mb-6">
          <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold text-red-400 mb-0.5">This client needs attention</div>
            <div className="text-xs text-text-secondary leading-relaxed">
              Last login was <span className="text-red-400 font-medium">{lastLoginDays} days ago</span>
              {missedCheckins > 0 && (
                <> and they have <span className="text-red-400 font-medium">missed {missedCheckins} check-in{missedCheckins !== 1 ? "s" : ""}</span></>
              )}
              . Consider reaching out directly to re-engage.
            </div>
          </div>
        </div>
      )}

      {client.status === "amber" && (
        <div className="flex items-start gap-3 bg-amber-500/[0.06] border border-amber-500/20 rounded-2xl px-5 py-4 mb-6">
          <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold text-amber-400 mb-0.5">Check-in overdue</div>
            <div className="text-xs text-text-secondary leading-relaxed">
              Last check-in was <span className="text-amber-400 font-medium">{lastCheckinDays} days ago</span>
              {missedCheckins > 0 && (
                <> - <span className="text-amber-400 font-medium">{missedCheckins} check-in{missedCheckins !== 1 ? "s" : ""} missed</span></>
              )}
              . A quick nudge might help keep momentum.
            </div>
          </div>
        </div>
      )}

      {/* Stat cards row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(255,255,255,0.04)] rounded-2xl p-5">
          <div className="text-text-muted text-xs uppercase tracking-wider mb-2">Current Week</div>
          <div className="text-2xl font-heading font-bold text-accent-bright">{currentWeek}</div>
          <div className="text-text-secondary text-xs">of {totalWeeks} weeks</div>
        </div>
        <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(255,255,255,0.04)] rounded-2xl p-5">
          <div className="text-text-muted text-xs uppercase tracking-wider mb-2">Plan Progress</div>
          <div className="text-2xl font-heading font-bold text-text-primary">{planDone}/{planTotal}</div>
          <div className="text-text-secondary text-xs">{planPct}% complete</div>
        </div>
        <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(255,255,255,0.04)] rounded-2xl p-5">
          <div className="text-text-muted text-xs uppercase tracking-wider mb-2">Check-Ins</div>
          <div className="text-2xl font-heading font-bold text-text-primary">{client.checkins.length}</div>
          <div className="text-text-secondary text-xs">Last: {timeAgo(client.last_checkin)}</div>
        </div>
        <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(255,255,255,0.04)] rounded-2xl p-5">
          <div className="text-text-muted text-xs uppercase tracking-wider mb-2">Last Login</div>
          <div className={`text-2xl font-heading font-bold ${
            new Date().getTime() - new Date(client.last_login).getTime() > 7 * 24 * 60 * 60 * 1000 ? "text-red-400" : "text-text-primary"
          }`}>
            {timeAgo(client.last_login)}
          </div>
          <div className="text-text-secondary text-xs">
            {new Date(client.last_login).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
          </div>
        </div>
      </div>

      {/* Week timeline */}
      <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(255,255,255,0.04)] rounded-2xl p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-heading font-bold text-text-primary">Programme Timeline</h2>
          <span className="text-xs text-text-muted">
            Started {new Date(client.start_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </span>
        </div>
        <div className="flex gap-1.5">
          {Array.from({ length: totalWeeks }).map((_, i) => {
            const weekNum = i + 1;
            const isCurrent = weekNum === currentWeek;
            const isComplete = weekNum < currentWeek;
            return (
              <div
                key={i}
                className={`flex-1 h-8 rounded-lg flex items-center justify-center text-[10px] font-semibold transition-all relative ${
                  isCurrent
                    ? "bg-accent/20 text-accent-bright border border-accent/40"
                    : isComplete
                    ? "bg-emerald-500/10 text-emerald-400/80 border border-emerald-500/10"
                    : "bg-[rgba(255,255,255,0.02)] text-text-muted border border-[rgba(255,255,255,0.03)]"
                }`}
              >
                {weekNum}
                {isCurrent && (
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-accent-bright" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Goals */}
      {client.goals && (
        <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(255,255,255,0.04)] rounded-2xl p-5 mb-6">
          <h2 className="text-sm font-heading font-bold text-text-primary mb-2">Goals</h2>
          <p className="text-text-secondary text-sm leading-relaxed">{client.goals}</p>
        </div>
      )}

      <div className="grid lg:grid-cols-[1.3fr_1fr] gap-6">
        {/* Business Plan */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-heading font-bold text-text-primary">Business Plan</h2>
            <div className="flex items-center gap-2">
              <div className="h-2 w-24 bg-[rgba(255,255,255,0.03)] rounded-full overflow-hidden">
                <div
                  className="h-full gradient-accent rounded-full transition-all duration-500"
                  style={{ width: `${planPct}%` }}
                />
              </div>
              <span className="text-xs text-accent-bright font-semibold">{planPct}%</span>
            </div>
          </div>

          <div className="space-y-3">
            {grouped.map((group) => {
              const isExpanded = expandedCategories.has(group.name);
              const groupPct = Math.round((group.done / group.total) * 100);
              const iconPath = categoryIcons[group.name] || categoryIcons["Standards & Quality"];

              return (
                <div key={group.name} className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(255,255,255,0.04)] rounded-2xl overflow-hidden">
                  <button
                    onClick={() => toggleCategory(group.name)}
                    className="w-full flex items-center justify-between p-4 hover:bg-[rgba(255,255,255,0.02)] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                        <svg className="w-4 h-4 text-accent-bright" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={iconPath} />
                        </svg>
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-semibold text-text-primary">{group.name}</div>
                        <div className="text-xs text-text-muted">{group.done}/{group.total} completed</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 bg-[rgba(255,255,255,0.03)] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${groupPct === 100 ? "bg-emerald-500" : "gradient-accent"}`}
                            style={{ width: `${groupPct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-text-muted w-8 text-right">{groupPct}%</span>
                      </div>
                      <svg
                        className={`w-4 h-4 text-text-muted transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-[rgba(255,255,255,0.03)] px-4 pb-3">
                      {group.items.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => toggleItem(item.id)}
                          className="w-full flex items-center gap-3 py-3 px-2 rounded-lg hover:bg-[rgba(255,255,255,0.02)] transition-colors text-left group"
                        >
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                            item.completed
                              ? "bg-emerald-500 border-emerald-500"
                              : "border-[rgba(255,255,255,0.15)] group-hover:border-accent/50"
                          }`}>
                            {item.completed && (
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span className={`text-sm transition-all duration-200 ${
                            item.completed ? "text-text-muted line-through" : "text-text-secondary group-hover:text-text-primary"
                          }`}>
                            {item.title}
                          </span>
                          {item.completed && item.completed_at && (
                            <span className="text-[10px] text-text-muted ml-auto flex-shrink-0">
                              {new Date(item.completed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Check-in History */}
        <div>
          <h2 className="text-lg font-heading font-bold text-text-primary mb-4">Check-In History</h2>
          {client.checkins.length === 0 ? (
            <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(255,255,255,0.04)] rounded-2xl p-6">
              <p className="text-text-muted text-sm">No check-ins submitted yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {[...client.checkins].reverse().map((c) => {
                const mc = moodConfig[c.mood];
                return (
                  <div key={c.id} className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(255,255,255,0.04)] rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-text-primary">Week {c.week_number}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${mc.bgClass} ${mc.textClass}`}>
                          {c.mood}
                        </span>
                      </div>
                      <span className="text-xs text-text-muted">{timeAgo(c.created_at)}</span>
                    </div>

                    {c.wins && (
                      <div className="mb-2">
                        <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">Wins</span>
                        <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{c.wins}</p>
                      </div>
                    )}
                    {c.challenges && (
                      <div className="mb-2">
                        <span className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider">Challenges</span>
                        <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{c.challenges}</p>
                      </div>
                    )}
                    {c.questions && (
                      <div className="mb-2">
                        <span className="text-[10px] text-accent-bright font-semibold uppercase tracking-wider">Questions</span>
                        <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{c.questions}</p>
                      </div>
                    )}

                    {c.admin_reply || sentReplies[c.id] ? (
                      <div className="mt-3 pl-3 border-l-2 border-accent/30 bg-accent/5 rounded-r-lg py-2 pr-3">
                        <div className="text-[10px] text-accent-bright font-semibold uppercase tracking-wider mb-1">
                          Marc&apos;s Reply
                          {sentReplies[c.id] && !c.admin_reply && <span className="text-emerald-400/60 ml-2">Just sent</span>}
                        </div>
                        <p className="text-xs text-text-secondary leading-relaxed">{sentReplies[c.id] || c.admin_reply}</p>
                      </div>
                    ) : (
                      <div className="mt-3 pt-3 border-t border-[rgba(255,255,255,0.04)]">
                        <div className="text-[10px] text-text-muted font-semibold uppercase tracking-wider mb-2">Reply to this check-in</div>
                        <textarea
                          value={replyTexts[c.id] || ""}
                          onChange={(e) => setReplyTexts((prev) => ({ ...prev, [c.id]: e.target.value }))}
                          rows={3}
                          placeholder="Type your reply..."
                          disabled={sendingReply === c.id}
                          className="w-full bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-3 py-2.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors resize-none disabled:opacity-50"
                        />
                        {replyError && sendingReply === null && (
                          <div className="text-xs text-red-400 mt-1">{replyError}</div>
                        )}
                        <div className="flex justify-end mt-2">
                          <button
                            onClick={() => handleReply(c.id)}
                            disabled={!replyTexts[c.id]?.trim() || sendingReply === c.id}
                            className="px-4 py-2 gradient-accent text-white rounded-lg text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-opacity inline-flex items-center gap-1.5"
                          >
                            {sendingReply === c.id ? (
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
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
