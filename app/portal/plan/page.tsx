"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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
  const lower = name.toLowerCase();
  if (lower.includes("financial") || lower.includes("foundation") || lower.includes("pricing")) return phaseIcons.financial;
  if (lower.includes("pipeline") || lower.includes("sales") || lower.includes("growth")) return phaseIcons.pipeline;
  if (lower.includes("team") || lower.includes("hire") || lower.includes("people")) return phaseIcons.team;
  if (lower.includes("system") || lower.includes("operation")) return phaseIcons.systems;
  return phaseIcons.default;
}

export default function BusinessPlanPage() {
  const [plan, setPlan] = useState<BusinessPlan | null>(null);
  const [phases, setPhases] = useState<PlanPhase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/portal/plan");
        if (res.ok) {
          const data = await res.json();
          setPlan(data.plan);
          setPhases(data.phases || []);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return (
    <div className="space-y-6">
      <div className="space-y-2 mb-8">
        <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-8 w-64" />
        <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-4 w-full max-w-xl" />
      </div>
      <div className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-6">
        <div className="flex justify-between mb-3">
          <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-4 w-32" />
          <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-4 w-24" />
        </div>
        <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-full h-3 w-full" />
      </div>
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl overflow-hidden">
          <div className="p-6 animate-pulse bg-[rgba(255,255,255,0.03)]">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[rgba(255,255,255,0.06)]" />
              <div className="flex-1 space-y-2">
                <div className="bg-[rgba(255,255,255,0.06)] rounded-lg h-5 w-48" />
                <div className="bg-[rgba(255,255,255,0.06)] rounded-full h-1.5 w-full" />
              </div>
            </div>
          </div>
          <div className="p-6 space-y-3">
            {[...Array(3)].map((_, j) => (
              <div key={j} className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-4 w-full" />
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

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold text-text-primary">Your Business Plan</h1>
        <p className="text-text-secondary mt-2 leading-relaxed max-w-3xl">{plan.summary}</p>
      </div>

      {/* Progress overview */}
      <div className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-6 mb-8">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-heading font-bold text-text-primary">Overall Progress</span>
          <span className="text-sm text-text-muted">{completedItems}/{totalItems} actions - {pct}%</span>
        </div>
        <div className="w-full bg-[rgba(255,255,255,0.04)] rounded-full h-3">
          <div className="h-3 rounded-full gradient-accent transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Phases */}
      <div className="space-y-6">
        {phases.map((phase, i) => {
          const color = phaseColors[i % phaseColors.length];
          const phaseCompleted = phase.items.filter((item) => item.completed).length;
          const phaseTotal = phase.items.length;
          const phasePct = phaseTotal > 0 ? Math.round((phaseCompleted / phaseTotal) * 100) : 0;

          return (
            <div key={phase.id} className="group/phase relative bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:border-[rgba(34,114,222,0.15)] hover:shadow-[0_10px_30px_rgba(0,0,0,0.2),0_0_30px_rgba(34,114,222,0.04)] will-change-transform">
                {/* Bento dot pattern */}
                <div className="absolute inset-0 opacity-0 group-hover/phase:opacity-100 transition-opacity duration-300 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[length:4px_4px] z-10 pointer-events-none" />
                {/* Bento gradient border */}
                <div className="absolute inset-0 -z-10 rounded-2xl p-px bg-gradient-to-br from-transparent via-white/10 to-transparent opacity-0 group-hover/phase:opacity-100 transition-opacity duration-300 pointer-events-none" />
              {/* Phase header */}
              <div className={`p-6 border-b border-[rgba(255,255,255,0.04)] ${color.bg}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl ${color.bg} border ${color.border} flex items-center justify-center`}>
                    <svg className={`w-6 h-6 ${color.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={getPhaseIcon(phase.name)} />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-heading font-bold text-text-primary">{phase.name}</h2>
                      <span className="text-xs text-text-muted">{phaseCompleted}/{phaseTotal} - {phasePct}%</span>
                    </div>
                    <div className="w-full bg-[rgba(255,255,255,0.06)] rounded-full h-1.5 mt-2">
                      <div className="h-1.5 rounded-full gradient-accent transition-all duration-500" style={{ width: `${phasePct}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Notes from Marc */}
                {phase.notes && (
                  <div className="bg-bg-primary border border-[rgba(255,255,255,0.04)] rounded-xl p-4">
                    <div className="text-[10px] text-accent-bright font-semibold uppercase tracking-wider mb-2">Notes from Marc</div>
                    <p className="text-sm text-text-secondary leading-relaxed">{phase.notes}</p>
                  </div>
                )}

                {/* Action items */}
                <div>
                  <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Action Items</h3>
                  <div className="space-y-2">
                    {phase.items.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 py-2">
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
                          item.completed ? "bg-emerald-500 border-emerald-500" : "border-[rgba(255,255,255,0.15)]"
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
                        {item.completed_at && (
                          <span className="text-[10px] text-text-muted ml-auto">
                            {new Date(item.completed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          </span>
                        )}
                      </div>
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
                          href={`/portal/training/${training.module_id}`}
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
