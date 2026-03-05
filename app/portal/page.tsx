"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ClientProfile, ClientModule, CheckIn, CalendarEvent, BusinessPlan, BusinessPlanPhase } from "@/lib/types";

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="w-full bg-[rgba(255,255,255,0.04)] rounded-full h-2">
      <div
        className="h-2 rounded-full gradient-accent transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function getNextOccurrence(event: CalendarEvent): Date | null {
  const now = new Date();

  if (event.recurrence === "none") {
    const d = new Date(event.event_date);
    return d > now ? d : null;
  }

  const [hours, minutes] = event.event_time.split(":").map(Number);
  const targetDay = event.recurrence_day ?? 0;

  const next = new Date(now);
  next.setHours(hours, minutes, 0, 0);

  const currentDay = next.getDay();
  let daysUntil = targetDay - currentDay;
  if (daysUntil < 0 || (daysUntil === 0 && next <= now)) {
    daysUntil += 7;
  }
  next.setDate(next.getDate() + daysUntil);

  if (event.recurrence === "biweekly") {
    const start = new Date(event.event_date);
    const weeksDiff = Math.floor((next.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
    if (weeksDiff % 2 !== 0) {
      next.setDate(next.getDate() + 7);
    }
  }

  if (event.recurrence === "monthly") {
    let candidate = new Date(next);
    for (let i = 0; i < 12; i++) {
      const month = (now.getMonth() + i) % 12;
      const year = now.getFullYear() + Math.floor((now.getMonth() + i) / 12);
      const first = new Date(year, month, 1, hours, minutes, 0, 0);
      let dayDiff = targetDay - first.getDay();
      if (dayDiff < 0) dayDiff += 7;
      candidate = new Date(year, month, 1 + dayDiff, hours, minutes, 0, 0);
      if (candidate > now) return candidate;
    }
    return candidate;
  }

  return next;
}

function getNextCheckinDate(checkinDay: string): Date {
  const dayMap: Record<string, number> = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  };
  const targetDay = dayMap[checkinDay.toLowerCase()] ?? 1;
  const now = new Date();
  const currentDay = now.getDay();
  let daysUntil = targetDay - currentDay;
  if (daysUntil < 0) daysUntil += 7;
  if (daysUntil === 0) {
    // It's check-in day today
    return now;
  }
  const next = new Date(now);
  next.setDate(now.getDate() + daysUntil);
  return next;
}

