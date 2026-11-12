"use client";
import { initials } from "@/lib/initials";
import ReplyDraftCard from "@/components/reply-drafts/ReplyDraftCard";

import { useState, useEffect, useCallback, type CSSProperties, type ReactNode } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ClientSignals from "@/components/ops/ClientSignals";
import MonthlyMetricsOverview from "@/components/shared/MonthlyMetricsOverview";
import type { AdminClient } from "@/lib/admin-data";
import type { TrafficLight, CheckInMood, BusinessPlan, BusinessPlanPhase, CheckinFormConfig, FormQuestion, QuestionnaireFormConfig } from "@/lib/types";
import { formatMetricsMonthLabel, getCurrentMetricsMonthStart } from "@/lib/monthly-metrics";
import BusinessPlanBuilder from "@/components/admin/BusinessPlanBuilder";
import { getQuestionAnswerLabel } from "@/lib/questionnaires";
import { Chip, Empty, Icon, SkeletonRows, StatusIcon, type Tone } from "@/components/ops/workspace/WorkspaceUI";

const statusConfig: Record<TrafficLight, { label: string; tone: "bad" | "attn" | "ok"; colour: string }> = {
  red: { label: "Gone quiet", tone: "bad", colour: "var(--ws-bad)" },
  amber: { label: "Behind", tone: "attn", colour: "var(--ws-attn)" },
  green: { label: "On track", tone: "ok", colour: "var(--ws-ok)" },
};

const moodConfig: Record<CheckInMood, { tone?: "ok" | "attn" | "bad" | "decide" }> = {
  great: { tone: "ok" },
  good: { tone: "decide" },
  okay: { tone: "attn" },
  struggling: { tone: "bad" },
  awful: { tone: "bad" },
};

const moodText = (mood: string) => (mood ? mood[0].toUpperCase() + mood.slice(1) : mood);

const shortDate = (value: string) => new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const longDate = (value: string) => new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** Glyph for a share of work done: hollow, half, or ticked. */
function progressTone(done: number, total: number): Tone {
  if (total > 0 && done >= total) return "ok";
  if (done > 0) return "running";
  return "open";
}

function Bar({ pct, colour, width = 64 }: { pct: number; colour?: string; width?: number }) {
  return (
    <span className="ws-cd-prog">
      <span className="ws-bar" style={{ width, ...(colour ? { "--c": colour } : {}) } as CSSProperties}>
        <i style={{ width: `${pct}%` }} />
      </span>
      <span className="ws-pct">{pct}%</span>
    </span>
  );
}

function Spinner() {
  return <Icon name="refresh" size={14} className="ws-spin" />;
}

