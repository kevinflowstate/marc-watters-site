"use client";

import { initials } from "@/lib/initials";
import { useState, useEffect, type CSSProperties } from "react";
import Link from "next/link";
import type { BusinessPlan, TrafficLight } from "@/lib/types";
import BusinessPlanBuilder from "@/components/admin/BusinessPlanBuilder";
import { Chip, Empty, Icon, SkeletonRows, StatusIcon } from "@/components/ops/workspace/WorkspaceUI";

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
  const [planSaveNotice, setPlanSaveNotice] = useState<string | null>(null);

  async function loadData() {
    try {
      const res = await fetch(`/api/admin/business-plans?fresh=${Date.now()}`, {
        cache: "no-store",
      });
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
    setPlanSaveNotice(null);

    try {
      const saveRes = await fetch("/api/admin/business-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      const data = await saveRes.json().catch(() => ({}));
      if (!saveRes.ok) {
        throw new Error(data.error || "Failed to save business plan");
      }

      setPlans((currentPlans) => currentPlans.map((currentPlan) => (
        currentPlan.id === plan.id
          ? { ...currentPlan, ...plan }
          : currentPlan
      )));
      setBuilderOpen(false);
      setBuilderClientId(null);
      setBuilderPlan(undefined);
      setPlanSaveNotice(`Saved ${data.itemCount ?? 0} action item${data.itemCount === 1 ? "" : "s"} across ${data.phaseCount ?? plan.phases.length} phase${data.phaseCount === 1 ? "" : "s"}.`);
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
      <div className="ws ws-page">
        <div>
          <span className="ws-skel" style={{ width: 160, height: 22 }} />
          <span className="ws-skel mt-2" style={{ width: 220, height: 12 }} />
        </div>
        <div className="ws-panel"><SkeletonRows count={4} /></div>
      </div>
    );
  }

  return (
    <div className="ws ws-page">
      {/* Header */}
      <div className="ws-ph">
        <div className="min-w-0">
          <h1 className="ws-title">Business plans</h1>
          <p className="ws-meta mt-1">
            {activePlans.length} active plan{activePlans.length !== 1 ? "s" : ""} across {new Set(activePlans.map(p => p.client_id)).size} clients
          </p>
        </div>
        <div className="ws-ph-acts">
          <button
            type="button"
            onClick={() => setClientPickerOpen(true)}
            className="ws-btn ws-btn-primary ws-focus"
          >
            <Icon name="plus" size={14} />
            Create plan
          </button>
        </div>
      </div>

      {planSaveNotice && (
        <div className="ws-note is-ok ws-bp-notice" role="status">
          <Icon name="checkCircle" size={15} />
          <span className="ws-bp-notice-t">{planSaveNotice}</span>
          <button type="button" onClick={() => setPlanSaveNotice(null)} className="ws-btn ws-btn-quiet ws-btn-sm ws-focus">
            Dismiss
          </button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="ws-seg" role="group" aria-label="Filter plans">
        {(["active", "completed", "all"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className="ws-seg-btn ws-focus ws-bp-seg"
          >
            {f}
            <span className="ws-seg-count">{f === "active" ? activePlans.length : f === "completed" ? plans.filter(p => p.status === "completed").length : plans.length}</span>
          </button>
        ))}
      </div>

      {/* Clients without a plan */}
      {filter === "active" && clientsWithoutPlan.length > 0 && (
        <section className="ws-panel" aria-label="Clients without an active plan">
          <header className="ws-panel-head">
            <span className="ws-dot" style={{ color: "var(--ws-attn)" }} />
            <h2 className="ws-h2">Clients without an active plan</h2>
            <span className="ws-caption">{clientsWithoutPlan.length}</span>
          </header>
          <div className="ws-bp-wrap">
            {clientsWithoutPlan.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => openCreateForClient(c.id)}
                className="ws-btn ws-btn-sm ws-focus"
              >
                <Icon name="plus" size={12} />
                {c.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Plans list */}
      {filtered.length === 0 ? (
        <div className="ws-panel">
          <Empty icon="plan" title={`No ${filter !== "all" ? filter : ""} business plans yet.`} />
        </div>
      ) : (
        <div className="ws-panel ws-bp-list">
          {filtered.map((plan) => {
            const allItems = plan.phases.flatMap((ph) => ph.items);
            const done = allItems.filter((i) => i.completed).length;
            const total = allItems.length;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            const trainingsCount = plan.phases.reduce((sum, ph) => sum + ph.linked_trainings.length, 0);
            const isExpanded = expandedPlan === plan.id;

            return (
              <div key={plan.id} className="ws-bp-plan">
                {/* Plan header */}
                <button
                  type="button"
                  onClick={() => setExpandedPlan(isExpanded ? null : plan.id)}
                  aria-expanded={isExpanded}
                  className="ws-row ws-focus ws-bp-row"
                >
                  <span className="ws-avatar is-md" style={{ "--c": plan.status === "active" ? "var(--ws-accent)" : "var(--ws-ok)" } as CSSProperties} aria-hidden="true">
                    {initials(plan.client_name)}
                  </span>
                  <span className="min-w-0">
                    <span className="ws-row-title">
                      {plan.client_name}
                      <span className="ws-bp-biz"> · {plan.client_business}</span>
                    </span>
                    <span className="ws-row-sub ws-bp-summary">{plan.summary}</span>
                  </span>
                  <span className="ws-row-meta">
                    <span className="ws-bp-prog ws-sm-up">
                      <span className="ws-bp-prog-top">
                        <span className="ws-bar ws-bp-bar"><i style={{ width: `${pct}%`, ...(pct === 100 ? { "--c": "var(--ws-ok)" } : {}) } as CSSProperties} /></span>
                        <span className="ws-bp-pct">{pct}%</span>
                      </span>
                      <span className="ws-bp-counts">
                        {plan.phases.length} sections - {total} items - {trainingsCount} trainings
                      </span>
                    </span>
                    <Chip tone={plan.status === "active" ? "decide" : "ok"}>
                      {plan.status === "active" ? "Active" : "Completed"}
                    </Chip>
                    <Icon name="chevron" size={14} className={`ws-chev ${isExpanded ? "is-open" : ""}`} />
                  </span>
                </button>

                {/* Expanded plan detail */}
                {isExpanded && (
                  <div className="ws-bp-detail">
                    {/* Actions bar */}
                    <div className="ws-bp-acts">
                      <div className="ws-bp-acts-g">
                        <button
                          type="button"
                          onClick={() => openEditPlan(plan)}
                          className="ws-btn ws-btn-sm ws-focus"
                        >
                          <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit plan
                        </button>
                        <Link
                          href={`/admin/clients/${plan.client_id_profile}`}
                          className="ws-btn ws-btn-sm ws-focus"
                        >
                          <Icon name="owner" size={13} />
                          View client
                        </Link>
                      </div>
                      {plan.status === "active" && (
                        <div className="ws-bp-acts-g">
                          <button
                            type="button"
                            onClick={async () => {
                              if (!confirm(`Mark ${plan.client_name}'s plan as complete?`)) return;
                              await fetch("/api/admin/business-plans", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ action: "complete", plan_id: plan.id }),
                              });
                              await loadData();
                            }}
                            className="ws-btn ws-btn-sm ws-focus"
                          >
                            <Icon name="check" size={13} />
                            Mark complete
                          </button>
                          <button
                            type="button"
                            onClick={() => openCreateForClient(plan.client_id)}
                            className="ws-btn ws-btn-sm ws-btn-primary ws-focus"
                          >
                            <Icon name="plus" size={13} />
                            Assign new plan
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Phases/sections */}
                    <div className="ws-bp-phases">
                      {plan.phases.map((phase) => {
                        const phDone = phase.items.filter(i => i.completed).length;
                        const phTotal = phase.items.length;
                        const phPct = phTotal > 0 ? Math.round((phDone / phTotal) * 100) : 0;

                        return (
                          <div key={phase.id} className="ws-bp-phase">
                            <div className="ws-bp-phase-head">
                              <h4 className="ws-h2 ws-bp-phase-t">{phase.name}</h4>
                              <span className="ws-bp-prog-top">
                                <span className="ws-bar ws-bp-bar is-sm"><i style={{ width: `${phPct}%`, ...(phPct === 100 ? { "--c": "var(--ws-ok)" } : {}) } as CSSProperties} /></span>
                                <span className="ws-bp-pct">{phDone}/{phTotal}</span>
                              </span>
                            </div>

                            {phase.notes && (
                              <p className="ws-bp-phase-note">{phase.notes}</p>
                            )}

                            {/* Items */}
                            {phase.items.length > 0 && (
                              <div className="ws-bp-items">
                                {phase.items.map((item) => (
                                  <div key={item.id} className={`ws-bp-item ${item.completed ? "is-done" : ""}`}>
                                    <StatusIcon tone={item.completed ? "ok" : "open"} />
                                    <span>{item.title}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Linked trainings */}
                            {phase.linked_trainings.length > 0 && (
                              <div className="ws-bp-trainings">
                                <div className="ws-field-l">
                                  Assigned trainings ({phase.linked_trainings.length})
                                </div>
                                <div className="ws-bp-wrap is-tight">
                                  {phase.linked_trainings.map((id) => (
                                    <span key={id} className="ws-chip">
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
        <div className="ws-overlay">
          <div className="ws-overlay-bg" />
          <div className="ws-dialog" role="dialog" aria-modal="true" aria-label="Create business plan">
            <div className="ws-dialog-head">
              <div className="min-w-0">
                <h3 className="ws-dialog-title">Create business plan</h3>
                <p className="ws-caption mt-0.5">Select a client to create a plan for.</p>
              </div>
            </div>
            <div className="ws-dialog-body">
              <div className="ws-bp-pick">
                {allClients.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setClientPickerOpen(false);
                      openCreateForClient(c.id);
                    }}
                    className="ws-row ws-focus ws-bp-pick-row"
                  >
                    <span className="ws-avatar is-md" aria-hidden="true">
                      {initials(c.name)}
                    </span>
                    <span className="min-w-0">
                      <span className="ws-row-title">{c.name}</span>
                      <span className="ws-row-sub">{c.business_name}</span>
                    </span>
                  </button>
                ))}
              </div>
              <div className="ws-dialog-foot">
                <button
                  type="button"
                  onClick={() => setClientPickerOpen(false)}
                  className="ws-btn ws-btn-quiet ws-focus"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Business Plan Builder */}
      {builderOpen && builderClientId && (
        <BusinessPlanBuilder
          clientId={builderClientId}
          existingPlan={builderPlan}
          onSave={handleSavePlan}
          onPdfUploaded={loadData}
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
    </div>
  );
}
