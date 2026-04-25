"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import MonthlyMetricsOverview from "@/components/shared/MonthlyMetricsOverview";
import type { AdminClient } from "@/lib/admin-data";
import type { TrafficLight, CheckInMood, BusinessPlan, BusinessPlanPhase, CheckinFormConfig, FormQuestion, QuestionnaireFormConfig } from "@/lib/types";
import { formatMetricsMonthLabel, getCurrentMetricsMonthStart } from "@/lib/monthly-metrics";
import BusinessPlanBuilder from "@/components/admin/BusinessPlanBuilder";
import { getQuestionAnswerLabel } from "@/lib/questionnaires";

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
  awful: { bgClass: "bg-red-500/10", textClass: "text-red-400" },
};

const categoryIcons: Record<string, string> = {
  "Financial Foundation": "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  "Pipeline & Sales": "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
  "Team & People": "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
  "Systems & Operations": "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  "Standards & Quality": "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
};

function getPhaseIcon(phaseName: string): string {
  const lower = phaseName.toLowerCase();
  if (lower.includes("financial") || lower.includes("pricing") || lower.includes("revenue")) return categoryIcons["Financial Foundation"];
  if (lower.includes("pipeline") || lower.includes("sales") || lower.includes("visibility") || lower.includes("growth")) return categoryIcons["Pipeline & Sales"];
  if (lower.includes("team") || lower.includes("hire") || lower.includes("people")) return categoryIcons["Team & People"];
  if (lower.includes("system") || lower.includes("operation") || lower.includes("quality") || lower.includes("standard")) return categoryIcons["Systems & Operations"];
  return categoryIcons["Standards & Quality"];
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
  const router = useRouter();
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
  const [notesOpen, setNotesOpen] = useState(false);
  const [internalNotes, setInternalNotes] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [sentReplies, setSentReplies] = useState<Record<string, string>>({});
  const [sendingReply, setSendingReply] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [contentLookup, setContentLookup] = useState<Map<string, { title: string; moduleName: string; moduleId: string; duration?: number }>>(new Map());
  const [checkinConfig, setCheckinConfig] = useState<CheckinFormConfig | null>(null);
  const [businessHealthConfig, setBusinessHealthConfig] = useState<QuestionnaireFormConfig | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [revokeModalOpen, setRevokeModalOpen] = useState(false);
  const [revokeConfirmText, setRevokeConfirmText] = useState("");
  const [revoking, setRevoking] = useState(false);
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
        fetch(`/api/admin/clients/${id}`),
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-text-muted text-sm">Loading client...</div>
      </div>
    );
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

  const activePlans = plans.filter((p) => p.status === "active");
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
    setPlanSaving(true);
    setPlanSaveError(null);

    try {
      const saveRes = await fetch("/api/admin/business-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      if (!saveRes.ok) {
        const data = await saveRes.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save business plan");
      }

      await loadClient();
      setSelectedPlanId(null);
      setBuilderMode("closed");
    } catch (err) {
      setPlanSaveError(err instanceof Error ? err.message : "Failed to save business plan");
    } finally {
      setPlanSaving(false);
    }
  }

  function handleNewPlan() {
    setPlanSaveError(null);
    setSelectedPlanId(null);
    setBuilderMode("create");
  }

  function handleEditPlan(planId: string) {
    setPlanSaveError(null);
    setSelectedPlanId(planId);
    setBuilderMode("edit");
  }

  async function handleCompletePlan(planId: string) {
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
    if (!client) return;
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
  const lastLoginDays = Math.floor((now.getTime() - new Date(client.last_login).getTime()) / (1000 * 60 * 60 * 24));
  const lastCheckinDays = Math.floor((now.getTime() - new Date(client.last_checkin).getTime()) / (1000 * 60 * 60 * 24));
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
      <div className={`bg-bg-card border rounded-2xl p-6 mb-6 transition-all duration-300 overflow-visible ${glowClass[client.status]}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold ${sc.bgClass} ${sc.textClass} border ${
              client.status === "red" ? "border-red-500/30" : client.status === "amber" ? "border-amber-500/30" : "border-emerald-500/30"
            }`}>
              {client.name.split(" ").map((n) => n[0]).join("")}
            </div>
            <div>
              <h1 className="text-2xl font-heading font-bold text-text-primary">{client.name}</h1>
              <p className="text-text-secondary text-sm">{client.email}{client.phone ? ` - ${client.phone}` : ""}</p>
              {(client.business_name || client.business_type) && (
                <p className="text-text-muted text-xs mt-0.5">{[client.business_name, client.business_type].filter(Boolean).join(" - ")}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${sc.bgClass} ${sc.textClass}`}>
              <span className={`w-2 h-2 rounded-full ${sc.dotClass}`} />
              {sc.label}
            </span>
            <div className="relative">
              <button
                onClick={() => setSettingsOpen(!settingsOpen)}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-secondary hover:bg-white/5 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              {settingsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setSettingsOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 bg-bg-card border border-[rgba(255,255,255,0.08)] rounded-xl shadow-xl py-1 min-w-[180px]">
                    <button
                      onClick={() => { setSettingsOpen(false); setPasswordModalOpen(true); setNewClientPassword(""); setPasswordResult(null); }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-text-secondary hover:bg-white/5 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                      Set Password
                    </button>
                    <button
                      onClick={() => { setSettingsOpen(false); setRevokeModalOpen(true); }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      Revoke Access
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Revoke Access Modal */}
      {revokeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-bg-card border border-[rgba(255,255,255,0.08)] rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-heading font-bold text-text-primary">Revoke Client Access</h3>
            </div>
            <p className="text-sm text-text-secondary mb-4 leading-relaxed">
              This will permanently remove <span className="text-text-primary font-semibold">{client.name}</span> and all their data (business plans, check-ins, training progress). This cannot be undone.
            </p>
            <input
              type="text"
              value={revokeConfirmText}
              onChange={(e) => setRevokeConfirmText(e.target.value)}
              placeholder='Type "confirm" to proceed'
              className="w-full px-4 py-2.5 bg-bg-primary border border-[rgba(255,255,255,0.08)] rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-red-500/50 mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setRevokeModalOpen(false); setRevokeConfirmText(""); }}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-text-secondary bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={revokeConfirmText !== "confirm" || revoking}
                onClick={async () => {
                  setRevoking(true);
                  try {
                    const res = await fetch(`/api/admin/clients/${id}`, {
                      method: "DELETE",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ user_id: client.user_id }),
                    });
                    if (res.ok) {
                      router.push("/admin/clients");
                    } else {
                      const data = await res.json().catch(() => ({}));
                      alert(data.error || "Failed to revoke access");
                    }
                  } finally {
                    setRevoking(false);
                  }
                }}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {revoking ? "Revoking..." : "Revoke Access"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Set Password Modal */}
      {passwordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-bg-card border border-[rgba(255,255,255,0.08)] rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-accent-bright" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-heading font-bold text-text-primary">Set Password</h3>
                <p className="text-xs text-text-muted">Set login password for {client.name}</p>
              </div>
            </div>

            {passwordResult?.type === "success" ? (
              <>
                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 mb-4">
                  <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-emerald-400 font-medium">Password set - client can log in now</span>
                </div>
                <button
                  onClick={() => setPasswordModalOpen(false)}
                  className="w-full px-4 py-2.5 text-sm font-semibold text-white gradient-accent rounded-xl cursor-pointer"
                >
                  Done
                </button>
              </>
            ) : (
              <>
                {passwordResult?.type === "error" && (
                  <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4">
                    <span className="text-sm text-red-400">{passwordResult.text}</span>
                  </div>
                )}
                <div className="mb-4">
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">New Password</label>
                  <input
                    type="password"
                    value={newClientPassword}
                    onChange={(e) => setNewClientPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    className="w-full bg-bg-primary border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/50"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setPasswordModalOpen(false)}
                    className="flex-1 px-4 py-2.5 text-sm font-medium text-text-secondary bg-white/5 hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
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
                    className="flex-1 px-4 py-2.5 text-sm font-semibold text-white gradient-accent rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {passwordSaving ? "Setting..." : "Set Password"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Status alert banner */}
      {client.status === "red" && (
        <div className="bg-red-500/[0.06] border border-red-500/20 rounded-2xl px-5 py-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="flex-1">
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
          <button
            onClick={() => { setNudgeOpen(true); setNudgeSent(false); setNudgeMessage(`Hey ${client.name.split(" ")[0]}, just checking in - haven't seen you in the portal for a bit. Everything OK? Jump back in when you're ready, your plan is waiting.`); }}
            className="mt-3 ml-11 px-4 py-2 text-xs font-semibold text-white gradient-accent rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            Send Nudge
          </button>
        </div>
      )}

      {client.status === "amber" && (
        <div className="bg-amber-500/[0.06] border border-amber-500/20 rounded-2xl px-5 py-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
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
          <button
            onClick={() => { setNudgeOpen(true); setNudgeSent(false); setNudgeMessage(`Hey ${client.name.split(" ")[0]}, your weekly check-in is due. Takes 2 minutes - let me know how things are going.`); }}
            className="mt-3 ml-11 px-4 py-2 text-xs font-semibold text-white gradient-accent rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            Send Nudge
          </button>
        </div>
      )}

      {/* Stat cards row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-[rgba(255,255,255,0.07)] border border-[rgba(255,255,255,0.1)] rounded-2xl p-5">
          <div className="text-white/70 text-sm font-semibold uppercase tracking-wider mb-2">Current Week</div>
          <div className="text-3xl font-heading font-bold text-white">{currentWeek}</div>
          <div className="text-white/60 text-sm font-medium">of {totalWeeks} weeks</div>
        </div>
        <div className="bg-[rgba(255,255,255,0.07)] border border-[rgba(255,255,255,0.1)] rounded-2xl p-5">
          <div className="text-white/70 text-sm font-semibold uppercase tracking-wider mb-2">Plan Progress</div>
          <div className="text-3xl font-heading font-bold text-white">{planDone}/{planTotal}</div>
          <div className="text-white/60 text-sm font-medium">{planPct}% complete</div>
        </div>
        <div className="bg-[rgba(255,255,255,0.07)] border border-[rgba(255,255,255,0.1)] rounded-2xl p-5">
          <div className="text-white/70 text-sm font-semibold uppercase tracking-wider mb-2">Check-Ins</div>
          <div className="text-3xl font-heading font-bold text-white">{client.checkins.length}</div>
          <div className="text-white/60 text-sm font-medium">Last: {timeAgo(client.last_checkin)}</div>
        </div>
        <div className="bg-[rgba(255,255,255,0.07)] border border-[rgba(255,255,255,0.1)] rounded-2xl p-5">
          <div className="text-white/70 text-sm font-semibold uppercase tracking-wider mb-2">Last Login</div>
          <div className={`text-3xl font-heading font-bold ${
            new Date().getTime() - new Date(client.last_login).getTime() > 7 * 24 * 60 * 60 * 1000 ? "text-red-400" : "text-white"
          }`}>
            {timeAgo(client.last_login)}
          </div>
          <div className="text-white/60 text-sm font-medium">
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

      <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(255,255,255,0.04)] rounded-2xl p-5 mb-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-heading font-bold text-text-primary">Five Key Monthly Metrics</h2>
            <p className="text-xs text-text-muted mt-1">
              Submitted monthly by the client and charted over time so Marc can spot momentum or slippage quickly.
            </p>
          </div>
          <span
            className={`text-[11px] rounded-full px-3 py-1 ${
              hasCurrentMonthMetrics
                ? "text-emerald-300 bg-emerald-500/10 border border-emerald-500/20"
                : "text-amber-300 bg-amber-500/10 border border-amber-500/20"
            }`}
          >
            {hasCurrentMonthMetrics
              ? `${formatMetricsMonthLabel(currentMetricsMonthStart, { month: "long" })} submitted`
              : `${formatMetricsMonthLabel(currentMetricsMonthStart, { month: "long" })} pending`}
          </span>
        </div>

        <div className="mt-5">
          <MonthlyMetricsOverview
            history={client.monthly_metrics || []}
            title=""
            subtitle=""
            emptyMessage="This client has not submitted any monthly metrics yet."
          />
        </div>
      </div>

      {/* Activity Timeline */}
      <ActivityTimeline client={client} />

      {/* Internal Notes */}
      <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(255,255,255,0.04)] rounded-2xl mb-6 overflow-hidden">
        <button
          onClick={() => setNotesOpen(!notesOpen)}
          className="w-full flex items-center justify-between p-5 hover:bg-[rgba(255,255,255,0.02)] transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div className="text-left">
              <h2 className="text-sm font-heading font-bold text-text-primary">Internal Notes</h2>
              <p className="text-[10px] text-text-muted">Private - never visible to the client</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {internalNotes.trim() && !notesOpen && (
              <span className="w-2 h-2 rounded-full bg-amber-400" />
            )}
            <svg
              className={`w-4 h-4 text-text-muted transition-transform duration-200 ${notesOpen ? "rotate-180" : ""}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>
        {notesOpen && (
          <div className="px-5 pb-5 border-t border-[rgba(255,255,255,0.03)]">
            <textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              rows={4}
              placeholder="Add private notes about this client... e.g. follow-up items, context for next session, personal circumstances"
              className="w-full mt-3 bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors resize-y"
            />
            <div className="flex items-center gap-2 mt-1.5">
              <button
                onClick={saveNotes}
                disabled={notesSaving}
                className="text-[10px] font-medium text-accent-bright hover:text-accent-light transition-colors disabled:opacity-50"
              >
                {notesSaving ? "Saving..." : "Save Notes"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-[1.3fr_1fr] gap-6">
        {/* Business Plan */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-heading font-bold text-text-primary">
                Business Plan{activePlans.length !== 1 ? "s" : ""}
              </h2>
              {activePlans.length > 1 && (
                <p className="text-xs text-text-muted mt-1">
                  {activePlans.length} active plans remain live until Marc marks one complete.
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleNewPlan}
                className="px-3 py-1.5 text-xs font-semibold text-white gradient-accent rounded-lg inline-flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {activePlans.length > 0 ? "New Plan" : "Create Business Plan"}
              </button>
            </div>
          </div>

          {activePlans.length > 0 ? (
            <>
              <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(255,255,255,0.04)] rounded-2xl p-4 mb-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-text-primary text-sm font-semibold">
                      {activePlans.length} active plan{activePlans.length !== 1 ? "s" : ""} in progress
                    </p>
                    <p className="text-text-muted text-xs mt-1">
                      New plans now stay active alongside existing ones until one is marked complete.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 bg-[rgba(255,255,255,0.03)] rounded-full overflow-hidden">
                      <div
                        className="h-full gradient-accent rounded-full transition-all duration-500"
                        style={{ width: `${planPct}%` }}
                      />
                    </div>
                    <span className="text-xs text-accent-bright font-semibold">{planPct}%</span>
                    <span className="text-[10px] text-text-muted">({planDone}/{planTotal} items)</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {activePlans.map((plan, index) => {
                  const planItems = plan.phases.flatMap((phase) => phase.items);
                  const currentPlanDone = planItems.filter((item) => item.completed).length;
                  const currentPlanTotal = planItems.length;
                  const currentPlanPct = currentPlanTotal > 0 ? Math.round((currentPlanDone / currentPlanTotal) * 100) : 0;

                  return (
                    <div key={plan.id} className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(255,255,255,0.04)] rounded-2xl overflow-hidden">
                      <div className="p-4 border-b border-[rgba(255,255,255,0.03)]">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-text-primary">
                                Active Plan{activePlans.length > 1 ? ` ${index + 1}` : ""}
                              </span>
                              <span className="text-[10px] px-2 py-0.5 bg-accent/10 text-accent-bright rounded-full font-semibold border border-accent/20">
                                Active
                              </span>
                              <span className="text-[10px] text-text-muted">
                                Created {new Date(plan.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                              </span>
                            </div>
                            <p className="text-text-secondary text-sm leading-relaxed mt-2 whitespace-pre-line">{plan.summary}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                            <div className="flex items-center gap-2 mr-1">
                              <div className="h-1.5 w-16 bg-[rgba(255,255,255,0.03)] rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${currentPlanPct === 100 ? "bg-emerald-500" : "gradient-accent"}`}
                                  style={{ width: `${currentPlanPct}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-text-muted">{currentPlanDone}/{currentPlanTotal}</span>
                            </div>
                            <button
                              onClick={() => handleEditPlan(plan.id)}
                              className="px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary border border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.15)] rounded-lg transition-colors inline-flex items-center gap-1.5"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Edit Plan
                            </button>
                            <button
                              onClick={() => handleCompletePlan(plan.id)}
                              className="px-3 py-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 border border-emerald-500/20 hover:border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 rounded-lg transition-colors inline-flex items-center gap-1.5"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Mark Complete
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3 p-4">
                        {plan.phases.map((phase) => {
                          const isExpanded = expandedPhases.has(phase.id);
                          const phaseDone = phase.items.filter((i) => i.completed).length;
                          const phaseTotal = phase.items.length;
                          const phasePct = phaseTotal > 0 ? Math.round((phaseDone / phaseTotal) * 100) : 0;
                          const iconPath = getPhaseIcon(phase.name);

                          return (
                            <div key={phase.id} className="bg-bg-primary/40 border border-[rgba(255,255,255,0.04)] rounded-2xl overflow-hidden">
                              <button
                                onClick={() => togglePhase(phase.id)}
                                className="w-full flex items-center justify-between p-4 hover:bg-[rgba(255,255,255,0.02)] transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                                    <svg className="w-4 h-4 text-accent-bright" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={iconPath} />
                                    </svg>
                                  </div>
                                  <div className="text-left">
                                    <div className="text-sm font-semibold text-text-primary">{phase.name}</div>
                                    <div className="text-xs text-text-muted">{phaseDone}/{phaseTotal} completed</div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center gap-2">
                                    <div className="h-1.5 w-16 bg-[rgba(255,255,255,0.03)] rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full transition-all duration-300 ${phasePct === 100 ? "bg-emerald-500" : "gradient-accent"}`}
                                        style={{ width: `${phasePct}%` }}
                                      />
                                    </div>
                                    <span className="text-[10px] text-text-muted w-8 text-right">{phasePct}%</span>
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
                                  {phase.notes && (
                                    <div className="py-3 border-b border-[rgba(255,255,255,0.03)] mb-1">
                                      <p className="text-xs text-text-muted leading-relaxed italic whitespace-pre-line">{phase.notes}</p>
                                    </div>
                                  )}

                                  {phase.items.map((item) => (
                                    <button
                                      key={item.id}
                                      onClick={() => toggleItem(phase.id, item.id)}
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

                                  {phase.linked_trainings.length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-[rgba(255,255,255,0.03)]">
                                      <div className="text-[10px] text-text-muted font-semibold uppercase tracking-wider mb-2 px-2">Linked Training</div>
                                      <div className="space-y-1">
                                        {phase.linked_trainings.map((contentId) => {
                                          const info = contentLookup.get(contentId);
                                          if (!info) return null;
                                          return (
                                            <Link
                                              key={contentId}
                                              href={`/admin/training/${info.moduleId}`}
                                              className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-accent/5 transition-colors no-underline group"
                                            >
                                              <div className="w-5 h-5 rounded bg-accent/10 flex items-center justify-center flex-shrink-0">
                                                <svg className="w-3 h-3 text-accent-bright" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                              </div>
                                              <div className="min-w-0">
                                                <div className="text-xs text-text-secondary group-hover:text-text-primary transition-colors truncate">{info.title}</div>
                                                <div className="text-[10px] text-text-muted">{info.moduleName}{info.duration ? ` - ${info.duration}m` : ""}</div>
                                              </div>
                                            </Link>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {completedPlans.length > 0 && (
                <div className="mt-4">
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="flex items-center gap-2 text-xs text-text-muted hover:text-text-secondary transition-colors mb-2"
                  >
                    <svg
                      className={`w-3.5 h-3.5 transition-transform ${showHistory ? "rotate-180" : ""}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    Previous Plans ({completedPlans.length})
                  </button>

                  {showHistory && (
                    <div className="space-y-3">
                      {completedPlans.map((plan) => {
                        const prevItems = plan.phases.flatMap((ph) => ph.items);
                        const prevDone = prevItems.filter((i) => i.completed).length;
                        const prevTotal = prevItems.length;
                        const isOpen = expandedHistoryPlan === plan.id;

                        return (
                          <div key={plan.id} className="bg-bg-card/40 border border-[rgba(255,255,255,0.03)] rounded-2xl overflow-hidden">
                            <button
                              onClick={() => setExpandedHistoryPlan(isOpen ? null : plan.id)}
                              className="w-full p-4 text-left hover:bg-[rgba(255,255,255,0.02)] transition-colors"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-text-muted">
                                  {new Date(plan.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-full font-semibold">
                                    Completed {plan.completed_at ? new Date(plan.completed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : ""}
                                  </span>
                                  <svg
                                    className={`w-3.5 h-3.5 text-text-muted transition-transform ${isOpen ? "rotate-180" : ""}`}
                                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </div>
                              </div>
                              <p className="text-xs text-text-muted leading-relaxed mb-1 whitespace-pre-line">{plan.summary}</p>
                              <div className="text-[10px] text-text-muted">
                                {prevDone}/{prevTotal} items completed across {plan.phases.length} phases
                              </div>
                            </button>
                            {isOpen && (
                              <div className="border-t border-[rgba(255,255,255,0.03)] px-4 pb-4 space-y-3 pt-3">
                                {plan.phases.map((phase) => {
                                  const phDone = phase.items.filter((i) => i.completed).length;
                                  const phTotal = phase.items.length;

                                  return (
                                    <div key={phase.id}>
                                      <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-xs font-semibold text-text-secondary">{phase.name}</span>
                                        <span className="text-[10px] text-text-muted">{phDone}/{phTotal}</span>
                                      </div>
                                      {phase.notes && (
                                        <p className="text-[11px] text-text-muted italic mb-1.5 whitespace-pre-line">{phase.notes}</p>
                                      )}
                                      {phase.items.map((item) => (
                                        <div key={item.id} className="flex items-center gap-2 py-1 px-1">
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
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(255,255,255,0.04)] rounded-2xl p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-accent-bright" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-sm text-text-muted mb-4">No active business plan for this client.</p>
              <button
                onClick={handleNewPlan}
                className="px-4 py-2 text-xs font-semibold text-white gradient-accent rounded-lg inline-flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Business Plan
              </button>

              {/* Show history even when no active plan */}
              {completedPlans.length > 0 && (
                <div className="mt-6 text-left">
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="flex items-center gap-2 text-xs text-text-muted hover:text-text-secondary transition-colors mb-2"
                  >
                    <svg
                      className={`w-3.5 h-3.5 transition-transform ${showHistory ? "rotate-180" : ""}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    Previous Plans ({completedPlans.length})
                  </button>
                  {showHistory && completedPlans.map((plan) => {
                    const prevItems = plan.phases.flatMap((ph) => ph.items);
                    const prevDone = prevItems.filter((i) => i.completed).length;
                    const prevTotal = prevItems.length;
                    const isOpen = expandedHistoryPlan === plan.id;
                    return (
                      <div key={plan.id} className="bg-bg-card/40 border border-[rgba(255,255,255,0.03)] rounded-2xl overflow-hidden mt-2">
                        <button
                          onClick={() => setExpandedHistoryPlan(isOpen ? null : plan.id)}
                          className="w-full p-4 text-left hover:bg-[rgba(255,255,255,0.02)] transition-colors"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-text-muted">
                              {new Date(plan.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-full font-semibold">
                                Completed {plan.completed_at ? new Date(plan.completed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : ""}
                              </span>
                              <svg
                                className={`w-3.5 h-3.5 text-text-muted transition-transform ${isOpen ? "rotate-180" : ""}`}
                                fill="none" stroke="currentColor" viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>
                          <p className="text-xs text-text-muted leading-relaxed mb-1 whitespace-pre-line">{plan.summary}</p>
                          <div className="text-[10px] text-text-muted">
                            {prevDone}/{prevTotal} items completed across {plan.phases.length} phases
                          </div>
                        </button>
                        {isOpen && (
                          <div className="border-t border-[rgba(255,255,255,0.03)] px-4 pb-4 space-y-3 pt-3">
                            {plan.phases.map((phase) => {
                              const phDone = phase.items.filter((i) => i.completed).length;
                              const phTotal = phase.items.length;
                              return (
                                <div key={phase.id}>
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-xs font-semibold text-text-secondary">{phase.name}</span>
                                    <span className="text-[10px] text-text-muted">{phDone}/{phTotal}</span>
                                  </div>
                                  {phase.notes && (
                                    <p className="text-[11px] text-text-muted italic mb-1.5 whitespace-pre-line">{phase.notes}</p>
                                  )}
                                  {phase.items.map((item) => (
                                    <div key={item.id} className="flex items-center gap-2 py-1 px-1">
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
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
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
              {client.checkins.map((c) => {
                const mc = moodConfig[c.mood] || moodConfig.struggling;
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

                    {c.responses && checkinConfig ? (
                      /* Dynamic responses - render using config labels */
                      checkinConfig.questions.map((q: FormQuestion) => {
                        const answer = getQuestionAnswerLabel(q, c.responses);
                        if (!answer) return null;
                        return (
                          <div key={q.id} className="mb-2">
                            <span className="text-[10px] text-text-muted font-semibold uppercase tracking-wider">{q.label}</span>
                            <p className="text-xs text-text-secondary mt-0.5 leading-relaxed whitespace-pre-line">{answer}</p>
                          </div>
                        );
                      })
                    ) : (
                      /* Legacy format - backward compatibility */
                      <>
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
                      </>
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
                    {c.client_reply && (
                      <div className="mt-3 pl-3 border-l-2 border-emerald-500/30 bg-emerald-500/5 rounded-r-lg py-2 pr-3">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">
                            Client Reply
                          </div>
                          {c.client_replied_at && (
                            <span className="text-[10px] text-text-muted">
                              {new Date(c.client_replied_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">{c.client_reply}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(255,255,255,0.04)] rounded-2xl p-5 mt-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-heading font-bold text-text-primary">Business & Personal Health Checklist</h2>
            <p className="text-xs text-text-muted mt-1">
              Initial onboarding questionnaire completed inside the portal.
            </p>
          </div>
          {client.business_health_checklist?.submitted_at ? (
            <span className="text-[11px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1">
              Submitted {new Date(client.business_health_checklist.submitted_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          ) : (
            <span className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1">
              Not submitted yet
            </span>
          )}
        </div>

        {client.business_health_checklist && businessHealthConfig ? (
          <div className="mt-5 space-y-5">
            {businessHealthConfig.questions.map((question) => {
              const answer = getQuestionAnswerLabel(question, client.business_health_checklist?.responses);
              if (!answer) return null;

              return (
                <div key={question.id} className="rounded-xl border border-[rgba(255,255,255,0.04)] bg-bg-primary/60 px-4 py-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{question.label}</div>
                  <p className="mt-1 text-sm leading-relaxed text-text-secondary whitespace-pre-line">{answer}</p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-4 text-sm text-text-secondary">
            The client has not completed this onboarding questionnaire yet.
          </p>
        )}
      </div>

      {/* Nudge Modal */}
      {nudgeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-bg-card border border-[rgba(255,255,255,0.08)] rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-accent-bright" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-heading font-bold text-text-primary">Nudge {client.name.split(" ")[0]}</h3>
                <p className="text-xs text-text-muted">Send a push notification to their device</p>
              </div>
            </div>

            {nudgeSent ? (
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 mb-4">
                <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm text-emerald-400 font-medium">Nudge sent</span>
              </div>
            ) : (
              <textarea
                value={nudgeMessage}
                onChange={(e) => setNudgeMessage(e.target.value)}
                rows={4}
                placeholder="Type your message..."
                className="w-full bg-bg-primary border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/50 mb-4 resize-none"
              />
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setNudgeOpen(false)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-text-secondary bg-white/5 hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              >
                {nudgeSent ? "Done" : "Cancel"}
              </button>
              {!nudgeSent && (
                <button
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
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-white gradient-accent rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  {nudgeSending ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Sending...
                    </>
                  ) : "Send Nudge"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Business Plan Builder Modal */}
      {builderMode !== "closed" && (
        <BusinessPlanBuilder
          clientId={client.id}
          existingPlan={builderMode === "edit" ? selectedPlan : undefined}
          onSave={handleSavePlan}
          onCancel={() => {
            setPlanSaveError(null);
            setSelectedPlanId(null);
            setBuilderMode("closed");
          }}
          saving={planSaving}
          error={planSaveError}
        />
      )}
    </>
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
      color: "text-blue-400",
      icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
    });
    if (c.admin_reply && c.replied_at) {
      events.push({
        type: "reply",
        date: c.replied_at,
        title: `Marc replied to Week ${c.week_number} check-in`,
        color: "text-accent-bright",
        icon: "M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6",
      });
    }
    if (c.client_reply && c.client_replied_at) {
      events.push({
        type: "reply",
        date: c.client_replied_at,
        title: `Client replied to Week ${c.week_number} check-in`,
        detail: c.client_reply,
        color: "text-emerald-400",
        icon: "M8 10h8M8 14h5m-9 5l3.5-3.5H18a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v12z",
      });
    }
  }

  if (client.business_health_checklist?.submitted_at) {
    events.push({
      type: "checkin",
      date: client.business_health_checklist.submitted_at,
      title: "Submitted Business & Personal Health Checklist",
      color: "text-accent-bright",
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
            color: "text-emerald-400",
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
    <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(255,255,255,0.04)] rounded-2xl mb-6 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-5 hover:bg-[rgba(255,255,255,0.02)] transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
            <svg className="w-4 h-4 text-accent-bright" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-left">
            <h2 className="text-sm font-heading font-bold text-text-primary">Activity Timeline</h2>
            <p className="text-[10px] text-text-muted">{events.length} events</p>
          </div>
        </div>
        <svg className={`w-4 h-4 text-text-muted transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-5 pb-5">
          <div className="relative border-l border-[rgba(255,255,255,0.06)] ml-4 space-y-0">
            {events.slice(0, 15).map((event, i) => (
              <div key={i} className="relative pl-6 pb-4 last:pb-0">
                <div className={`absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full border-2 border-bg-card ${
                  event.type === "checkin" ? "bg-blue-400" :
                  event.type === "reply" ? "bg-accent" :
                  event.type === "plan_item" ? "bg-emerald-400" :
                  "bg-purple-400"
                }`} />
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <svg className={`w-3.5 h-3.5 flex-shrink-0 ${event.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={event.icon} />
                    </svg>
                    <div className="min-w-0">
                      <span className="text-xs text-text-primary">{event.title}</span>
                      {event.detail && <span className="text-[10px] text-text-muted ml-2">{event.detail}</span>}
                    </div>
                  </div>
                  <span className="text-[10px] text-text-muted whitespace-nowrap flex-shrink-0">
                    {new Date(event.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </span>
                </div>
              </div>
            ))}
            {events.length > 15 && (
              <div className="pl-6 pt-2 text-[10px] text-text-muted">
                + {events.length - 15} more events
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
