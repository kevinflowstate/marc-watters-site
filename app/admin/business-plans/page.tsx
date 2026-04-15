"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { BusinessPlan, TrafficLight } from "@/lib/types";
import BusinessPlanBuilder from "@/components/admin/BusinessPlanBuilder";

interface PlanWithClient extends BusinessPlan {
  client_name: string;
  client_id_profile: string;
  client_business: string;
  client_status: TrafficLight;
}

interface ClientStub {
  id: string;
  name: string;
  business_name: string;
  status?: TrafficLight;
}

export default function BusinessPlansPage() {
  const [plans, setPlans] = useState<PlanWithClient[]>([]);
  const [clientsWithoutPlan, setClientsWithoutPlan] = useState<ClientStub[]>([]);
  const [allClients, setAllClients] = useState<ClientStub[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "completed">("active");
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);

  // Builder state
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderClientId, setBuilderClientId] = useState<string | null>(null);
  const [builderPlan, setBuilderPlan] = useState<BusinessPlan | undefined>(undefined);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [planSaving, setPlanSaving] = useState(false);
  const [planSaveError, setPlanSaveError] = useState<string | null>(null);

  async function loadData() {
    try {
      const res = await fetch("/api/admin/business-plans");
      if (res.ok) {
        const data = await res.json();
        setPlans(data.plans || []);
        setClientsWithoutPlan(data.clientsWithoutPlan || []);
        setAllClients(data.allClients || []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  async function handleSavePlan(plan: BusinessPlan) {
    setPlanSaving(true);
    setPlanSaveError(null);

    try {
      const existingActive = plans.find((p) => p.client_id === plan.client_id && p.status === "active" && p.id !== plan.id);

      const saveRes = await fetch("/api/admin/business-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      if (!saveRes.ok) {
        const data = await saveRes.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save business plan");
      }

      if (existingActive && !builderPlan) {
        const completeRes = await fetch("/api/admin/business-plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "complete", plan_id: existingActive.id }),
        });

        if (!completeRes.ok) {
          const data = await completeRes.json().catch(() => ({}));
          throw new Error(data.error || "Saved the new plan but failed to archive the previous active plan");
        }
      }

      setBuilderOpen(false);
      setBuilderClientId(null);
      setBuilderPlan(undefined);
      await loadData();
    } catch (err) {
      setPlanSaveError(err instanceof Error ? err.message : "Failed to save business plan");
    } finally {
      setPlanSaving(false);
    }
  }

  function openCreateForClient(clientId: string) {
    setPlanSaveError(null);
    setBuilderClientId(clientId);
    setBuilderPlan(undefined);
    setBuilderOpen(true);
  }

  function openEditPlan(plan: PlanWithClient) {
    setPlanSaveError(null);
    setBuilderClientId(plan.client_id);
    setBuilderPlan(plan);
    setBuilderOpen(true);
  }

  const filtered = plans.filter(p => filter === "all" || p.status === filter);
  const activePlans = plans.filter(p => p.status === "active");

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-8 w-48 mb-6" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-bg-card/80 border border-[rgba(255,255,255,0.04)] rounded-2xl p-6">
            <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-5 w-1/3 mb-3" />
            <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-3 w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-heading font-bold text-text-primary">Business Plans</h1>
          <p className="text-text-secondary mt-1 text-sm">
            {activePlans.length} active plan{activePlans.length !== 1 ? "s" : ""} across {new Set(activePlans.map(p => p.client_id)).size} clients
          </p>
        </div>
        <button
          onClick={() => setClientPickerOpen(true)}
          className="px-4 py-2.5 gradient-accent text-white rounded-xl text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Plan
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6 bg-bg-card/50 rounded-xl p-1 w-fit">
        {(["active", "completed", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer capitalize ${
              filter === f
                ? "bg-accent/10 text-accent-bright border border-accent/20"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {f} {f === "active" ? `(${activePlans.length})` : f === "completed" ? `(${plans.filter(p => p.status === "completed").length})` : `(${plans.length})`}
          </button>
        ))}
      </div>

      {/* Clients without a plan */}
      {filter === "active" && clientsWithoutPlan.length > 0 && (
        <div className="bg-amber-500/[0.04] border border-amber-500/15 rounded-2xl px-5 py-4 mb-6">
          <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-3">
            Clients without an active plan ({clientsWithoutPlan.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {clientsWithoutPlan.map((c) => (
              <button
                key={c.id}
                onClick={() => openCreateForClient(c.id)}
                className="px-3 py-1.5 bg-white/5 hover:bg-accent/10 border border-[rgba(255,255,255,0.06)] hover:border-accent/20 rounded-lg text-xs text-text-secondary hover:text-accent-bright transition-all inline-flex items-center gap-1.5 cursor-pointer"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Plans list */}
      {filtered.length === 0 ? (
        <div className="bg-bg-card/80 border border-[rgba(255,255,255,0.04)] rounded-2xl p-8 text-center">
          <p className="text-text-muted text-sm">No {filter !== "all" ? filter : ""} business plans yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((plan) => {
            const allItems = plan.phases.flatMap((ph) => ph.items);
            const done = allItems.filter((i) => i.completed).length;
            const total = allItems.length;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            const trainingsCount = plan.phases.reduce((sum, ph) => sum + ph.linked_trainings.length, 0);
            const isExpanded = expandedPlan === plan.id;

            return (
              <div key={plan.id} className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(255,255,255,0.04)] rounded-2xl overflow-hidden">
                {/* Plan header */}
                <button
                  onClick={() => setExpandedPlan(isExpanded ? null : plan.id)}
                  className="w-full flex items-center justify-between p-5 hover:bg-[rgba(255,255,255,0.02)] transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                      plan.status === "active"
                        ? "bg-accent/10 text-accent-bright border border-accent/20"
                        : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    }`}>
                      {plan.client_name.split(" ").map(n => n[0]).join("")}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-text-primary">{plan.client_name}</span>
                        <span className="text-[10px] text-text-muted">({plan.client_business})</span>
                      </div>
                      <p className="text-xs text-text-muted truncate max-w-lg">{plan.summary}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-5 flex-shrink-0">
                    <div className="text-right hidden sm:block">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 bg-[rgba(255,255,255,0.03)] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${pct === 100 ? "bg-emerald-500" : "gradient-accent"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-text-muted w-7 text-right">{pct}%</span>
                      </div>
                      <div className="text-[10px] text-text-muted mt-0.5">
                        {plan.phases.length} sections - {total} items - {trainingsCount} trainings
                      </div>
                    </div>
                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold ${
                      plan.status === "active"
                        ? "bg-accent/10 text-accent-bright border border-accent/20"
                        : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    }`}>
                      {plan.status === "active" ? "Active" : "Completed"}
                    </span>
                    <svg
                      className={`w-4 h-4 text-text-muted transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Expanded plan detail */}
                {isExpanded && (
                  <div className="border-t border-[rgba(255,255,255,0.04)] px-5 pb-5">
                    {/* Actions bar */}
                    <div className="flex items-center justify-between py-3 border-b border-[rgba(255,255,255,0.03)] mb-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditPlan(plan)}
                          className="px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary border border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.15)] rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit Plan
                        </button>
                        <Link
                          href={`/admin/clients/${plan.client_id_profile}`}
                          className="px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary border border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.15)] rounded-lg transition-colors inline-flex items-center gap-1.5 no-underline"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          View Client
                        </Link>
                      </div>
                      {plan.status === "active" && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={async () => {
                              if (!confirm(`Mark ${plan.client_name}'s plan as complete?`)) return;
                              await fetch("/api/admin/business-plans", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ action: "complete", plan_id: plan.id }),
                              });
                              await loadData();
                            }}
                            className="px-3 py-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 border border-emerald-500/20 hover:border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Mark Complete
                          </button>
                          <button
                            onClick={() => openCreateForClient(plan.client_id)}
                            className="px-3 py-1.5 text-xs font-semibold text-white gradient-accent rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Assign New Plan
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Phases/sections */}
                    <div className="space-y-4">
                      {plan.phases.map((phase) => {
                        const phDone = phase.items.filter(i => i.completed).length;
                        const phTotal = phase.items.length;
                        const phPct = phTotal > 0 ? Math.round((phDone / phTotal) * 100) : 0;

                        return (
                          <div key={phase.id} className="bg-bg-primary/50 border border-[rgba(255,255,255,0.03)] rounded-xl p-4">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-semibold text-text-primary">{phase.name}</h4>
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 w-12 bg-[rgba(255,255,255,0.03)] rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${phPct === 100 ? "bg-emerald-500" : "gradient-accent"}`}
                                    style={{ width: `${phPct}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-text-muted">{phDone}/{phTotal}</span>
                              </div>
                            </div>

                            {phase.notes && (
                              <p className="text-xs text-text-secondary leading-relaxed mb-3 whitespace-pre-line">{phase.notes}</p>
                            )}

                            {/* Items */}
                            {phase.items.length > 0 && (
                              <div className="space-y-1 mb-2">
                                {phase.items.map((item) => (
                                  <div key={item.id} className="flex items-center gap-2 py-1">
                                    <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${
                                      item.completed ? "bg-emerald-500/20" : "border border-[rgba(255,255,255,0.1)]"
                                    }`}>
                                      {item.completed && (
                                        <svg className="w-2.5 h-2.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                      )}
                                    </div>
                                    <span className={`text-xs ${item.completed ? "text-text-muted line-through" : "text-text-secondary"}`}>
                                      {item.title}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Linked trainings */}
                            {phase.linked_trainings.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-[rgba(255,255,255,0.03)]">
                                <div className="text-[10px] text-text-muted font-semibold uppercase tracking-wider mb-1">
                                  Assigned Trainings ({phase.linked_trainings.length})
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {phase.linked_trainings.map((id) => (
                                    <span key={id} className="text-[10px] px-2 py-0.5 bg-accent/5 text-accent-bright rounded-md border border-accent/10">
                                      {id.slice(0, 8)}...
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Client picker modal */}
      {clientPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-bg-card border border-[rgba(255,255,255,0.08)] rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-heading font-bold text-text-primary mb-1">Create Business Plan</h3>
            <p className="text-xs text-text-muted mb-4">Select a client to create a plan for.</p>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {allClients.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setClientPickerOpen(false);
                    openCreateForClient(c.id);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left hover:bg-[rgba(255,255,255,0.04)] transition-colors cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-xs font-bold text-accent-bright flex-shrink-0">
                    {c.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm text-text-primary font-medium">{c.name}</div>
                    <div className="text-[10px] text-text-muted">{c.business_name}</div>
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setClientPickerOpen(false)}
              className="w-full mt-4 px-4 py-2.5 text-sm font-medium text-text-secondary bg-white/5 hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Business Plan Builder */}
      {builderOpen && builderClientId && (
        <BusinessPlanBuilder
          clientId={builderClientId}
          existingPlan={builderPlan}
          onSave={handleSavePlan}
          onCancel={() => {
            setPlanSaveError(null);
            setBuilderOpen(false);
            setBuilderClientId(null);
            setBuilderPlan(undefined);
          }}
          saving={planSaving}
          error={planSaveError}
        />
      )}
    </>
  );
}
