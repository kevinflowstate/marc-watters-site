"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { trainingLessonHref } from "@/lib/portal-training-links";

interface PlanItem {
  id: string;
  title: string;
  completed: boolean;
  completed_at?: string;
  order_index: number;
}

interface LinkedTraining {
  id: string;
  title: string;
  content_type: string;
  duration_minutes: number;
  module_id: string;
  moduleName: string;
}

interface PlanPhase {
  id: string;
  name: string;
  notes: string;
  order_index: number;
  items: PlanItem[];
  linkedTrainings: LinkedTraining[];
}

interface BusinessPlan {
  id: string;
  summary: string;
  status: string;
  created_at: string;
  pdf_url?: string;
}

const phaseIcons: Record<string, string> = {
  financial: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  pipeline: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
  team: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  systems: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  default: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
};

const phaseColors = [
  { bg: "bg-blue-500/10", border: "border-blue-500/20", icon: "text-blue-400", accent: "text-blue-400" },
  { bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: "text-emerald-400", accent: "text-emerald-400" },
  { bg: "bg-purple-500/10", border: "border-purple-500/20", icon: "text-purple-400", accent: "text-purple-400" },
  { bg: "bg-amber-500/10", border: "border-amber-500/20", icon: "text-amber-400", accent: "text-amber-400" },
];

function getPhaseIcon(name: string): string {
  if (typeof name !== "string") return phaseIcons.default;
  const lower = name.toLowerCase();
  if (lower.includes("financial") || lower.includes("foundation") || lower.includes("pricing")) return phaseIcons.financial;
  if (lower.includes("pipeline") || lower.includes("sales") || lower.includes("growth")) return phaseIcons.pipeline;
  if (lower.includes("team") || lower.includes("hire") || lower.includes("people")) return phaseIcons.team;
  if (lower.includes("system") || lower.includes("operation")) return phaseIcons.systems;
  return phaseIcons.default;
}

function normalizePhases(phases: unknown[]): PlanPhase[] {
  return phases.map((phase, index) => {
    const rawPhase = phase as Partial<PlanPhase> & {
      items?: unknown[];
      linkedTrainings?: unknown[];
    };

    return {
      id: typeof rawPhase.id === "string" ? rawPhase.id : `phase-${index}`,
      name: typeof rawPhase.name === "string" ? rawPhase.name : "Untitled phase",
      notes: typeof rawPhase.notes === "string" ? rawPhase.notes : "",
      order_index: typeof rawPhase.order_index === "number" ? rawPhase.order_index : index,
      items: (Array.isArray(rawPhase.items) ? rawPhase.items : []).map((item, itemIndex) => {
        const rawItem = item as Partial<PlanItem>;
        return {
          id: typeof rawItem.id === "string" ? rawItem.id : `item-${index}-${itemIndex}`,
          title: typeof rawItem.title === "string" ? rawItem.title : "Untitled action",
          completed: Boolean(rawItem.completed),
          completed_at: typeof rawItem.completed_at === "string" ? rawItem.completed_at : undefined,
          order_index: typeof rawItem.order_index === "number" ? rawItem.order_index : itemIndex,
        };
      }),
      linkedTrainings: (Array.isArray(rawPhase.linkedTrainings) ? rawPhase.linkedTrainings : []).map((training, trainingIndex) => {
        const rawTraining = training as Partial<LinkedTraining>;
        return {
          id: typeof rawTraining.id === "string" ? rawTraining.id : `training-${index}-${trainingIndex}`,
          title: typeof rawTraining.title === "string" ? rawTraining.title : "Untitled training",
          content_type: typeof rawTraining.content_type === "string" ? rawTraining.content_type : "",
          duration_minutes: typeof rawTraining.duration_minutes === "number" ? rawTraining.duration_minutes : 0,
          module_id: typeof rawTraining.module_id === "string" ? rawTraining.module_id : "",
          moduleName: typeof rawTraining.moduleName === "string" ? rawTraining.moduleName : "",
        };
      }),
    };
  });
}