/** A panel whose head opens and closes its body. */
function TogglePanel({
  open,
  onToggle,
  title,
  meta,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  title: string;
  meta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="ws-panel min-w-0" aria-label={title}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="ws-panel-head ws-cd-toggle ws-focus">
        <h2 className="ws-h2">{title}</h2>
        {meta}
        <Icon name="chevron" size={14} className={`ws-chev ml-auto ${open ? "is-open" : ""}`} />
      </button>
      {open && children}
    </section>
  );
}

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
  const [client, setClient] = useState<AdminClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<BusinessPlan[]>([]);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [showHistory, setShowHistory] = useState(false);
  const [expandedHistoryPlan, setExpandedHistoryPlan] = useState<string | null>(null);
  const [builderMode, setBuilderMode] = useState<"closed" | "create" | "edit">("closed");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [planSaving, setPlanSaving] = useState(false);
  const [planSaveError, setPlanSaveError] = useState<string | null>(null);
  const [planSaveNotice, setPlanSaveNotice] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [internalNotes, setInternalNotes] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [sentReplies, setSentReplies] = useState<Record<string, string>>({});
  const [replyDraftIds, setReplyDraftIds] = useState<Record<string, string>>({});
  const [sendingReply, setSendingReply] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [contentLookup, setContentLookup] = useState<Map<string, { title: string; moduleName: string; moduleId: string; duration?: number }>>(new Map());
  const [checkinConfig, setCheckinConfig] = useState<CheckinFormConfig | null>(null);
  const [businessHealthConfig, setBusinessHealthConfig] = useState<QuestionnaireFormConfig | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");
  const [archiveSaving, setArchiveSaving] = useState(false);
  const [restoreSaving, setRestoreSaving] = useState(false);
  const [lifecycleError, setLifecycleError] = useState<string | null>(null);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [newClientPassword, setNewClientPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordResult, setPasswordResult] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [nudgeOpen, setNudgeOpen] = useState(false);
  const [nudgeMessage, setNudgeMessage] = useState("");
  const [nudgeSending, setNudgeSending] = useState(false);
  const [nudgeSent, setNudgeSent] = useState(false);

  const loadClient = useCallback(async () => {
    try {
      const [clientRes, trainingRes, configRes, businessHealthRes] = await Promise.all([
        fetch(`/api/admin/clients/${id}?fresh=${Date.now()}`, { cache: "no-store" }),
        fetch("/api/admin/training"),
        fetch("/api/admin/form-config?type=checkin"),
        fetch("/api/admin/form-config?type=business_health_checklist"),
      ]);

      if (clientRes.ok) {
        const data = await clientRes.json();
        setClient(data.client);
        setPlans(data.client?.business_plan || []);
        const activePlans = (data.client?.business_plan || []).filter((p: BusinessPlan) => p.status === "active");
        setExpandedPhases(new Set(activePlans.flatMap((plan: BusinessPlan) => plan.phases.map((ph: BusinessPlanPhase) => ph.id))));
        setInternalNotes(data.client?.internal_notes || "");
      }

      if (trainingRes.ok) {
        const tData = await trainingRes.json();
        const lookup = new Map<string, { title: string; moduleName: string; moduleId: string; duration?: number }>();
        for (const mod of tData.modules || []) {
          for (const c of mod.content || []) {
            lookup.set(c.id, { title: c.title, moduleName: mod.title, moduleId: mod.id, duration: c.duration_minutes });
          }
        }
        setContentLookup(lookup);
      }

      if (configRes.ok) {
        const cfgData = await configRes.json();
        setCheckinConfig(cfgData.config);
      }

      if (businessHealthRes.ok) {
        const cfgData = await businessHealthRes.json();
        setBusinessHealthConfig(cfgData.config);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadClient(); }, [loadClient]);
  // The Dashboard's "Plans to set up" links here with #plan; jump to the plan once it has loaded.
  useEffect(() => {
    if (loading || window.location.hash !== "#plan") return;
    // Sections above the plan finish loading after it, so settle the scroll a few times.
    const jump = () => document.getElementById("plan")?.scrollIntoView({ block: "start" });
    jump();
    const timers = [300, 800, 1600].map((ms) => window.setTimeout(jump, ms));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [loading]);

  async function handleReply(checkinId: string) {
    if (client?.archived_at) return;
    const text = replyTexts[checkinId];
    if (!text?.trim()) return;
    setSendingReply(checkinId);
    setReplyError(null);

    try {
      const res = await fetch("/api/admin/reply-checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkin_id: checkinId, reply_text: text, reply_draft_id: replyDraftIds[checkinId] }),
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

  if (loading) {
    return (
      <div className="ws ws-page">
        <div className="ws-cd-head">
          <span className="ws-skel" style={{ width: 40, height: 40, borderRadius: "50%" }} />
          <div>
            <span className="ws-skel" style={{ width: 200, height: 20 }} />
            <span className="ws-skel mt-2" style={{ width: 160, height: 12 }} />
          </div>
        </div>
        <div className="ws-strip">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="ws-stat" style={{ cursor: "default" }}>
              <span className="ws-skel" style={{ width: 80, height: 10 }} />
              <span className="ws-skel" style={{ width: 36, height: 20 }} />
            </div>
          ))}
        </div>
        <div className="ws-panel"><SkeletonRows count={6} /></div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="ws ws-page">
        <section className="ws-panel">
          <Empty icon="users" title="Client not found" text="This client may have been removed or you may not have access to the record." />
          <div className="flex justify-center pb-6">
            <Link href="/admin/clients" className="ws-btn ws-focus">Back to clients</Link>
          </div>
        </section>
      </div>
    );
  }


  const activePlans = plans.filter((p) => p.status === "active");
  const isArchived = Boolean(client.archived_at);
  const completedPlans = plans.filter((p) => p.status === "completed");
  const sc = statusConfig[client.status];
  const currentMetricsMonthStart = getCurrentMetricsMonthStart();
  const hasCurrentMonthMetrics = Boolean(
    client.monthly_metrics?.some((entry) => entry.month_start === currentMetricsMonthStart),
  );

  const allItems = activePlans.flatMap((plan) => plan.phases.flatMap((ph) => ph.items));
  const planTotal = allItems.length;
  const planDone = allItems.filter((p) => p.completed).length;
  const planPct = planTotal > 0 ? Math.round((planDone / planTotal) * 100) : 0;
  const selectedPlan = selectedPlanId ? plans.find((plan) => plan.id === selectedPlanId) : undefined;

  async function toggleItem(phaseId: string, itemId: string) {
    if (isArchived) return;
    // Optimistic update
    setPlans((prev) =>
      prev.map((plan) => {
        if (plan.status !== "active") return plan;
        return {
          ...plan,
          phases: plan.phases.map((phase) => {
            if (phase.id !== phaseId) return phase;
            return {
              ...phase,
              items: phase.items.map((item) =>
                item.id === itemId
                  ? { ...item, completed: !item.completed, completed_at: !item.completed ? new Date().toISOString() : undefined }
                  : item
              ),
            };
          }),
        };
      })
    );
    // Persist - rollback on failure
    const res = await fetch(`/api/admin/plan-items/${itemId}`, { method: "PATCH" });
    if (!res.ok) {
      // Reverse the optimistic update
      setPlans((prev) =>
        prev.map((plan) => {
          if (plan.status !== "active") return plan;
          return {
            ...plan,
            phases: plan.phases.map((phase) => {
              if (phase.id !== phaseId) return phase;
              return {
                ...phase,
                items: phase.items.map((item) =>
                  item.id === itemId
                    ? { ...item, completed: !item.completed, completed_at: !item.completed ? new Date().toISOString() : undefined }
                    : item
                ),
              };
            }),
          };
        })
      );
    }
  }

  function togglePhase(phaseId: string) {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phaseId)) next.delete(phaseId);
      else next.add(phaseId);
      return next;
    });
  }

  async function handleSavePlan(plan: BusinessPlan) {
    if (isArchived) return;
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

      const upsertSavedPlan = (currentPlans: BusinessPlan[]) => {
        const existingIndex = currentPlans.findIndex((currentPlan) => currentPlan.id === plan.id);
        if (existingIndex === -1) return [plan, ...currentPlans];

        return currentPlans.map((currentPlan) => (
          currentPlan.id === plan.id ? { ...currentPlan, ...plan } : currentPlan
        ));
      };

      setPlans(upsertSavedPlan);
      setClient((currentClient) => currentClient
        ? { ...currentClient, business_plan: upsertSavedPlan(currentClient.business_plan) }
        : currentClient
      );
      setPlanSaveNotice(`Saved ${data.itemCount ?? 0} action item${data.itemCount === 1 ? "" : "s"} across ${data.phaseCount ?? plan.phases.length} phase${data.phaseCount === 1 ? "" : "s"}.`);
      setSelectedPlanId(null);
      setBuilderMode("closed");
      await loadClient();
    } catch (err) {
      setPlanSaveError(err instanceof Error ? err.message : "Failed to save business plan");
    } finally {
      setPlanSaving(false);
    }
  }

  function handleNewPlan() {
    if (isArchived) return;
    setPlanSaveError(null);
    setSelectedPlanId(null);
    setBuilderMode("create");
  }

  function handleEditPlan(planId: string) {
    if (isArchived) return;
    setPlanSaveError(null);
    setSelectedPlanId(planId);
    setBuilderMode("edit");
  }

  async function handleCompletePlan(planId: string) {
    if (isArchived) return;
    setPlanSaveError(null);

    try {
      if (!confirm("Mark this business plan as complete?")) return;

      const res = await fetch("/api/admin/business-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete", plan_id: planId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to mark business plan as complete");
      }

      if (selectedPlanId === planId) {
        setSelectedPlanId(null);
      }

      await loadClient();
    } catch (err) {
      setPlanSaveError(err instanceof Error ? err.message : "Failed to mark business plan as complete");
    }
  }

  async function saveNotes() {
    if (!client || isArchived) return;
    setNotesSaving(true);
    await fetch(`/api/admin/internal-notes/${client.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: internalNotes }),
    });
    setNotesSaving(false);
  }

  // Week progress
  const totalWeeks = 12;
  const currentWeek = client.current_week;

  // Calculate alert context for red/amber clients
  const now = new Date();
  const lastActivityDays = Math.floor((now.getTime() - new Date((client.health?.last_active_at || client.last_login)).getTime()) / (1000 * 60 * 60 * 24));
  const lastCheckinDays = Math.floor((now.getTime() - new Date(client.last_checkin).getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className="ws ws-page">
      <Link href="/admin/clients" className="ws-back ws-focus">
        <Icon name="chevron" size={14} className="ws-back-ic" />
        Clients
      </Link>

      <div className="ws-ph">
        <div className="ws-cd-head">
          <span className="ws-avatar is-lg" aria-hidden="true">
            {initials(client.name)}
          </span>
          <div className="min-w-0">
            <h1 className="ws-title ws-cd-title">{client.name}</h1>
            <p className="ws-meta ws-cd-meta">{client.email}{client.phone ? ` · ${client.phone}` : ""}</p>
            {(client.business_name || client.business_type) && (
              <p className="ws-caption">{[client.business_name, client.business_type].filter(Boolean).join(" · ")}</p>
            )}
          </div>
        </div>
        <div className="ws-ph-acts">
          {isArchived ? <Chip>Archived</Chip> : <Chip tone={sc.tone}>{client.health?.label ?? sc.label}</Chip>}
          <a
            href={`/api/admin/clients/${client.id}/export`}
            className="ws-btn ws-focus"
          >
            Export record
          </a>
          {isArchived && (
            <button
              type="button"
              disabled={restoreSaving}
              onClick={async () => {
                setRestoreSaving(true);
                setLifecycleError(null);
                try {
                  const res = await fetch(`/api/admin/clients/${client.id}/restore`, { method: "POST" });
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok) throw new Error(data.error || "Failed to restore client");
                  await loadClient();
                } catch (error) {
                  setLifecycleError(error instanceof Error ? error.message : "Failed to restore client");
                } finally {
                  setRestoreSaving(false);
                }
              }}
              className="ws-btn ws-btn-primary ws-focus"
            >
              {restoreSaving ? "Restoring…" : "Restore access"}
            </button>
          )}
          {!isArchived && (
          <div className="ws-menu-wrap">
            <button
              type="button"
              onClick={() => setSettingsOpen(!settingsOpen)}
              className="ws-btn ws-btn-icon ws-focus"
              aria-label="Client settings"
              aria-expanded={settingsOpen}
            >
              <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            {settingsOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setSettingsOpen(false)} />
                <div className="ws-menu" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setSettingsOpen(false); setPasswordModalOpen(true); setNewClientPassword(""); setPasswordResult(null); }}
                    className="ws-menu-item"
                  >
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                    Set password
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setSettingsOpen(false); setArchiveModalOpen(true); setArchiveReason(""); setLifecycleError(null); }}
                    className="ws-menu-item is-bad"
                  >
                    <Icon name="alert" size={14} />
                    Archive client
                  </button>
                </div>
              </>
            )}
          </div>
          )}
        </div>
      </div>

      {isArchived && (
        <div className="ws-note is-attn" role="status">
          <Icon name="info" size={15} />
          <span>
            <b>Read-only archive.</b> Portal access is blocked and this client is excluded from reminders, broadcasts and active-client reporting. All historical records remain viewable and exportable.
            {client.archived_at && <span className="ws-caption block mt-1">Archived {new Date(client.archived_at).toLocaleString()}{client.archive_reason ? ` — ${client.archive_reason}` : ""}</span>}
          </span>
        </div>
      )}

      {lifecycleError && (
        <div className="ws-note is-bad" role="alert">
          <Icon name="alert" size={15} />
          <span>{lifecycleError}</span>
        </div>
      )}

      {planSaveNotice && (
        <div className="ws-note is-ok" role="status">
          <Icon name="checkCircle" size={15} />
          <span className="flex-1">{planSaveNotice}</span>
          <button type="button" onClick={() => setPlanSaveNotice(null)} className="ws-link">
            Dismiss
          </button>
        </div>
      )}

      {/* Archive Client Modal */}
      {archiveModalOpen && (
        <div className="ws-overlay">
          <div className="ws-overlay-bg" />
          <div className="ws-dialog" role="dialog" aria-modal="true" aria-label="Archive client">
            <div className="ws-dialog-head">
              <h3 className="ws-dialog-title">Archive client</h3>
            </div>
            <div className="ws-dialog-body">
              <p className="ws-meta">
                This blocks <b className="font-semibold" style={{ color: "var(--ws-ink)" }}>{client.name}</b> from signing in and removes them from active-client workflows. Their plans, activity and history will be retained for viewing or export, and access can be restored later.
              </p>
              <div>
                <label className="ws-label" htmlFor="archive-reason">Reason for archive</label>
                <textarea
                  id="archive-reason"
                  value={archiveReason}
                  onChange={(e) => setArchiveReason(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="e.g. Client agreement ended"
                  className="ws-input"
                />
              </div>
              <div className="ws-dialog-foot">
                <button
                  type="button"
                  onClick={() => { setArchiveModalOpen(false); setArchiveReason(""); }}
                  className="ws-btn ws-btn-quiet ws-focus"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!archiveReason.trim() || archiveSaving}
                  onClick={async () => {
                    setArchiveSaving(true);
                    setLifecycleError(null);
                    try {
                      const res = await fetch(`/api/admin/clients/${id}/archive`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ reason: archiveReason }),
                      });
                      if (res.ok) {
                        setArchiveModalOpen(false);
                        setArchiveReason("");
                        await loadClient();
                      } else {
                        const data = await res.json().catch(() => ({}));
                        throw new Error(data.error || "Failed to archive client");
                      }
                    } catch (error) {
                      setLifecycleError(error instanceof Error ? error.message : "Failed to archive client");
                    } finally {
                      setArchiveSaving(false);
                    }
                  }}
                  className="ws-btn ws-btn-danger ws-focus"
                >
                  {archiveSaving ? "Archiving…" : "Archive client"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Set Password Modal */}
      {passwordModalOpen && (
        <div className="ws-overlay">
          <div className="ws-overlay-bg" />
          <div className="ws-dialog" role="dialog" aria-modal="true" aria-label="Set password">
            <div className="ws-dialog-head">
              <div className="min-w-0">
                <h3 className="ws-dialog-title">Set password</h3>
                <p className="ws-caption mt-0.5">Set login password for {client.name}</p>
              </div>
            </div>

            {passwordResult?.type === "success" ? (
              <div className="ws-dialog-body">
                <div className="ws-note is-ok" role="status">
                  <Icon name="checkCircle" size={15} />
                  <span>Password set - client can log in now</span>
                </div>
                <div className="ws-dialog-foot">
                  <button
                    type="button"
                    onClick={() => setPasswordModalOpen(false)}
                    className="ws-btn ws-btn-primary ws-focus"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <div className="ws-dialog-body">
                {passwordResult?.type === "error" && (
                  <div className="ws-note is-bad" role="alert">
                    <Icon name="alert" size={15} />
                    <span>{passwordResult.text}</span>
                  </div>
                )}
                <div>
                  <label className="ws-label" htmlFor="client-new-password">New password</label>
                  <input
                    id="client-new-password"
                    type="password"
                    value={newClientPassword}
                    onChange={(e) => setNewClientPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    className="ws-input"
                  />
                </div>
                <div className="ws-dialog-foot">
                  <button
                    type="button"
                    onClick={() => setPasswordModalOpen(false)}
                    className="ws-btn ws-btn-quiet ws-focus"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={newClientPassword.length < 8 || passwordSaving}
                    onClick={async () => {
                      setPasswordSaving(true);
                      setPasswordResult(null);
                      try {
                        const res = await fetch("/api/admin/set-password", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ user_id: client.user_id, password: newClientPassword }),
                        });
                        const data = await res.json();
                        if (res.ok) {
                          setPasswordResult({ type: "success", text: "Password set" });
                        } else {
                          setPasswordResult({ type: "error", text: data.error || "Failed to set password" });
                        }
                      } catch {
                        setPasswordResult({ type: "error", text: "Something went wrong" });
                      } finally {
                        setPasswordSaving(false);
                      }
                    }}
                    className="ws-btn ws-btn-primary ws-focus"
                  >
                    {passwordSaving ? "Setting..." : "Set password"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Status alert banner */}
      {!isArchived && client.status === "red" && (
        <div className="ws-note is-bad ws-cd-alert">
          <Icon name="alert" size={15} />
          <span className="ws-cd-alert-text">
            <b>{client.health?.label ?? "Gone quiet"}.</b>{" "}
            {client.health?.reason ?? `Last activity was ${lastActivityDays} days ago.`} Consider reaching out directly to re-engage.
          </span>
          <button
            type="button"
            onClick={() => { setNudgeOpen(true); setNudgeSent(false); setNudgeMessage(`Hey ${client.name.split(" ")[0]}, just checking in - haven't seen you in the portal for a bit. Everything OK? Jump back in when you're ready, your plan is waiting.`); }}
            className="ws-btn ws-btn-sm ws-focus"
          >
            <Icon name="bell" size={13} />
            Send nudge
          </button>
        </div>
      )}

      {!isArchived && client.status === "amber" && (
        <div className="ws-note is-attn ws-cd-alert">
          <Icon name="info" size={15} />
          <span className="ws-cd-alert-text">
            <b>{client.health?.label ?? "Missed check-in"}.</b>{" "}
            {client.health?.reason ?? `Last check-in was ${lastCheckinDays} days ago.`} A quick nudge might help keep momentum.
          </span>
          <button
            type="button"
            onClick={() => { setNudgeOpen(true); setNudgeSent(false); setNudgeMessage(`Hey ${client.name.split(" ")[0]}, your weekly check-in is due. Takes 2 minutes - let me know how things are going.`); }}
            className="ws-btn ws-btn-sm ws-focus"
          >
            <Icon name="bell" size={13} />
            Send nudge
          </button>
        </div>
      )}

      <div className="ws-strip">
        <div className="ws-stat" style={{ cursor: "default" }}>
          <span className="ws-stat-l"><Icon name="calendar" size={14} />Current week</span>
          <span className="ws-stat-n">{currentWeek}</span>
          <span className="ws-stat-s">of {totalWeeks} weeks</span>
        </div>
        <div className="ws-stat" style={{ cursor: "default" }}>
          <span className="ws-stat-l"><Icon name="plan" size={14} />Plan progress</span>
          <span className="ws-stat-n">{planDone}/{planTotal}</span>
          <span className="ws-stat-s">{planPct}% complete</span>
        </div>
        <div className="ws-stat" style={{ cursor: "default" }}>
          <span className="ws-stat-l"><Icon name="checkCircle" size={14} />Check-ins</span>
          <span className="ws-stat-n">{client.checkins.length}</span>
          <span className="ws-stat-s">Last: {timeAgo(client.last_checkin)}</span>
        </div>
        <div className="ws-stat" style={{ cursor: "default" }}>
          <span className="ws-stat-l"><Icon name="clock" size={14} />Last active</span>
          <span className={`ws-stat-n ${
            new Date().getTime() - new Date((client.health?.last_active_at || client.last_login)).getTime() > 7 * 24 * 60 * 60 * 1000 ? "is-bad" : ""
          }`}>
            {timeAgo((client.health?.last_active_at || client.last_login))}
          </span>
          <span className="ws-stat-s">
            {new Date((client.health?.last_active_at || client.last_login)).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
          </span>
        </div>
      </div>

      <ClientSignals id={client.id} />

      {/* Week timeline */}
      <section className="ws-panel min-w-0" aria-label="Programme timeline">
        <div className="ws-panel-head">
          <h2 className="ws-h2">Programme timeline</h2>
          <span className="ws-caption">
            Started {new Date(client.start_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </span>
        </div>
        <div className="ws-wk">
          {Array.from({ length: totalWeeks }).map((_, i) => {
            const weekNum = i + 1;
            const isCurrent = weekNum === currentWeek;
            const isComplete = weekNum < currentWeek;
            return (
              <div
                key={i}
                className={`ws-wk-cell ${isCurrent ? "is-now" : isComplete ? "is-done" : ""}`}
                aria-current={isCurrent ? "step" : undefined}
              >
                {weekNum}
              </div>
            );
          })}
        </div>
      </section>

      {/* Goals */}
      {client.goals && (
        <section className="ws-panel min-w-0" aria-label="Goals">
          <div className="ws-panel-head">
            <h2 className="ws-h2">Goals</h2>
          </div>
          <p className="ws-prose ws-pad">{client.goals}</p>
        </section>
      )}

      <section className="ws-panel min-w-0" aria-label="Five key monthly metrics">
        <div className="ws-panel-head">
          <div className="min-w-0 mr-auto">
            <h2 className="ws-h2">Five key monthly metrics</h2>
            <p className="ws-caption">
              Submitted monthly by the client and charted over time so Marc can spot momentum or slippage quickly.
            </p>
          </div>
          <Chip tone={hasCurrentMonthMetrics ? "ok" : "attn"}>
            {hasCurrentMonthMetrics
              ? `${formatMetricsMonthLabel(currentMetricsMonthStart, { month: "long" })} submitted`
              : `${formatMetricsMonthLabel(currentMetricsMonthStart, { month: "long" })} pending`}
          </Chip>
        </div>

        <MonthlyMetricsOverview
          history={client.monthly_metrics || []}
          title=""
          subtitle=""
          emptyMessage="This client has not submitted any monthly metrics yet."
          framed={false}
        />
      </section>

      {/* Activity Timeline */}
      <ActivityTimeline client={client} />

      {/* Internal Notes */}
      <TogglePanel
        open={notesOpen}
        onToggle={() => setNotesOpen(!notesOpen)}
        title="Internal notes"
        meta={
          <>
            <span className="ws-caption">Private - never visible to the client</span>
            {internalNotes.trim() && !notesOpen && (
              <span className="ws-dot" style={{ color: "var(--ws-attn)" }} aria-label="Has notes" />
            )}
          </>
        }
      >
        <div className="ws-pad">
          <textarea
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            readOnly={isArchived}
            rows={4}
            placeholder="Add private notes about this client... e.g. follow-up items, context for next session, personal circumstances"
            className="ws-input"
          />
          <div className="flex items-center gap-2 mt-2">
            {!isArchived && <button
              type="button"
              onClick={saveNotes}
              disabled={notesSaving}
              className="ws-btn ws-btn-sm ws-focus"
            >
              {notesSaving ? "Saving..." : "Save notes"}
            </button>}
          </div>
        </div>
      </TogglePanel>

      <div className="ws-cd-cols">
        {/* Business Plan */}
        <div id="plan" className="scroll-mt-20 ws-stack">
          <div className="ws-cd-colhead">
            <div className="min-w-0">
              <h2 className="ws-cd-h">
                Business plan{activePlans.length !== 1 ? "s" : ""}
              </h2>
              {activePlans.length > 1 && (
                <p className="ws-caption">
                  {activePlans.length} active plans remain live until Marc marks one complete.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleNewPlan}
              disabled={isArchived}
              style={isArchived ? { display: "none" } : undefined}
              className="ws-btn ws-btn-primary ws-btn-sm ws-focus"
            >
              <Icon name="plus" size={13} />
              {activePlans.length > 0 ? "New plan" : "Create business plan"}
            </button>
          </div>

          {activePlans.length > 0 ? (
            <>
              <div className="ws-cd-summary">
                <div className="min-w-0">
                  <p className="ws-cd-summary-t">
                    {activePlans.length} active plan{activePlans.length !== 1 ? "s" : ""} in progress
                  </p>
                  <p className="ws-caption">
                    New plans now stay active alongside existing ones until one is marked complete.
                  </p>
                </div>
                <span className="ws-cd-summary-n">
                  <Bar pct={planPct} width={88} />
                  <span className="ws-caption">({planDone}/{planTotal} items)</span>
                </span>
              </div>

              {activePlans.map((plan, index) => {
                const planItems = plan.phases.flatMap((phase) => phase.items);
                const currentPlanDone = planItems.filter((item) => item.completed).length;
                const currentPlanTotal = planItems.length;
                const currentPlanPct = currentPlanTotal > 0 ? Math.round((currentPlanDone / currentPlanTotal) * 100) : 0;

                return (
                  <section key={plan.id} className="ws-panel min-w-0" aria-label={`Active plan${activePlans.length > 1 ? ` ${index + 1}` : ""}`}>
                    <div className="ws-panel-head ws-cd-plan-head">
                      <h3 className="ws-h2">
                        Active plan{activePlans.length > 1 ? ` ${index + 1}` : ""}
                      </h3>
                      <Chip tone="decide">Active</Chip>
                      <span className="ws-caption">
                        Created {longDate(plan.created_at)}
                      </span>
                      <span className="ws-cd-spacer" />
                      <span className="ws-cd-plan-acts">
                        <span className="ws-cd-prog">
                          <span className="ws-bar" style={{ width: 56, ...(currentPlanPct === 100 ? { "--c": "var(--ws-ok)" } : {}) } as CSSProperties}>
                            <i style={{ width: `${currentPlanPct}%` }} />
                          </span>
                          <span className="ws-pct">{currentPlanDone}/{currentPlanTotal}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleEditPlan(plan.id)}
                          disabled={isArchived}
                          style={isArchived ? { display: "none" } : undefined}
                          className="ws-btn ws-btn-sm ws-focus"
                        >
                          Edit plan
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCompletePlan(plan.id)}
                          disabled={isArchived}
                          style={isArchived ? { display: "none" } : undefined}
                          className="ws-btn ws-btn-sm ws-focus"
                        >
                          <Icon name="check" size={13} />
                          Mark complete
                        </button>
                      </span>
                    </div>
                    {plan.summary && <p className="ws-prose ws-pad">{plan.summary}</p>}

                    <div>
                      {plan.phases.map((phase) => {
                        const isExpanded = expandedPhases.has(phase.id);
                        const phaseDone = phase.items.filter((i) => i.completed).length;
                        const phaseTotal = phase.items.length;
                        const phasePct = phaseTotal > 0 ? Math.round((phaseDone / phaseTotal) * 100) : 0;

                        return (
                          <div key={phase.id}>
                            <button
                              type="button"
                              onClick={() => togglePhase(phase.id)}
                              aria-expanded={isExpanded}
                              className="ws-row ws-cd-phase ws-focus"
                            >
                              <StatusIcon tone={progressTone(phaseDone, phaseTotal)} />
                              <span className="min-w-0">
                                <span className="ws-row-title">{phase.name}</span>
                                <span className="ws-row-sub">{phaseDone}/{phaseTotal} completed</span>
                              </span>
                              <span className="ws-row-meta">
                                <Bar pct={phasePct} colour={phasePct === 100 ? "var(--ws-ok)" : undefined} width={56} />
                                <Icon name="chevron" size={14} className={`ws-chev ${isExpanded ? "is-open" : ""}`} />
                              </span>
                            </button>

                            {isExpanded && (
                              <div className="ws-cd-phase-body">
                                {phase.notes && (
                                  <p className="ws-cd-phase-note">{phase.notes}</p>
                                )}

                                {phase.items.map((item) => (
                                  <button
                                    type="button"
                                    key={item.id}
                                    onClick={() => toggleItem(phase.id, item.id)}
                                    disabled={isArchived}
                                    aria-pressed={item.completed}
                                    className={`ws-row ws-cd-item ws-focus ${item.completed ? "is-done" : ""}`}
                                  >
                                    <StatusIcon tone={item.completed ? "ok" : "open"} />
                                    <span className="ws-row-title">{item.title}</span>
                                    <span className="ws-row-time">
                                      {item.completed && item.completed_at ? shortDate(item.completed_at) : ""}
                                    </span>
                                  </button>
                                ))}

                                {phase.linked_trainings.length > 0 && (
                                  <div className="ws-cd-train-wrap">
                                    <div className="ws-cd-sub">Linked training</div>
                                    {phase.linked_trainings.map((contentId) => {
                                      const info = contentLookup.get(contentId);
                                      if (!info) return null;
                                      return (
                                        <Link
                                          key={contentId}
                                          href={`/admin/training/${info.moduleId}`}
                                          className="ws-cd-train ws-focus"
                                        >
                                          <Icon name="play" size={12} />
                                          <span className="min-w-0">
                                            <span className="ws-row-title">{info.title}</span>
                                            <span className="ws-row-sub">{info.moduleName}{info.duration ? ` - ${info.duration}m` : ""}</span>
                                          </span>
                                        </Link>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}

              {completedPlans.length > 0 && (
                <PreviousPlans
                  plans={completedPlans}
                  showHistory={showHistory}
                  onToggleHistory={() => setShowHistory(!showHistory)}
                  openPlanId={expandedHistoryPlan}
                  onTogglePlan={(planId) => setExpandedHistoryPlan(expandedHistoryPlan === planId ? null : planId)}
                />
              )}
            </>
          ) : (
            <>
              <section className="ws-panel min-w-0" aria-label="No active business plan">
                <div className="ws-empty">
                  <span className="ws-empty-glyph"><Icon name="plan" size={20} /></span>
                  <p className="ws-empty-h">No active business plan</p>
                  <p>No active business plan for this client.</p>
                  <button
                    type="button"
                    onClick={handleNewPlan}
                    disabled={isArchived}
                    style={isArchived ? { display: "none" } : undefined}
                    className="ws-btn ws-btn-primary ws-btn-sm ws-focus mt-3"
                  >
                    <Icon name="plus" size={13} />
                    Create business plan
                  </button>
                </div>
              </section>

              {/* Show history even when no active plan */}
              {completedPlans.length > 0 && (
                <PreviousPlans
                  plans={completedPlans}
                  showHistory={showHistory}
                  onToggleHistory={() => setShowHistory(!showHistory)}
                  openPlanId={expandedHistoryPlan}
                  onTogglePlan={(planId) => setExpandedHistoryPlan(expandedHistoryPlan === planId ? null : planId)}
                />
              )}
            </>
          )}
        </div>

        {/* Check-in History */}
        <div className="ws-stack">
          <div className="ws-cd-colhead">
            <h2 className="ws-cd-h">Check-in history</h2>
          </div>
          {client.checkins.length === 0 ? (
            <section className="ws-panel">
              <Empty icon="checkCircle" title="No check-ins yet" text="No check-ins submitted yet." />
            </section>
          ) : (
            client.checkins.map((c) => {
              const mc = moodConfig[c.mood] || moodConfig.struggling;
              return (
                <section key={c.id} className="ws-panel min-w-0" aria-label={`Week ${c.week_number} check-in`}>
                  <div className="ws-panel-head ws-cd-ck-head">
                    <h3 className="ws-h2">Week {c.week_number}</h3>
                    <Chip tone={mc.tone}>{moodText(c.mood)}</Chip>
                    <span className="ws-caption ml-auto">{timeAgo(c.created_at)}</span>
                  </div>

                  <div className="ws-pad ws-cd-ck">
                    {c.responses && checkinConfig ? (
                      /* Dynamic responses - render using config labels */
                      checkinConfig.questions.map((q: FormQuestion) => {
                        const answer = getQuestionAnswerLabel(q, c.responses);
                        if (!answer) return null;
                        return (
                          <div key={q.id}>
                            <div className="ws-field-l">{q.label}</div>
                            <p className="ws-prose">{answer}</p>
                          </div>
                        );
                      })
                    ) : (
                      /* Legacy format - backward compatibility */
                      <>
                        {c.wins && (
                          <div>
                            <div className="ws-field-l">Wins</div>
                            <p className="ws-prose">{c.wins}</p>
                          </div>
                        )}
                        {c.challenges && (
                          <div>
                            <div className="ws-field-l">Challenges</div>
                            <p className="ws-prose">{c.challenges}</p>
                          </div>
                        )}
                        {c.questions && (
                          <div>
                            <div className="ws-field-l">Questions</div>
                            <p className="ws-prose">{c.questions}</p>
                          </div>
                        )}
                      </>
                    )}

                    {c.admin_reply || sentReplies[c.id] ? (
                      <div className="ws-quote" style={{ "--c": "var(--ws-accent-ink)" } as CSSProperties}>
                        <div className="ws-quote-h">
                          Marc&apos;s reply
                          {sentReplies[c.id] && !c.admin_reply && <Chip tone="ok">Just sent</Chip>}
                        </div>
                        <p className="ws-prose">{sentReplies[c.id] || c.admin_reply}</p>
                      </div>
                    ) : !isArchived ? (
                      <div className="ws-cd-reply">
                        <div className="mb-2">
                          <ReplyDraftCard
                            scope={{ checkinId: c.id }}
                            onEdit={(text, draftId) => {
                              setReplyTexts((prev) => ({ ...prev, [c.id]: text }));
                              setReplyDraftIds((prev) => ({ ...prev, [c.id]: draftId }));
                            }}
                            onSent={(text) => setSentReplies((prev) => ({ ...prev, [c.id]: text }))}
                          />
                        </div>
                        <label className="ws-field-l" htmlFor={`reply-${c.id}`}>Reply to this check-in</label>
                        <textarea
                          id={`reply-${c.id}`}
                          value={replyTexts[c.id] || ""}
                          onChange={(e) => setReplyTexts((prev) => ({ ...prev, [c.id]: e.target.value }))}
                          rows={3}
                          placeholder="Type your reply..."
                          disabled={sendingReply === c.id}
                          className="ws-input"
                        />
                        {replyError && sendingReply === null && (
                          <div className="ws-caption mt-1" style={{ color: "var(--ws-bad)" }}>{replyError}</div>
                        )}
                        <div className="flex justify-end mt-2">
                          <button
                            type="button"
                            onClick={() => handleReply(c.id)}
                            disabled={!replyTexts[c.id]?.trim() || sendingReply === c.id}
                            className="ws-btn ws-btn-primary ws-btn-sm ws-focus"
                          >
                            {sendingReply === c.id ? (
                              <>
                                <Spinner />
                                Sending...
                              </>
                            ) : (
                              <>
                                <Icon name="send" size={13} />
                                Send reply
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ) : null}
                    {c.client_reply && (
                      <div className="ws-quote" style={{ "--c": "var(--ws-ok)" } as CSSProperties}>
                        <div className="ws-quote-h">
                          Client reply
                          {c.client_replied_at && (
                            <span className="ws-caption" style={{ fontWeight: 400 }}>
                              {shortDate(c.client_replied_at)}
                            </span>
                          )}
                        </div>
                        <p className="ws-prose">{c.client_reply}</p>
                      </div>
                    )}
                  </div>
                </section>
              );
            })
          )}
        </div>
      </div>

      <section className="ws-panel min-w-0" aria-label="Business and personal health checklist">
        <div className="ws-panel-head">
          <div className="min-w-0 mr-auto">
            <h2 className="ws-h2">Business and personal health checklist</h2>
            <p className="ws-caption">
              Initial onboarding questionnaire completed inside the portal.
            </p>
          </div>
          {client.business_health_checklist?.submitted_at ? (
            <Chip tone="ok">
              Submitted {new Date(client.business_health_checklist.submitted_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </Chip>
          ) : (
            <Chip tone="attn">
              Not submitted yet
            </Chip>
          )}
        </div>

        {client.business_health_checklist && businessHealthConfig ? (
          <div>
            {businessHealthConfig.questions.map((question) => {
              const answer = getQuestionAnswerLabel(question, client.business_health_checklist?.responses);
              if (!answer) return null;

              return (
                <div key={question.id} className="ws-cd-qa">
                  <div className="ws-field-l">{question.label}</div>
                  <p className="ws-prose">{answer}</p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="ws-meta ws-pad">
            The client has not completed this onboarding questionnaire yet.
          </p>
        )}
      </section>

      {/* Nudge Modal */}
      {nudgeOpen && !isArchived && (
        <div className="ws-overlay">
          <div className="ws-overlay-bg" />
          <div className="ws-dialog" role="dialog" aria-modal="true" aria-label={`Nudge ${client.name.split(" ")[0]}`}>
            <div className="ws-dialog-head">
              <div className="min-w-0">
                <h3 className="ws-dialog-title">Nudge {client.name.split(" ")[0]}</h3>
                <p className="ws-caption mt-0.5">Send a push notification to their device</p>
              </div>
            </div>

            <div className="ws-dialog-body">
              {nudgeSent ? (
                <div className="ws-note is-ok" role="status">
                  <Icon name="checkCircle" size={15} />
                  <span>Nudge sent</span>
                </div>
              ) : (
                <textarea
                  value={nudgeMessage}
                  onChange={(e) => setNudgeMessage(e.target.value)}
                  rows={4}
                  placeholder="Type your message..."
                  aria-label="Nudge message"
                  className="ws-input"
                />
              )}

              <div className="ws-dialog-foot">
                <button
                  type="button"
                  onClick={() => setNudgeOpen(false)}
                  className="ws-btn ws-btn-quiet ws-focus"
                >
                  {nudgeSent ? "Done" : "Cancel"}
                </button>
                {!nudgeSent && (
                  <button
                    type="button"
                    disabled={!nudgeMessage.trim() || nudgeSending}
                    onClick={async () => {
                      setNudgeSending(true);
                      try {
                        const res = await fetch("/api/push/send", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            userId: client.user_id,
                            title: "Marc Watters",
                            body: nudgeMessage,
                            url: "/portal",
                            tag: "nudge",
                          }),
                        });
                        const result = await res.json().catch(() => ({}));
                        if (res.ok && result.sent > 0) {
                          setNudgeSent(true);
                        } else {
                          alert("Push notification could not be delivered. Client may not have notifications enabled.");
                        }
                      } finally {
                        setNudgeSending(false);
                      }
                    }}
                    className="ws-btn ws-btn-primary ws-focus"
                  >
                    {nudgeSending ? (
                      <>
                        <Spinner />
                        Sending...
                      </>
                    ) : "Send nudge"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Business Plan Builder Modal */}
      {builderMode !== "closed" && !isArchived && (
        <BusinessPlanBuilder
          clientId={client.id}
          existingPlan={builderMode === "edit" ? selectedPlan : undefined}
          onSave={handleSavePlan}
          onPdfUploaded={loadClient}
          onCancel={() => {
            setPlanSaveError(null);
            setSelectedPlanId(null);
            setBuilderMode("closed");
          }}
          saving={planSaving}
          error={planSaveError}
        />
      )}
    </div>
  );
}

function PreviousPlans({
  plans,
  showHistory,
  onToggleHistory,
  openPlanId,
  onTogglePlan,
}: {
  plans: BusinessPlan[];
  showHistory: boolean;
  onToggleHistory: () => void;
  openPlanId: string | null;
  onTogglePlan: (planId: string) => void;
}) {
  return (
    <TogglePanel
      open={showHistory}
      onToggle={onToggleHistory}
      title="Previous plans"
      meta={<span className="ws-caption">{plans.length}</span>}
    >
      <div>
        {plans.map((plan) => {
          const prevItems = plan.phases.flatMap((ph) => ph.items);
          const prevDone = prevItems.filter((i) => i.completed).length;
          const prevTotal = prevItems.length;
          const isOpen = openPlanId === plan.id;

          return (
            <div key={plan.id}>
              <button
                type="button"
                onClick={() => onTogglePlan(plan.id)}
                aria-expanded={isOpen}
                className="ws-row ws-focus"
              >
                <StatusIcon tone="closed" />
                <span className="min-w-0">
                  <span className="ws-row-title">{longDate(plan.created_at)}</span>
                  <span className="ws-row-sub">
                    {prevDone}/{prevTotal} items completed across {plan.phases.length} phases
                    {plan.summary ? ` · ${plan.summary}` : ""}
                  </span>
                </span>
                <span className="ws-row-meta">
                  <Chip tone="ok">
                    Completed {plan.completed_at ? shortDate(plan.completed_at) : ""}
                  </Chip>
                  <Icon name="chevron" size={14} className={`ws-chev ${isOpen ? "is-open" : ""}`} />
                </span>
              </button>
              {isOpen && (
                <div className="ws-expand">
                  <div className="ws-expand-box ws-cd-prev">
                    {plan.summary && <p className="ws-caption" style={{ whiteSpace: "pre-line" }}>{plan.summary}</p>}
                    {plan.phases.map((phase) => {
                      const phDone = phase.items.filter((i) => i.completed).length;
                      const phTotal = phase.items.length;

                      return (
                        <div key={phase.id}>
                          <div className="ws-cd-prev-h">
                            <span>{phase.name}</span>
                            <span className="ws-caption">{phDone}/{phTotal}</span>
                          </div>
                          {phase.notes && (
                            <p className="ws-caption" style={{ whiteSpace: "pre-line" }}>{phase.notes}</p>
                          )}
                          {phase.items.map((item) => (
                            <div key={item.id} className={`ws-cd-prev-item ${item.completed ? "is-done" : ""}`}>
                              <StatusIcon tone={item.completed ? "ok" : "open"} size={12} />
                              <span>{item.title}</span>
                            </div>
                          ))}
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
    </TogglePanel>
  );
}

function ActivityTimeline({ client }: { client: AdminClient }) {
  const [expanded, setExpanded] = useState(true);

  // Build unified timeline from checkins, plan items, and modules
  interface TimelineEvent {
    type: "checkin" | "plan_item" | "module_started" | "module_completed" | "reply";
    date: string;
    title: string;
    detail?: string;
    color: string;
    icon: string;
  }

  const events: TimelineEvent[] = [];

  // Check-ins
  for (const c of client.checkins) {
    events.push({
      type: "checkin",
      date: c.created_at,
      title: `Submitted Week ${c.week_number} check-in`,
      detail: c.mood ? `Mood: ${c.mood}` : undefined,
      color: "var(--ws-ink-2)",
      icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
    });
    if (c.admin_reply && c.replied_at) {
      events.push({
        type: "reply",
        date: c.replied_at,
        title: `Marc replied to Week ${c.week_number} check-in`,
        color: "var(--ws-accent-ink)",
        icon: "M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6",
      });
    }
    if (c.client_reply && c.client_replied_at) {
      events.push({
        type: "reply",
        date: c.client_replied_at,
        title: `Client replied to Week ${c.week_number} check-in`,
        detail: c.client_reply,
        color: "var(--ws-ok)",
        icon: "M8 10h8M8 14h5m-9 5l3.5-3.5H18a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v12z",
      });
    }
  }

  if (client.business_health_checklist?.submitted_at) {
    events.push({
      type: "checkin",
      date: client.business_health_checklist.submitted_at,
      title: "Submitted Business & Personal Health Checklist",
      color: "var(--ws-accent-ink)",
      icon: "M7 8h10M7 12h6m-6 8h10a2 2 0 002-2V6a2 2 0 00-2-2H7a2 2 0 00-2 2v12a2 2 0 002 2z",
    });
  }

  // Business plan items completed
  const activePlans = client.business_plan?.filter((p) => p.status === "active") || [];
  for (const plan of activePlans) {
    for (const phase of plan.phases) {
      for (const item of phase.items) {
        if (item.completed && item.completed_at) {
          events.push({
            type: "plan_item",
            date: item.completed_at,
            title: `Completed: ${item.title}`,
            detail: phase.name,
            color: "var(--ws-ok)",
            icon: "M5 13l4 4L19 7",
          });
        }
      }
    }
  }

  // Sort newest first
  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (events.length === 0) return null;

  return (
    <TogglePanel
      open={expanded}
      onToggle={() => setExpanded(!expanded)}
      title="Activity timeline"
      meta={<span className="ws-caption">{events.length} events</span>}
    >
      <div className="ws-cd-acts">
        {events.slice(0, 15).map((event, i) => (
          <div key={i} className="ws-act">
            <span className="ws-act-ic" style={{ color: event.color }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={event.icon} />
              </svg>
            </span>
            <span className="ws-cd-act-t">
              <b>{event.title}</b>
              {event.detail && <span className="ws-cd-act-d">{event.detail}</span>}
            </span>
            <time dateTime={event.date}>{shortDate(event.date)}</time>
          </div>
        ))}
        {events.length > 15 && (
          <div className="ws-caption ws-cd-act-more">
            + {events.length - 15} more events
          </div>
        )}
      </div>
    </TogglePanel>
  );
}
