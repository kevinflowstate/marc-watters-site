"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import MonthlyMetricsSection from "@/components/portal/MonthlyMetricsSection";
import { Chip, Icon, SkeletonRows, StatusIcon } from "@/components/ops/workspace/WorkspaceUI";
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
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/portal/dashboard?fresh=${Date.now()}`, {
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          if (cancelled) return;
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
        if (!cancelled) setLoading(false);
      }
    }

    function refreshWhenVisible() {
      if (document.visibilityState === "visible") void load();
    }

    void load();
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
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
  const nextPlanItem = currentPhase?.items?.find((item) => !item.completed)
    || allPlanItems.find((item) => !item.completed)
    || null;

  const totalModules = modules.length;
  const isFirstLogin = !profile?.last_login;
  const shouldShowOnboardingWelcome = Boolean(isFirstLogin && onboardingModuleId);

  const nextCheckinDate = getNextCheckinDate(checkinDay);
  const isCheckinToday = isToday(nextCheckinDate);

  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const newModules = recentModules.filter((m) => new Date(m.created_at) > twoWeeksAgo);

  const statusText = profile?.status === "green" ? "On track" : profile?.status === "amber" ? "Needs attention" : profile?.status === "red" ? "Behind" : "-";
  const statusTone = profile?.status === "green" ? "is-ok" : profile?.status ? "is-attn" : "";

  return (
    <div className="ws ws-page">
      <div className="ws-ph">
        <div className="min-w-0">
          {loading ? (
            <span className="ws-skel" style={{ width: 240, height: 22 }} />
          ) : (
            <h1 className="ws-title">{`Welcome back${userName ? `, ${userName.split(" ")[0]}` : ""}`}</h1>
          )}
          <p className="ws-meta mt-1">Your plan, progress and next steps in one place.</p>
        </div>
      </div>

      {shouldShowOnboardingWelcome && onboardingModuleId && (
        <section className="ws-panel" aria-label="Getting started">
          <div className="p-5 sm:p-6 max-w-3xl">
            <span className="ws-chip is-decide">Getting started</span>
            <h2 className="mt-3 text-[19px] font-semibold tracking-[-0.018em]" style={{ color: "var(--ws-ink)" }}>
              Welcome {userName ? userName.split(" ")[0] : ""}
            </h2>
            <p className="ws-meta mt-1" style={{ fontSize: 14 }}>Welcome to The Construction Business Blueprint.</p>
            <p className="ws-meta mt-3">
              Your business plan will be assigned soon, for now go straight to the onboarding materials to get started.
            </p>
            <Link href={`/portal/training/${onboardingModuleId}`} className="ws-btn ws-btn-primary ws-focus mt-5">
              Start onboarding
              <Icon name="chevron" size={14} />
            </Link>
          </div>
        </section>
      )}

      {loading ? (
        <DashboardSkeleton />
      ) : (
      <>
      <div className="ws-grid2">
        <section className="ws-panel min-w-0" aria-label="Current focus">
          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="ws-caption">Current focus</div>
                <h2 className="mt-1.5 max-w-2xl text-[20px] font-semibold leading-snug tracking-[-0.02em]" style={{ color: "var(--ws-ink)" }}>
                  {nextPlanItem?.title || currentPhaseLabel || "Your business plan is being prepared"}
                </h2>
                <p className="ws-meta mt-1.5">
                  {currentPhaseLabel ? `Part of ${currentPhaseLabel}` : "Marc will assign your next actions here."}
                </p>
              </div>
              <div className="text-right">
                <div className="text-[22px] font-semibold tracking-[-0.02em]" style={{ color: "var(--ws-ink)" }}>{planPct}%</div>
                <div className="ws-caption">plan complete</div>
              </div>
            </div>
            <span className="ws-bar mt-5"><i style={{ width: `${planPct}%` }} /></span>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <span className="ws-caption">{completedPlanItems} of {totalPlanItems} actions complete</span>
              <Link href="/portal/plan" className="ws-btn ws-btn-primary ws-focus">
                Open business plan
                <Icon name="chevron" size={14} />
              </Link>
            </div>
          </div>
        </section>
        <NextEventCard />
      </div>

      <BriefingBanner
        isCheckinToday={isCheckinToday}
        nextCheckinDate={nextCheckinDate}
        uncompletedModules={totalModules}
        latestReply={checkins.find((c) => c.admin_reply)}
        planPct={planPct}
      />

      {newModules.length > 0 && (
        <section className="ws-panel" aria-label="What's new">
          <div className="ws-panel-head">
            <span className="ws-dot" style={{ color: "var(--ws-ok)" }} />
            <h2 className="ws-h2">What&apos;s new</h2>
            <span className="ws-caption">{newModules.length} recent module{newModules.length === 1 ? "" : "s"}</span>
          </div>
          <div>
            {newModules.map((module) => (
              <Link key={module.id} href={`/portal/training/${module.id}`} className="ws-row ws-focus no-underline">
                <Icon name="play" size={13} className="ws-status-ic" />
                <span className="min-w-0">
                  <span className="ws-row-title">{module.title}</span>
                  <span className="ws-row-sub">
                    Added {new Date(module.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </span>
                </span>
                <span className="ws-row-meta">
                  <span className="ws-link" style={{ fontSize: 12.5 }}>View training</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="ws-strip">
        {[
          { label: "Plan progress", icon: "plan", value: `${planPct}%`, sub: `${completedPlanItems}/${totalPlanItems} actions done` },
          {
            label: "Current phase",
            icon: "target",
            value: currentPhaseLabel || "Not yet assigned",
            sub: currentPhaseLabel ? `${completedPhaseCount}/${planPhases.length} phases complete` : "Marc will assign your plan soon",
          },
          { label: "Trainings", icon: "book", value: `${totalModules}`, sub: totalModules > 0 ? `${totalModules} module${totalModules !== 1 ? "s" : ""} available` : "Coming soon" },
          { label: "Status", icon: "checkCircle", value: statusText, sub: "", tone: statusTone },
        ].map((stat, i) => (
          <div key={i} className="ws-stat" style={{ cursor: "default" }}>
            <span className="ws-stat-l"><Icon name={stat.icon} size={14} />{stat.label}</span>
            <span className="ws-stat-n ws-trunc" style={{ fontSize: stat.value.length > 8 ? 16 : undefined, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {stat.value}
            </span>
            {stat.sub ? <span className="ws-stat-s ws-trunc">{stat.sub}</span> : stat.tone ? <span className={`ws-stat-s ${stat.tone}`}>&nbsp;</span> : null}
          </div>
        ))}
      </div>

      {/* Split columns: Business Plan Progress (left) + Check-ins (right) */}
      <div className="ws-pair">
        {/* Business Plan Summary */}
        <section className="ws-panel min-w-0" aria-label="Business plan">
          <div className="ws-panel-head">
            <h2 className="ws-h2">Business plan</h2>
            <Link href="/portal/plan" className="ws-btn ws-btn-sm ws-focus">
              Go to plan
            </Link>
          </div>
          <div className="px-[14px] py-3">
            <span className="ws-bar"><i style={{ width: `${totalPlanItems > 0 ? Math.round((completedPlanItems / totalPlanItems) * 100) : 0}%` }} /></span>
            <div className="flex justify-between mt-2 ws-caption">
              <span>{completedPlanItems} completed</span>
              <span>{totalPlanItems - completedPlanItems} remaining</span>
            </div>
          </div>
          {planPhases.length > 0 && (
            <div>
              {planPhases.map((phase) => {
                const phaseCompleted = (phase.items || []).filter((i) => i.completed).length;
                const phaseTotal = (phase.items || []).length;
                const phasePct = phaseTotal > 0 ? Math.round((phaseCompleted / phaseTotal) * 100) : 0;
                return (
                  <div key={phase.id} className="ws-line" style={{ gridTemplateColumns: "14px minmax(0,1fr)", alignItems: "center" }}>
                    <StatusIcon tone={phasePct === 100 ? "ok" : phaseCompleted > 0 ? "running" : "open"} />
                    <div className="min-w-0">
                      <div className="flex items-center justify-between mb-1.5 gap-2">
                        <span className="ws-row-title">{phase.name}</span>
                        <span className="ws-caption">{phaseCompleted}/{phaseTotal}</span>
                      </div>
                      <span className="ws-bar" style={phasePct === 100 ? ({ "--c": "var(--ws-ok)" } as CSSProperties) : undefined}>
                        <i style={{ width: `${phasePct}%` }} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Check-ins */}
        <section className="ws-panel min-w-0" aria-label="Check-ins">
          <div className="ws-panel-head">
            <h2 className="ws-h2">Check-ins</h2>
            {isCheckinToday ? (
              <Link href="/portal/checkin" className="ws-btn ws-btn-primary ws-btn-sm ws-focus">
                Submit check-in
              </Link>
            ) : (
              <span className="ws-caption">
                Next: {nextCheckinDate.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
              </span>
            )}
          </div>
          {checkins.length === 0 ? (
            <p className="ws-up-none" style={{ padding: 14 }}>No check-ins yet.</p>
          ) : (
            <div>
              {checkins.map((c) => {
                const isExpanded = expandedCheckin === c.id;
                const moodTone = c.mood === "great" ? "ok" : c.mood === "okay" ? "attn" : c.mood === "good" ? "decide" : "bad";
                const moodLabel = c.mood ? c.mood.charAt(0).toUpperCase() + c.mood.slice(1) : "";
                return (
                  <div key={c.id}>
                    <button
                      type="button"
                      onClick={() => setExpandedCheckin(isExpanded ? null : c.id)}
                      aria-expanded={isExpanded}
                      className="ws-row ws-focus"
                    >
                      <StatusIcon tone={c.admin_reply ? "ok" : "open"} />
                      <span className="min-w-0">
                        <span className="ws-row-title">Week {c.week_number}</span>
                        <span className="ws-row-sub">{new Date(c.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                      </span>
                      <span className="ws-row-meta">
                        {moodLabel && <Chip tone={moodTone as "ok" | "attn" | "decide" | "bad"}>{moodLabel}</Chip>}
                        <span className="ws-row-time" style={c.admin_reply ? { color: "var(--ws-accent-ink)" } : undefined}>
                          {c.admin_reply ? "Replied" : "Pending"}
                        </span>
                        <Icon name="chevron" size={14} className={`ws-chev ${isExpanded ? "is-open" : ""}`} />
                      </span>
                    </button>
                    {isExpanded && (
                      <div className="ws-expand">
                        <div className="ws-expand-box space-y-3">
                          {c.responses && checkinConfig?.questions?.map((question: FormQuestion) => {
                            const answer = getQuestionAnswerLabel(question, c.responses);
                            if (!answer) return null;

                            return (
                              <div key={question.id}>
                                <div className="ws-field-l">{question.label}</div>
                                <p className="ws-prose" style={{ fontSize: 13 }}>{answer}</p>
                              </div>
                            );
                          })}
                          {c.responses && !checkinConfig && Object.entries(c.responses).map(([key, value]) => (
                            <div key={key}>
                              <div className="ws-field-l">{key}</div>
                              <p className="ws-prose" style={{ fontSize: 13 }}>{value}</p>
                            </div>
                          ))}
                          {!c.responses && (
                            <>
                              {c.wins && <div><div className="ws-field-l">Wins</div><p className="ws-prose" style={{ fontSize: 13 }}>{c.wins}</p></div>}
                              {c.challenges && <div><div className="ws-field-l">Challenges</div><p className="ws-prose" style={{ fontSize: 13 }}>{c.challenges}</p></div>}
                              {c.questions && <div><div className="ws-field-l">Questions</div><p className="ws-prose" style={{ fontSize: 13 }}>{c.questions}</p></div>}
                            </>
                          )}
                          {c.admin_reply && (
                            <div className="ws-quote" style={{ "--c": "var(--ws-accent-ink)" } as CSSProperties}>
                              <div className="ws-quote-h">
                                Marc&apos;s reply
                                {c.replied_at && (
                                  <span className="ws-caption" style={{ fontWeight: 400 }}>
                                    {new Date(c.replied_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                                  </span>
                                )}
                              </div>
                              <p className="ws-prose" style={{ fontSize: 13 }}>{c.admin_reply}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <JourneyTracker phases={planPhases} />

      <MonthlyMetricsSection
        initialHistory={monthlyMetrics}
        initialCurrentMonthStart={currentMetricsMonthStart}
      />
      </>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <div className="ws-grid2">
        <div className="ws-panel p-5">
          <span className="ws-skel" style={{ width: 90, height: 10 }} />
          <span className="ws-skel mt-3" style={{ width: "60%", height: 18 }} />
          <span className="ws-skel mt-3" style={{ width: "100%", height: 4 }} />
        </div>
        <div className="ws-panel p-5">
          <span className="ws-skel" style={{ width: 90, height: 10 }} />
          <span className="ws-skel mt-3" style={{ width: "70%", height: 14 }} />
        </div>
      </div>
      <div className="ws-strip">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="ws-stat" style={{ cursor: "default" }}>
            <span className="ws-skel" style={{ width: 80, height: 10 }} />
            <span className="ws-skel" style={{ width: 48, height: 20 }} />
          </div>
        ))}
      </div>
      <div className="ws-pair">
        <div className="ws-panel"><SkeletonRows count={4} /></div>
        <div className="ws-panel"><SkeletonRows count={4} /></div>
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
    items.push({ icon: "plan", text: "Your weekly check-in is due today", href: "/portal/checkin", accent: true });
  } else {
    const dayStr = nextCheckinDate.toLocaleDateString("en-GB", { weekday: "long" });
    items.push({ icon: "calendar", text: `Next check-in: ${dayStr}` });
  }

  if (uncompletedModules > 0) {
    items.push({ icon: "book", text: `${uncompletedModules} training module${uncompletedModules > 1 ? "s" : ""} available`, href: "/portal/training" });
  }

  if (latestReply?.admin_reply && latestReply.replied_at) {
    const replyDate = new Date(latestReply.replied_at);
    const daysDiff = Math.floor((currentTime - replyDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff <= 3) {
      items.push({
        icon: "chat",
        text: "Marc replied to your latest check-in",
        href: `/portal/checkins/${latestReply.id}`,
        accent: true,
      });
    }
  }

  if (planPct > 0 && planPct < 100) {
    items.push({ icon: "reporting", text: `Business plan ${planPct}% complete`, href: "/portal/plan" });
  }

  if (items.length === 0) return null;

  return (
    <section className="ws-panel" aria-label="This week">
      <div className="ws-panel-head">
        <h2 className="ws-h2">This week</h2>
      </div>
      <div className="grid sm:grid-cols-2">
        {items.map((item, i) => {
          const inner = (
            <>
              <Icon name={item.icon} size={15} className="shrink-0" />
              <span className="ws-trunc">{item.text}</span>
            </>
          );
          const style: CSSProperties = {
            color: item.accent ? "var(--ws-accent-ink)" : "var(--ws-ink-2)",
            fontWeight: item.accent ? 500 : 400,
            height: 38,
          };
          return item.href ? (
            <Link key={i} href={item.href} className="ws-up-row ws-focus no-underline" style={style}>
              {inner}
            </Link>
          ) : (
            <div key={i} className="ws-up-row" style={{ ...style, cursor: "default" }}>
              {inner}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function JourneyTracker({
  phases,
}: {
  phases: BusinessPlanPhase[];
}) {
  if (phases.length === 0) {
    return (
      <section className="ws-panel" aria-label="Your journey">
        <div className="ws-panel-head">
          <h2 className="ws-h2">Your journey</h2>
          <span className="ws-caption">Waiting for plan</span>
        </div>
        <p className="ws-meta px-[14px] py-3">
          Your journey tracker will appear once Marc assigns your business plan. When that happens, this section will show each phase of your roadmap and your progress through it.
        </p>
      </section>
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
    <section className="ws-panel" aria-label="Your journey">
      <div className="ws-panel-head">
        <h2 className="ws-h2">Your journey</h2>
        <span className="ws-caption">{completedPhaseCount} of {phases.length} phases complete</span>
      </div>
      <div className="px-[14px] pt-3 pb-4">
        <p className="ws-meta mb-4">
          Current phase: <span style={{ color: "var(--ws-ink)", fontWeight: 500 }}>{currentPhaseLabel}</span>
        </p>

        {/* Progress bar with milestones */}
        <span className="ws-bar"><i style={{ width: `${progressPct}%` }} /></span>
        <div className="flex justify-between mt-3">
          {milestones.map((m, i) => {
            const reached = m.index < completedPhaseCount;
            const active = m.index === completedPhaseCount && completedPhaseCount < phases.length;
            const total = milestones.length;
            const isFirst = i === 0;
            const isLast = i === total - 1;
            return (
              <div key={m.index} className={`flex flex-col flex-1 ${isFirst ? "items-start" : isLast ? "items-end" : "items-center"}`}>
                <StatusIcon tone={reached ? "ok" : active ? "decide" : "open"} size={16} />
                <span
                  className="text-[11px] mt-1.5 max-w-[90px] leading-tight"
                  style={{
                    textAlign: isFirst ? "left" : isLast ? "right" : "center",
                    color: reached || active ? "var(--ws-ink)" : "var(--ws-ink-3)",
                    fontWeight: reached || active ? 500 : 400,
                  }}
                >
                  {m.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
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
      <section className="ws-panel min-w-0" aria-label="Next event">
        <div className="ws-panel-head">
          <h2 className="ws-h2">Coming up</h2>
        </div>
        <div className="ws-empty">
          <span className="ws-empty-glyph"><Icon name="calendar" size={20} /></span>
          <p className="ws-empty-h">No upcoming events</p>
        </div>
      </section>
    );
  }

  const dayName = nextDate.toLocaleDateString("en-GB", { weekday: "long" });
  const [h, m] = event.event_time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  const timeStr = `${hour}:${m.toString().padStart(2, "0")} ${period}`;
  const recurrenceText: Record<string, string> = { weekly: `Every ${dayName}`, biweekly: `Every other ${dayName}`, monthly: "Monthly", none: nextDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }) };

  return (
    <section className="ws-panel min-w-0 flex flex-col" aria-label="Next event">
      <div className="ws-panel-head">
        <h2 className="ws-h2">Next event</h2>
      </div>
      <div className="flex flex-1 flex-col justify-between gap-5 p-[14px]">
        <div className="flex items-start gap-3">
          <span className="ws-avatar" aria-hidden="true" style={{ "--c": "var(--ws-accent)", width: 32, height: 32, borderRadius: 8 } as CSSProperties}>
            <Icon name="calendar" size={15} />
          </span>
          <div className="min-w-0">
            <div className="text-[14.5px] font-semibold" style={{ color: "var(--ws-ink)" }}>{event.title}</div>
            <div className="ws-meta mt-0.5">{dayName}, {timeStr}</div>
            <div className="ws-caption">{recurrenceText[event.recurrence]}</div>
          </div>
        </div>
        {event.link && (
          <a href={event.link} target="_blank" rel="noopener noreferrer" className="ws-btn ws-focus w-full">
            <Icon name="external" size={14} />
            {event.link_label || "Join"}
          </a>
        )}
      </div>
    </section>
  );
}