export default function BusinessPlanPage() {
  const [plan, setPlan] = useState<BusinessPlan | null>(null);
  const [phases, setPhases] = useState<PlanPhase[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [failedItemId, setFailedItemId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/portal/plan?fresh=${Date.now()}`, {
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          if (cancelled) return;
          setPlan(data.plan);
          setPhases(normalizePhases(Array.isArray(data.phases) ? data.phases : []));
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

  async function toggleItem(phaseId: string, itemId: string) {
    if (pendingItemId) return;
    setPendingItemId(itemId);
    setFailedItemId(null);
    // Optimistic update
    setPhases((prev) =>
      prev.map((phase) => {
        if (phase.id !== phaseId) return phase;
        return {
          ...phase,
          items: phase.items.map((item) =>
            item.id === itemId
              ? { ...item, completed: !item.completed, completed_at: !item.completed ? new Date().toISOString() : undefined }
              : item
          ),
        };
      })
    );
    // Persist - rollback on failure
    try {
      const res = await fetch("/api/portal/plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      if (!res.ok) throw new Error("Could not update action");
    } catch {
      // Reverse the optimistic update
      setPhases((prev) =>
        prev.map((phase) => {
          if (phase.id !== phaseId) return phase;
          return {
            ...phase,
            items: phase.items.map((item) =>
              item.id === itemId
                ? { ...item, completed: !item.completed, completed_at: !item.completed ? new Date().toISOString() : undefined }
                : item
            ),
          };
        })
      );
      setFailedItemId(itemId);
    } finally {
      setPendingItemId(null);
    }
  }

  if (loading) return (
    <div className="space-y-6">
      <div className="space-y-2 mb-8">
        <div className="skeleton rounded-lg h-8 w-64" />
        <div className="skeleton rounded-lg h-4 w-full max-w-xl" />
      </div>
      <div className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-6">
        <div className="flex justify-between mb-3">
          <div className="skeleton rounded-lg h-4 w-32" />
          <div className="skeleton rounded-lg h-4 w-24" />
        </div>
        <div className="skeleton rounded-full h-3 w-full" />
      </div>
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl overflow-hidden">
          <div className="p-6">
            <div className="flex items-center gap-4">
              <div className="skeleton w-12 h-12 rounded-xl" />
              <div className="flex-1 space-y-2">
                <div className="skeleton rounded-lg h-5 w-48" />
                <div className="skeleton rounded-full h-1.5 w-full" />
              </div>
            </div>
          </div>
          <div className="p-6 space-y-3">
            {[...Array(3)].map((_, j) => (
              <div key={j} className="skeleton rounded-lg h-4 w-full" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  if (!plan) {
    return (
      <div className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-8 text-center">
        <p className="text-text-secondary">No business plan created yet.</p>
        <p className="text-text-muted text-sm mt-2">Marc will build your plan based on your discovery session.</p>
      </div>
    );
  }

  const allItems = phases.flatMap((p) => p.items);
  const completedItems = allItems.filter((i) => i.completed).length;
  const totalItems = allItems.length;
  const pct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  const currentPhaseIndex = phases.findIndex((phase) => phase.items.some((item) => !item.completed));
  const activePhaseIndex = currentPhaseIndex === -1 ? Math.max(phases.length - 1, 0) : currentPhaseIndex;
  const nextAction = allItems.find((item) => !item.completed);

  return (
    <>
      <div className="mb-7 sm:mb-9">
        <div className="v2-eyebrow mb-3">Your roadmap</div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="v2-page-title">Your Business Plan</h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-text-secondary whitespace-pre-line">{plan.summary}</p>
          </div>
          {plan.pdf_url && (
            <a
              href={plan.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="v2-button-secondary shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download PDF
            </a>
          )}
        </div>
      </div>

      <section className="v2-surface-strong mb-6 overflow-hidden p-5 sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-end">
          <div>
            <div className="v2-eyebrow">Next action</div>
            <h2 className="mt-3 max-w-3xl font-heading text-xl font-bold leading-snug text-text-primary sm:text-2xl">
              {nextAction?.title || "All current actions are complete"}
            </h2>
            <p className="mt-2 text-sm text-text-secondary">
              {phases[activePhaseIndex]?.name || "Your plan"}
            </p>
          </div>
          <div className="lg:text-right">
            <div className="font-heading text-4xl font-bold tracking-[-0.04em] text-text-primary">{pct}%</div>
            <div className="mt-1 text-xs text-text-muted">{completedItems} of {totalItems} actions complete</div>
          </div>
        </div>
        <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full rounded-full bg-accent-bright transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </section>

      {/* Phases */}
      <div className="space-y-4 sm:space-y-5">
        {phases.map((phase, i) => {
          const color = phaseColors[i % phaseColors.length];
          const phaseCompleted = phase.items.filter((item) => item.completed).length;
          const phaseTotal = phase.items.length;
          const phasePct = phaseTotal > 0 ? Math.round((phaseCompleted / phaseTotal) * 100) : 0;
          const isCurrent = i === activePhaseIndex && phasePct < 100;
          const isComplete = phasePct === 100 && phaseTotal > 0;

          return (
            <div key={phase.id} className={`v2-surface overflow-hidden ${isCurrent ? "!border-accent/30" : ""}`}>
              {/* Phase header */}
              <div className={`p-5 sm:p-6 border-b border-[rgba(255,255,255,0.05)] ${isCurrent ? "bg-accent/[0.07]" : color.bg}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl ${color.bg} border ${color.border} flex items-center justify-center`}>
                    <svg className={`w-6 h-6 ${color.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={getPhaseIcon(phase.name)} />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">Phase {i + 1}</div>
                        <h2 className="mt-1 text-lg font-heading font-bold text-text-primary">{phase.name}</h2>
                      </div>
                      <span className={`w-fit rounded-full border px-2.5 py-1 text-[11px] font-semibold ${isComplete ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : isCurrent ? "border-accent/25 bg-accent/10 text-accent-bright" : "border-white/10 bg-white/[0.03] text-text-muted"}`}>
                        {isComplete ? "Complete" : isCurrent ? "Current phase" : `${phaseCompleted}/${phaseTotal} actions`}
                      </span>
                    </div>
                    <div className="w-full bg-[rgba(255,255,255,0.06)] rounded-full h-1.5 mt-2">
                      <div className="h-1.5 rounded-full gradient-accent transition-all duration-500" style={{ width: `${phasePct}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5 sm:p-6 space-y-6">
                {/* Notes from Marc */}
                {phase.notes && (
                  <div className="bg-bg-primary border border-[rgba(255,255,255,0.04)] rounded-xl p-4">
                    <div className="v2-eyebrow mb-2">Notes from Marc</div>
                    <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">{phase.notes}</p>
                  </div>
                )}

                {/* Action items */}
                <div>
                  <h3 className="v2-eyebrow mb-3 !text-text-muted">Action Items</h3>
                  <div className="divide-y divide-white/[0.05] overflow-hidden rounded-xl border border-white/[0.06] bg-black/10">
                    {phase.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => toggleItem(phase.id, item.id)}
                        disabled={pendingItemId !== null}
                        aria-pressed={item.completed}
                        className="group flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.025] disabled:cursor-wait disabled:opacity-70"
                      >
                        <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                          item.completed ? "bg-emerald-500 border-emerald-500" : "border-[rgba(255,255,255,0.15)] group-hover:border-accent/50"
                        }`}>
                          {pendingItemId === item.id ? (
                            <span className="brand-spinner h-3.5 w-3.5 border-2" />
                          ) : item.completed && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className="min-w-0 flex-1">
                          <span className={`block text-sm leading-relaxed transition-all duration-200 ${item.completed ? "text-text-muted line-through" : "text-text-primary group-hover:text-accent-bright"}`}>
                            {item.title}
                          </span>
                          {failedItemId === item.id && <span className="mt-0.5 block text-xs text-red-300">Couldn&apos;t save. Tap to try again.</span>}
                        </span>
                        {item.completed_at && pendingItemId !== item.id && (
                          <span className="ml-auto hidden text-[10px] text-text-muted sm:block">
                            {new Date(item.completed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Linked Trainings */}
                {phase.linkedTrainings.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Related Training</h3>
                    <div className="space-y-1.5">
                      {phase.linkedTrainings.map((training) => (
                        <Link
                          key={training.id}
                          href={trainingLessonHref(training.module_id, training.id)}
                          className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-[rgba(255,255,255,0.03)] transition-colors no-underline group"
                        >
                          <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                            <svg className="w-3.5 h-3.5 text-accent-bright" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-text-primary group-hover:text-accent-bright transition-colors">{training.title}</div>
                            <div className="text-[10px] text-text-muted">{training.moduleName} - {training.duration_minutes} min</div>
                          </div>
                          <svg className="w-4 h-4 text-text-muted group-hover:text-accent-bright transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