function isToday(date: Date): boolean {
  const now = new Date();
  return date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

interface RecentModule {
  id: string;
  title: string;
  created_at: string;
}

export default function PortalDashboard() {
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [userName, setUserName] = useState("");
  const [modules, setModules] = useState<ClientModule[]>([]);
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [businessPlan, setBusinessPlan] = useState<BusinessPlan | null>(null);
  const [planPhases, setPlanPhases] = useState<BusinessPlanPhase[]>([]);
  const [checkinDay, setCheckinDay] = useState("monday");
  const [recentModules, setRecentModules] = useState<RecentModule[]>([]);
  const [expandedCheckin, setExpandedCheckin] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/portal/dashboard");
        if (res.ok) {
          const data = await res.json();
          setProfile(data.profile);
          setUserName(data.userName);
          setModules(data.modules || []);
          setCheckins(data.checkins || []);
          setBusinessPlan(data.businessPlan || null);
          setPlanPhases(data.planPhases || []);
          setCheckinDay(data.checkinDay || "monday");
          setRecentModules(data.recentModules || []);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Progress based on business plan items
  const allPlanItems = planPhases.flatMap((p) => p.items || []);
  const completedPlanItems = allPlanItems.filter((item) => item.completed).length;
  const totalPlanItems = allPlanItems.length;

  const completedModules = modules.filter((m) => m.status === "completed").length;
  const totalModules = modules.length;
  const currentWeek = checkins.length > 0 ? checkins[0].week_number : 0;

  const nextCheckinDate = getNextCheckinDate(checkinDay);
  const isCheckinDay = isToday(nextCheckinDate);

  // Recent modules added in last 14 days
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const newModules = recentModules.filter((m) => new Date(m.created_at) > twoWeeksAgo);

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold text-text-primary">
          {loading ? "Loading..." : `Welcome back${userName ? `, ${userName.split(" ")[0]}` : ""}`}
        </h1>
        <p className="text-text-secondary mt-1">Here&apos;s your progress overview.</p>
      </div>

      {/* Top Row: Next Event + What's New */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <NextEventCard />
        {newModules.length > 0 && (
          <div className="bg-bg-card border border-emerald-500/10 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <div className="text-xs text-text-muted uppercase tracking-wider">What&apos;s New</div>
            </div>
            <div className="space-y-2">
              {newModules.map((m) => (
                <div key={m.id} className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-text-primary truncate">New Training - {m.title}</div>
                    <div className="text-xs text-text-muted">
                      {new Date(m.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </div>
                  </div>
                  <Link
                    href={`/portal/training/${m.id}`}
                    className="px-3 py-1.5 text-xs font-medium text-accent-bright bg-accent/10 rounded-lg no-underline hover:bg-accent/20 transition-colors flex-shrink-0 ml-3"
                  >
                    Watch
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-6">
          <div className="text-text-muted text-xs uppercase tracking-wider mb-2">Plan Progress</div>
          <div className="text-2xl font-heading font-bold text-text-primary">{completedPlanItems}/{totalPlanItems}</div>
          <div className="text-text-secondary text-sm mt-1">{totalPlanItems > 0 ? `${Math.round((completedPlanItems / totalPlanItems) * 100)}% complete` : "No plan items"}</div>
        </div>
        <div className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-6">
          <div className="text-text-muted text-xs uppercase tracking-wider mb-2">Current Week</div>
          <div className="text-2xl font-heading font-bold text-text-primary">Week {currentWeek || "-"}</div>
        </div>
        <div className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-6">
          <div className="text-text-muted text-xs uppercase tracking-wider mb-2">Trainings</div>
          <div className="text-2xl font-heading font-bold text-text-primary">{completedModules}/{totalModules}</div>
          <div className="text-text-secondary text-sm mt-1">{totalModules > 0 ? `${Math.round((completedModules / totalModules) * 100)}% complete` : "None assigned"}</div>
        </div>
        <div className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-6">
          <div className="text-text-muted text-xs uppercase tracking-wider mb-2">Status</div>
          <div className="text-2xl font-heading font-bold text-text-primary">
            {profile?.status === "green" ? "On Track" : profile?.status === "amber" ? "Needs Attention" : profile?.status === "red" ? "Behind" : "-"}
          </div>
        </div>
      </div>

      {/* Business Plan Progress */}
      {planPhases.length > 0 && (
        <div className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-heading font-bold text-text-primary">Your Business Plan</h2>
            <span className="text-xs text-text-muted">{completedPlanItems}/{totalPlanItems} actions completed</span>
          </div>
          <ProgressBar value={completedPlanItems} max={totalPlanItems} />
          <div className="mt-6 space-y-5">
            {planPhases.map((phase) => {
              const phaseCompleted = (phase.items || []).filter((i) => i.completed).length;
              const phaseTotal = (phase.items || []).length;
              return (
                <div key={phase.id}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-heading font-bold text-text-primary">{phase.name}</h3>
                    <span className="text-xs text-text-muted">{phaseCompleted}/{phaseTotal}</span>
                  </div>
                  <div className="space-y-1.5">
                    {(phase.items || []).map((item) => (
                      <div key={item.id} className="flex items-center gap-3 py-1.5">
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
                          item.completed
                            ? "bg-emerald-500 border-emerald-500"
                            : "border-[rgba(255,255,255,0.15)]"
                        }`}>
                          {item.completed && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className={`text-sm ${item.completed ? "text-text-muted line-through" : "text-text-primary"}`}>
                          {item.title}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Linked trainings hint */}
          <div className="mt-4 pt-4 border-t border-[rgba(255,255,255,0.04)]">
            <Link href="/portal/training" className="text-sm text-accent-bright no-underline hover:underline">
              View Training Library →
            </Link>
          </div>
        </div>
      )}

      {/* Check-ins */}
      <div className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-heading font-bold text-text-primary">Check-Ins</h2>
          <div className="flex items-center gap-3">
            {isCheckinDay ? (
              <Link
                href="/portal/checkin"
                className="px-4 py-2 gradient-accent text-white rounded-xl text-xs font-semibold no-underline hover:opacity-90 transition-opacity"
              >
                Submit Check-In
              </Link>
            ) : (
              <span className="text-xs text-text-muted">
                Next Check-In: {nextCheckinDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}
              </span>
            )}
          </div>
        </div>
        {checkins.length === 0 ? (
          <p className="text-text-muted text-sm">No check-ins yet. Submit your first one to get started.</p>
        ) : (
          <div className="space-y-2">
            {checkins.map((c) => {
              const isExpanded = expandedCheckin === c.id;
              return (
                <div key={c.id} className="border border-[rgba(255,255,255,0.04)] rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedCheckin(isExpanded ? null : c.id)}
                    className="w-full py-3 px-4 flex items-center justify-between hover:bg-[rgba(255,255,255,0.02)] transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-text-primary text-sm font-medium">Week {c.week_number}</span>
                      <span className="text-text-muted text-sm">
                        {new Date(c.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        c.mood === "great" ? "bg-emerald-500/10 text-emerald-400" :
                        c.mood === "good" ? "bg-blue-500/10 text-blue-400" :
                        c.mood === "okay" ? "bg-amber-500/10 text-amber-400" :
                        "bg-red-500/10 text-red-400"
                      }`}>
                        {c.mood}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {c.admin_reply ? (
                        <span className="text-xs text-accent-bright">Replied</span>
                      ) : (
                        <span className="text-xs text-text-muted">Pending</span>
                      )}
                      <svg className={`w-4 h-4 text-text-muted transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3">
                      {c.responses && Object.entries(c.responses).map(([key, value]) => (
                        <div key={key}>
                          <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">
                            {key === "wins" ? "Wins this week" : key === "challenges" ? "Challenges" : key === "questions" ? "Questions for Marc" : key}
                          </div>
                          <p className="text-xs text-text-secondary leading-relaxed">{value}</p>
                        </div>
                      ))}
                      {/* Legacy fields fallback */}
                      {!c.responses && (
                        <>
                          {c.wins && <div><div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Wins</div><p className="text-xs text-text-secondary">{c.wins}</p></div>}
                          {c.challenges && <div><div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Challenges</div><p className="text-xs text-text-secondary">{c.challenges}</p></div>}
                          {c.questions && <div><div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Questions</div><p className="text-xs text-text-secondary">{c.questions}</p></div>}
                        </>
                      )}
                      {c.admin_reply && (
                        <div className="mt-2 pl-3 border-l-2 border-accent/30 bg-accent/5 rounded-r-lg py-2 pr-3">
                          <div className="text-[10px] text-accent-bright font-semibold uppercase tracking-wider mb-1">Marc&apos;s Reply</div>
                          <p className="text-xs text-text-secondary leading-relaxed">{c.admin_reply}</p>
                          {c.replied_at && (
                            <div className="text-[10px] text-text-muted mt-1">
                              {new Date(c.replied_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function NextEventCard() {
  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [nextDate, setNextDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/calendar");
        if (res.ok) {
          const data = await res.json();
          const events: CalendarEvent[] = data.events;

          let earliest: { event: CalendarEvent; date: Date } | null = null;
          for (const evt of events) {
            const nd = getNextOccurrence(evt);
            if (nd && (!earliest || nd < earliest.date)) {
              earliest = { event: evt, date: nd };
            }
          }

          if (earliest) {
            setEvent(earliest.event);
            setNextDate(earliest.date);
          }
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return null;

  if (!event || !nextDate) {
    return (
      <div className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[rgba(255,255,255,0.04)] flex items-center justify-center">
            <svg className="w-5 h-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="text-sm text-text-muted">No upcoming events</span>
        </div>
      </div>
    );
  }

  const dayName = nextDate.toLocaleDateString("en-GB", { weekday: "long" });
  const [h, m] = event.event_time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  const timeStr = `${hour}:${m.toString().padStart(2, "0")} ${period}`;

  const recurrenceText: Record<string, string> = {
    weekly: `Every ${dayName}`,
    biweekly: `Every other ${dayName}`,
    monthly: `Monthly`,
    none: nextDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }),
  };

  return (
    <div className="bg-bg-card border border-accent/10 rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-accent-bright" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <div className="text-xs text-text-muted uppercase tracking-wider mb-0.5">Next Event</div>
            <div className="text-base font-heading font-bold text-text-primary">{event.title}</div>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-sm text-text-secondary">{dayName}, {timeStr}</span>
              <span className="text-xs text-text-muted">{recurrenceText[event.recurrence]}</span>
            </div>
          </div>
        </div>
        {event.link && (
          <a
            href={event.link}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 gradient-accent text-white rounded-xl text-sm font-medium no-underline inline-flex items-center gap-2 hover:opacity-90 transition-opacity flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {event.link_label || "Join"}
          </a>
        )}
      </div>
    </div>
  );
}
