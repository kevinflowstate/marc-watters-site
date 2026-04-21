"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import MonthlyMetricsSection from "@/components/portal/MonthlyMetricsSection";
import { getQuestionAnswerLabel } from "@/lib/questionnaires";
import type {
  ClientProfile,
  TrainingModule,
  CheckIn,
  CalendarEvent,
  BusinessPlanPhase,
  ClientMonthlyMetric,
  CheckinFormConfig,
  FormQuestion,
} from "@/lib/types";

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="w-full bg-[rgba(255,255,255,0.04)] rounded-full h-2">
      <div className="h-2 rounded-full gradient-accent transition-all duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

function cleanPhaseName(name: string): string {
  if (typeof name !== "string") return "Untitled phase";
  const cleaned = name.replace(/^Phase\s*\d+\s*[:\-]\s*/i, "").trim();
  return cleaned || "Untitled phase";
}

function normalizePlanPhases(phases: unknown[]): BusinessPlanPhase[] {
  return phases.map((phase, index) => {
    const rawPhase = phase as Partial<BusinessPlanPhase> & {
      items?: unknown[];
      linked_trainings?: unknown[];
    };
    const rawItems = Array.isArray(rawPhase.items) ? rawPhase.items : [];
    const rawLinkedTrainings = Array.isArray(rawPhase.linked_trainings) ? rawPhase.linked_trainings : [];

    return {
      id: typeof rawPhase.id === "string" ? rawPhase.id : `phase-${index}`,
      name: typeof rawPhase.name === "string" ? rawPhase.name : "Untitled phase",
      notes: typeof rawPhase.notes === "string" ? rawPhase.notes : "",
      order_index: typeof rawPhase.order_index === "number" ? rawPhase.order_index : index,
      items: rawItems.map((item, itemIndex) => {
        const rawItem = item as Partial<BusinessPlanPhase["items"][number]> & Record<string, unknown>;
        return {
          id: typeof rawItem.id === "string" ? rawItem.id : `item-${index}-${itemIndex}`,
          category: typeof rawItem.category === "string" ? rawItem.category : (typeof rawPhase.name === "string" ? rawPhase.name : "Untitled phase"),
          title: typeof rawItem.title === "string" ? rawItem.title : "Untitled action",
          completed: Boolean(rawItem.completed),
          completed_at: typeof rawItem.completed_at === "string" ? rawItem.completed_at : undefined,
          order_index: typeof rawItem.order_index === "number" ? rawItem.order_index : itemIndex,
          phase_id: typeof rawItem.phase_id === "string" ? rawItem.phase_id : "",
        };
      }),
      linked_trainings: rawLinkedTrainings.filter((trainingId): trainingId is string => typeof trainingId === "string"),
    };
  });
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
  if (daysUntil < 0 || (daysUntil === 0 && next <= now)) daysUntil += 7;
  next.setDate(next.getDate() + daysUntil);
  if (event.recurrence === "biweekly") {
    const start = new Date(event.event_date);
    const weeksDiff = Math.floor((next.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
    if (weeksDiff % 2 !== 0) next.setDate(next.getDate() + 7);
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
  const dayMap: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
  const targetDay = dayMap[checkinDay.toLowerCase()] ?? 1;
  const now = new Date();
  let daysUntil = targetDay - now.getDay();
  if (daysUntil < 0) daysUntil += 7;
  if (daysUntil === 0) return now;
  const next = new Date(now);
  next.setDate(now.getDate() + daysUntil);
  return next;
}

function isToday(date: Date): boolean {
  const now = new Date();
  return date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

interface RecentModule { id: string; title: string; created_at: string; }

export default function PortalDashboard() {
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [userName, setUserName] = useState("");
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [planPhases, setPlanPhases] = useState<BusinessPlanPhase[]>([]);
  const [checkinDay, setCheckinDay] = useState("monday");
  const [checkinConfig, setCheckinConfig] = useState<CheckinFormConfig | null>(null);
  const [recentModules, setRecentModules] = useState<RecentModule[]>([]);
  const [onboardingModuleId, setOnboardingModuleId] = useState<string | null>(null);
  const [monthlyMetrics, setMonthlyMetrics] = useState<ClientMonthlyMetric[]>([]);
  const [currentMetricsMonthStart, setCurrentMetricsMonthStart] = useState("");
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
          setPlanPhases(normalizePlanPhases(Array.isArray(data.planPhases) ? data.planPhases : []));
          setCheckinDay(data.checkinDay || "monday");
          setCheckinConfig(data.checkinConfig || null);
          setRecentModules(data.recentModules || []);
          setOnboardingModuleId(data.onboardingModuleId || null);
          setMonthlyMetrics(data.monthlyMetrics || []);
          setCurrentMetricsMonthStart(data.currentMetricsMonthStart || "");
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const allPlanItems = planPhases.flatMap((p) => p.items || []);
  const completedPlanItems = allPlanItems.filter((item) => item.completed).length;
  const totalPlanItems = allPlanItems.length;
  const planPct = totalPlanItems > 0 ? Math.round((completedPlanItems / totalPlanItems) * 100) : 0;
  const completedPhaseCount = planPhases.filter((phase) => {
    const items = phase.items || [];
    return items.length > 0 && items.every((item) => item.completed);
  }).length;
  const currentPhase = planPhases.length > 0
    ? planPhases[Math.min(completedPhaseCount, planPhases.length - 1)]
    : null;
  const currentPhaseLabel = currentPhase ? cleanPhaseName(currentPhase.name) : null;

  const totalModules = modules.length;
  const isFirstLogin = !profile?.last_login;
  const shouldShowOnboardingWelcome = Boolean(isFirstLogin && onboardingModuleId);

  const nextCheckinDate = getNextCheckinDate(checkinDay);
  const isCheckinToday = isToday(nextCheckinDate);

  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const newModules = recentModules.filter((m) => new Date(m.created_at) > twoWeeksAgo);

  return (
    <>
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold text-text-primary">
          {loading ? "Loading..." : `Welcome back${userName ? `, ${userName.split(" ")[0]}` : ""}`}
        </h1>
        <p className="text-text-secondary mt-1">Here&apos;s your progress overview.</p>
      </div>

      {/* Briefing Banner */}
      {!loading && (
        <BriefingBanner
          isCheckinToday={isCheckinToday}
          nextCheckinDate={nextCheckinDate}
          uncompletedModules={totalModules}
          latestReply={checkins.find((c) => c.admin_reply)}
          planPct={planPct}
        />
      )}

      {shouldShowOnboardingWelcome && onboardingModuleId && (
        <div className="relative overflow-hidden rounded-2xl border border-accent/20 bg-bg-card p-8 mb-8">
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_top_left,rgba(34,114,222,0.18),transparent_45%)] pointer-events-none" />
          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-accent-bright mb-4">
              Getting Started
            </div>
            <h2 className="text-3xl font-heading font-bold text-text-primary">
              Welcome {userName ? userName.split(" ")[0] : ""}
            </h2>
            <p className="mt-2 text-lg text-text-secondary">
              Welcome to The Construction Business Blueprint.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-text-secondary">
              Your business plan will be assigned soon, for now go straight to the onboarding materials to get started.
            </p>
            <Link
              href={`/portal/training/${onboardingModuleId}`}
              className="mt-6 inline-flex items-center gap-2 rounded-xl gradient-accent px-5 py-3 text-sm font-semibold text-white no-underline hover:opacity-90 transition-opacity"
            >
              Start Onboarding
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      )}

      {loading ? (
        <DashboardSkeleton />
      ) : (
      <>
      {/* Top Row: Next Event + What's New */}
      <div className={`grid grid-cols-1 ${newModules.length > 0 ? 'lg:grid-cols-2' : ''} gap-4 mb-8`}>
        <NextEventCard />
        {newModules.length > 0 && (
          <div className="group relative bg-bg-card border border-emerald-500/10 rounded-2xl p-5 overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-500/20 hover:shadow-[0_2px_12px_rgba(16,185,129,0.04)]">
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.03)_1px,transparent_1px)] bg-[length:4px_4px] pointer-events-none" />
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
                    <div className="text-xs text-text-muted">{new Date(m.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</div>
                  </div>
                  <Link href={`/portal/training/${m.id}`} className="px-3 py-1.5 text-xs font-medium text-accent-bright bg-accent/10 rounded-lg no-underline hover:bg-accent/20 transition-colors flex-shrink-0 ml-3">
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
        {[
          { label: "Plan Progress", value: `${planPct}%`, sub: `${completedPlanItems}/${totalPlanItems} actions done` },
          {
            label: "Current Phase",
            value: currentPhaseLabel || "Not Yet Assigned",
            sub: currentPhaseLabel ? `${completedPhaseCount}/${planPhases.length} phases complete` : "Marc will assign your plan soon",
          },
          { label: "Trainings", value: `${totalModules}`, sub: totalModules > 0 ? `${totalModules} module${totalModules !== 1 ? "s" : ""} available` : "Coming soon" },
          { label: "Status", value: profile?.status === "green" ? "On Track" : profile?.status === "amber" ? "Needs Attention" : profile?.status === "red" ? "Behind" : "-" },
        ].map((stat, i) => (
          <div key={i} className="group relative bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-6 overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:border-[rgba(255,255,255,0.08)] hover:shadow-[0_2px_12px_rgba(255,255,255,0.03)]">
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[length:4px_4px] pointer-events-none" />
            <div className="absolute inset-0 -z-10 rounded-2xl p-px bg-gradient-to-br from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            <div className="relative">
              <div className="text-text-muted text-xs uppercase tracking-wider mb-2">{stat.label}</div>
              <div className="text-2xl font-heading font-bold text-text-primary">{stat.value}</div>
              {stat.sub && <div className="text-text-secondary text-sm mt-1">{stat.sub}</div>}
            </div>
          </div>
        ))}
      </div>

      <MonthlyMetricsSection
        initialHistory={monthlyMetrics}
        initialCurrentMonthStart={currentMetricsMonthStart}
      />

      {/* Journey Progress */}
      <JourneyTracker phases={planPhases} />

      {/* Split columns: Business Plan Progress (left) + Check-ins (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Business Plan Summary */}
        <div className="group relative bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-6 overflow-hidden transition-all duration-300 hover:border-[rgba(255,255,255,0.08)] hover:shadow-[0_4px_20px_rgba(255,255,255,0.02)]">
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[length:4px_4px] pointer-events-none" />
          <div className="flex items-center justify-between mb-4 relative z-10">
            <h2 className="text-lg font-heading font-bold text-text-primary">Business Plan</h2>
            <Link href="/portal/plan" className="px-4 py-2 gradient-accent text-white rounded-xl text-xs font-semibold no-underline hover:opacity-90 transition-opacity">
              Go To Plan
            </Link>
          </div>
          <div className="relative z-10"><ProgressBar value={completedPlanItems} max={totalPlanItems} /></div>
          <div className="flex justify-between mt-2 text-sm text-text-muted mb-4 relative z-10">
            <span>{completedPlanItems} completed</span>
            <span>{totalPlanItems - completedPlanItems} remaining</span>
          </div>
          {planPhases.length > 0 && (
            <div className="space-y-3 relative z-10">
              {planPhases.map((phase) => {
                const phaseCompleted = (phase.items || []).filter((i) => i.completed).length;
                const phaseTotal = (phase.items || []).length;
                const phasePct = phaseTotal > 0 ? Math.round((phaseCompleted / phaseTotal) * 100) : 0;
                return (
                  <div key={phase.id} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-text-primary truncate">{phase.name}</span>
                        <span className="text-[10px] text-text-muted ml-2">{phaseCompleted}/{phaseTotal}</span>
                      </div>
                      <div className="w-full bg-[rgba(255,255,255,0.04)] rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-500 ${phasePct === 100 ? "bg-emerald-500" : "gradient-accent"}`}
                          style={{ width: `${phasePct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Check-ins */}
        <div className="group relative bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-6 overflow-hidden transition-all duration-300 hover:border-[rgba(255,255,255,0.08)] hover:shadow-[0_4px_20px_rgba(255,255,255,0.02)]">
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[length:4px_4px] pointer-events-none" />
          <div className="flex items-center justify-between mb-4 relative z-10">
            <h2 className="text-lg font-heading font-bold text-text-primary">Check-Ins</h2>
            {isCheckinToday ? (
              <Link href="/portal/checkin" className="px-4 py-2 gradient-accent text-white rounded-xl text-xs font-semibold no-underline hover:opacity-90 transition-opacity">
                Submit Check-In
              </Link>
            ) : (
              <span className="text-xs text-text-muted">
                Next: {nextCheckinDate.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
              </span>
            )}
          </div>
          {checkins.length === 0 ? (
            <p className="text-text-muted text-sm">No check-ins yet.</p>
          ) : (
            <div className="space-y-2 relative z-10">
              {checkins.map((c) => {
                const isExpanded = expandedCheckin === c.id;
                return (
                  <div key={c.id} className="border border-[rgba(255,255,255,0.04)] rounded-xl overflow-hidden">
                    <button
                      onClick={() => setExpandedCheckin(isExpanded ? null : c.id)}
                      className="w-full py-3 px-4 flex items-center justify-between hover:bg-[rgba(255,255,255,0.02)] transition-colors text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-text-primary text-sm font-medium">Week {c.week_number}</span>
                        <span className="text-text-muted text-xs">{new Date(c.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          c.mood === "great" ? "bg-emerald-500/10 text-emerald-400" :
                          c.mood === "good" ? "bg-blue-500/10 text-blue-400" :
                          c.mood === "okay" ? "bg-amber-500/10 text-amber-400" :
                          "bg-red-500/10 text-red-400"
                        }`}>{c.mood}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {c.admin_reply ? <span className="text-xs text-accent-bright">Replied</span> : <span className="text-xs text-text-muted">Pending</span>}
                        <svg className={`w-4 h-4 text-text-muted transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>
                    <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                      <div className="px-4 pb-4 space-y-3">
                        {c.responses && checkinConfig?.questions?.map((question: FormQuestion) => {
                          const answer = getQuestionAnswerLabel(question, c.responses);
                          if (!answer) return null;

                          return (
                            <div key={question.id}>
                              <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">
                                {question.label}
                              </div>
                              <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-line">{answer}</p>
                            </div>
                          );
                        })}
                        {c.responses && !checkinConfig && Object.entries(c.responses).map(([key, value]) => (
                          <div key={key}>
                            <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">{key}</div>
                            <p className="text-xs text-text-secondary leading-relaxed">{value}</p>
                          </div>
                        ))}
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
                            {c.replied_at && <div className="text-[10px] text-text-muted mt-1">{new Date(c.replied_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</div>}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      </>
      )}
    </>
  );
}

function SkeletonPulse({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg ${className || ""}`} />;
}

function DashboardSkeleton() {
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <div className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-5">
          <SkeletonPulse className="h-4 w-24 mb-3" />
          <SkeletonPulse className="h-6 w-48 mb-2" />
          <SkeletonPulse className="h-4 w-36" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-6">
            <SkeletonPulse className="h-3 w-20 mb-3" />
            <SkeletonPulse className="h-8 w-16 mb-2" />
            <SkeletonPulse className="h-3 w-28" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-6">
            <SkeletonPulse className="h-5 w-32 mb-4" />
            <SkeletonPulse className="h-2 w-full mb-4" />
            <div className="space-y-3">
              {[...Array(3)].map((_, j) => (
                <SkeletonPulse key={j} className="h-4 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function BriefingBanner({
  isCheckinToday,
  nextCheckinDate,
  uncompletedModules,
  latestReply,
  planPct,
}: {
  isCheckinToday: boolean;
  nextCheckinDate: Date;
  uncompletedModules: number;
  latestReply?: CheckIn;
  planPct: number;
}) {
  const items: { icon: string; text: string; href?: string; accent?: boolean }[] = [];
  const [currentTime] = useState(() => Date.now());

  if (isCheckinToday) {
    items.push({ icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4", text: "Your weekly check-in is due today", href: "/portal/checkin", accent: true });
  } else {
    const dayStr = nextCheckinDate.toLocaleDateString("en-GB", { weekday: "long" });
    items.push({ icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z", text: `Next check-in: ${dayStr}` });
  }

  if (uncompletedModules > 0) {
    items.push({ icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253", text: `${uncompletedModules} training module${uncompletedModules > 1 ? "s" : ""} available`, href: "/portal/training" });
  }

  if (latestReply?.admin_reply && latestReply.replied_at) {
    const replyDate = new Date(latestReply.replied_at);
    const daysDiff = Math.floor((currentTime - replyDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff <= 3) {
      items.push({
        icon: "M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z",
        text: "Marc replied to your latest check-in",
        href: `/portal/checkins/${latestReply.id}`,
        accent: true,
      });
    }
  }

  if (planPct > 0 && planPct < 100) {
    items.push({ icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z", text: `Business plan ${planPct}% complete`, href: "/portal/plan" });
  }

  if (items.length === 0) return null;

  return (
    <div className="bg-bg-card border border-accent/10 rounded-2xl p-5 mb-8">
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-4 h-4 text-accent-bright" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-xs font-semibold text-accent-bright uppercase tracking-wider">This Week</span>
      </div>
      <div className="flex flex-col gap-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-3">
            <svg className={`w-4 h-4 flex-shrink-0 ${item.accent ? "text-accent-bright" : "text-text-muted"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
            </svg>
            {item.href ? (
              <Link href={item.href} className={`text-sm no-underline transition-colors ${item.accent ? "text-accent-bright hover:text-accent-light font-medium" : "text-text-secondary hover:text-text-primary"}`}>
                {item.text}
              </Link>
            ) : (
              <span className={`text-sm ${item.accent ? "text-accent-bright font-medium" : "text-text-secondary"}`}>{item.text}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function JourneyTracker({
  phases,
}: {
  phases: BusinessPlanPhase[];
}) {
  if (phases.length === 0) {
    return (
      <div className="group relative bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-6 mb-8 overflow-hidden transition-all duration-300 hover:border-[rgba(255,255,255,0.08)]">
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[length:4px_4px] pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-heading font-bold text-text-primary">Your Journey</h2>
            <span className="text-xs text-text-muted">Waiting for plan</span>
          </div>
          <p className="text-sm text-text-secondary leading-relaxed">
            Your journey tracker will appear once Marc assigns your business plan. When that happens, this section will show each phase of your roadmap and your progress through it.
          </p>
        </div>
      </div>
    );
  }

  const milestones = phases.map((phase, i) => {
    const cleanName = cleanPhaseName(phase.name);
    const label = cleanName.length > 18 ? `${cleanName.slice(0, 16)}...` : cleanName;
    return { index: i, label, itemCount: (phase.items || []).length };
  });

  const completedPhaseCount = phases.filter((phase) => {
    const items = phase.items || [];
    return items.length > 0 && items.every((item) => item.completed);
  }).length;

  const currentPhase = phases[completedPhaseCount] || null;
  const currentPhaseItems = currentPhase?.items || [];
  const currentPhaseCompleted = currentPhaseItems.filter((item) => item.completed).length;
  const currentPhaseFraction = currentPhaseItems.length > 0 ? currentPhaseCompleted / currentPhaseItems.length : 0;
  const progressPct = completedPhaseCount >= phases.length
    ? 100
    : Math.round(((completedPhaseCount + currentPhaseFraction) / phases.length) * 100);
  const currentPhaseLabel = currentPhase ? cleanPhaseName(currentPhase.name) : cleanPhaseName(phases[phases.length - 1].name);

  return (
    <div className="group relative bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-6 mb-8 overflow-hidden transition-all duration-300 hover:border-[rgba(255,255,255,0.08)]">
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[length:4px_4px] pointer-events-none" />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-heading font-bold text-text-primary">Your Journey</h2>
          <span className="text-xs text-text-muted">{completedPhaseCount} of {phases.length} phases complete</span>
        </div>
        <p className="text-sm text-text-secondary mb-4">
          Current phase: <span className="text-text-primary font-medium">{currentPhaseLabel}</span>
        </p>

        {/* Progress bar with milestones */}
        <div className="relative mb-6">
          <div className="h-2 bg-[rgba(255,255,255,0.04)] rounded-full">
            <div className="h-2 rounded-full gradient-accent transition-all duration-700" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="flex justify-between mt-4">
            {milestones.map((m, i) => {
              const reached = m.index < completedPhaseCount;
              const active = m.index === completedPhaseCount && completedPhaseCount < phases.length;
              const total = milestones.length;
              const isFirst = i === 0;
              const isLast = i === total - 1;
              return (
                <div key={m.index} className={`flex flex-col items-center flex-1 ${isFirst ? "items-start" : isLast ? "items-end" : "items-center"}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center border-2 ${
                    reached
                      ? "bg-accent border-accent-bright"
                      : active
                      ? "bg-accent/10 border-accent-bright"
                      : "bg-bg-card border-[rgba(255,255,255,0.1)]"
                  }`}>
                    {reached && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className={`text-[9px] mt-2 text-center max-w-[90px] leading-tight ${
                    reached || active ? "text-text-primary font-medium" : "text-text-muted"
                  }`}>{m.label}</span>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
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
            if (nd && (!earliest || nd < earliest.date)) earliest = { event: evt, date: nd };
          }
          if (earliest) { setEvent(earliest.event); setNextDate(earliest.date); }
        }
      } catch { /* silent */ } finally { setLoading(false); }
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
  const recurrenceText: Record<string, string> = { weekly: `Every ${dayName}`, biweekly: `Every other ${dayName}`, monthly: "Monthly", none: nextDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }) };

  return (
    <div className="group relative bg-bg-card border border-accent/10 rounded-2xl p-5 overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/20 hover:shadow-[0_2px_12px_rgba(34,114,222,0.06)]">
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[radial-gradient(circle_at_center,rgba(34,114,222,0.03)_1px,transparent_1px)] bg-[length:4px_4px] pointer-events-none" />
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center group-hover:bg-accent/15 transition-colors duration-300">
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
          <a href={event.link} target="_blank" rel="noopener noreferrer" className="px-4 py-2.5 gradient-accent text-white rounded-xl text-sm font-medium no-underline inline-flex items-center gap-2 hover:opacity-90 transition-opacity flex-shrink-0">
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
