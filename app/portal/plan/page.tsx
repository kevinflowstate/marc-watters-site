"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { trainingLessonHref } from "@/lib/portal-training-links";
import { Chip, Icon, SkeletonRows, StatusIcon } from "@/components/ops/workspace/WorkspaceUI";

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
    <div className="ws ws-page" role="status" aria-label="Loading business plan">
      <div className="ws-ph">
        <div className="min-w-0" style={{ display: "grid", gap: 8 }}>
          <span className="ws-skel" style={{ width: 240, height: 22 }} />
          <span className="ws-skel" style={{ width: 420, maxWidth: "80vw", height: 12 }} />
        </div>
      </div>
      <div className="ws-panel ws-pad">
        <span className="ws-skel" style={{ width: "60%", height: 16 }} />
        <span className="ws-skel" style={{ width: "100%", height: 4, marginTop: 16 }} />
      </div>
      {[...Array(3)].map((_, i) => (
        <div key={i} className="ws-panel">
          <SkeletonRows count={3} />
        </div>
      ))}
    </div>
  );

  if (!plan) {
    return (
      <div className="ws ws-page">
        <h1 className="ws-title">Your business plan</h1>
        <section className="ws-panel">
          <div className="ws-empty ws-empty-lg">
            <span className="ws-empty-glyph"><Icon name="plan" size={20} /></span>
            <p className="ws-empty-h">No business plan created yet.</p>
            <p>Marc will build your plan based on your discovery session.</p>
          </div>
        </section>
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
    <div className="ws ws-page">
      <div className="ws-ph">
        <div className="min-w-0">
          <h1 className="ws-title">Your business plan</h1>
          <p className="ws-meta mt-1 max-w-3xl whitespace-pre-line">{plan.summary}</p>
        </div>
        {plan.pdf_url && (
          <div className="ws-ph-acts">
            <a
              href={plan.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="ws-btn ws-focus"
            >
              <Icon name="external" size={14} />
              Download PDF
            </a>
          </div>
        )}
      </div>

      <section className="ws-panel" aria-label="Next action">
        <div className="ws-pl-focus">
          <div className="min-w-0">
            <div className="ws-caption">Next action</div>
            <h2 className="ws-pl-focus-t">
              {nextAction?.title || "All current actions are complete"}
            </h2>
            <p className="ws-meta mt-1">
              {phases[activePhaseIndex]?.name || "Your plan"}
            </p>
          </div>
          <div className="ws-pl-focus-n">
            <div className="ws-pl-pct">{pct}%</div>
            <div className="ws-caption">{completedItems} of {totalItems} actions complete</div>
          </div>
        </div>
        <div className="ws-pl-focus-bar">
          <span className="ws-bar"><i style={{ width: `${pct}%` }} /></span>
        </div>
      </section>

      {/* Phases */}
      <div className="ws-stack">
        {phases.map((phase, i) => {
          const phaseCompleted = phase.items.filter((item) => item.completed).length;
          const phaseTotal = phase.items.length;
          const phasePct = phaseTotal > 0 ? Math.round((phaseCompleted / phaseTotal) * 100) : 0;
          const isCurrent = i === activePhaseIndex && phasePct < 100;
          const isComplete = phasePct === 100 && phaseTotal > 0;

          return (
            <section key={phase.id} className={`ws-panel ws-pl-phase ${isCurrent ? "is-current" : ""}`} aria-label={phase.name}>
              {/* Phase header */}
              <div className="ws-pl-phase-head">
                <StatusIcon tone={isComplete ? "ok" : phaseCompleted > 0 || isCurrent ? "running" : "open"} />
                <div className="min-w-0 flex-1">
                  <div className="ws-pl-phase-top">
                    <div className="min-w-0">
                      <div className="ws-caption">Phase {i + 1}</div>
                      <h2 className="ws-cd-h">{phase.name}</h2>
                    </div>
                    <Chip tone={isComplete ? "ok" : isCurrent ? "decide" : undefined}>
                      {isComplete ? "Complete" : isCurrent ? "Current phase" : `${phaseCompleted}/${phaseTotal} actions`}
                    </Chip>
                  </div>
                  <span className="ws-bar mt-2" style={isComplete ? ({ "--c": "var(--ws-ok)" } as CSSProperties) : undefined}>
                    <i style={{ width: `${phasePct}%` }} />
                  </span>
                </div>
              </div>

              <div className="ws-pl-phase-body">
                {/* Notes from Marc */}
                {phase.notes && (
                  <div className="ws-pl-notes">
                    <div className="ws-field-l">Notes from Marc</div>
                    <p className="ws-prose whitespace-pre-line">{phase.notes}</p>
                  </div>
                )}

                {/* Action items */}
                <div>
                  <h3 className="ws-pl-sub">Action items</h3>
                  <div className="ws-pl-items">
                    {phase.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => toggleItem(phase.id, item.id)}
                        disabled={pendingItemId !== null}
                        aria-pressed={item.completed}
                        className={`ws-row ws-focus ws-pl-item ${item.completed ? "is-done" : ""}`}
                      >
                        <span className="ws-pl-tick">
                          {pendingItemId === item.id ? (
                            <Icon name="refresh" size={14} className="ws-spin" />
                          ) : item.completed ? (
                            <StatusIcon tone="ok" />
                          ) : (
                            <StatusIcon tone="open" />
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="ws-row-title">
                            {item.title}
                          </span>
                          {failedItemId === item.id && <span className="ws-pl-fail">Couldn&apos;t save. Tap to try again.</span>}
                        </span>
                        {item.completed_at && pendingItemId !== item.id && (
                          <span className="ws-row-meta ws-sm-up">
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
                    <h3 className="ws-pl-sub">Related training</h3>
                    <div className="ws-pl-items">
                      {phase.linkedTrainings.map((training) => (
                        <Link
                          key={training.id}
                          href={trainingLessonHref(training.module_id, training.id)}
                          className="ws-row ws-focus ws-pl-train no-underline"
                        >
                          <Icon name="play" size={13} className="ws-status-ic" />
                          <span className="min-w-0">
                            <span className="ws-row-title">{training.title}</span>
                            <span className="ws-row-sub">{training.moduleName} - {training.duration_minutes} min</span>
                          </span>
                          <Icon name="chevron" size={14} className="ws-chev" />
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
