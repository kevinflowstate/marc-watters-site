"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import GrowthEngineDataSetup from "@/components/growth-engine/GrowthEngineDataSetup";
import GrowthEngineFiles from "@/components/growth-engine/GrowthEngineFiles";
import ReportView from "@/components/growth-engine/ReportView";
import { EmptyState, InlineNotice, PageSkeleton } from "@/components/ui/PortalState";
import { useToast } from "@/components/ui/Toast";
import type {
  GrowthAdminClient,
  GrowthAutomationCapabilities,
  GrowthClientsResponse,
} from "@/lib/growth-engine-admin";
import type { GrowthMetric, GrowthMilestone, GrowthReport } from "@/lib/growth-engine";

type WorkspaceTab = "overview" | "strategy" | "reports" | "milestones" | "files" | "data";

interface ReportForm {
  id: string | null;
  status: "draft" | "published" | "withdrawn";
  title: string;
  periodStart: string;
  periodEnd: string;
  executiveSummary: string;
  strategicTakeaway: string;
  progressUpdate: string;
  nextPriorities: string;
  metrics: GrowthMetric[];
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  workspaceId: string;
  generationSource: string;
}

const tabs: Array<{ id: WorkspaceTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "strategy", label: "Strategy" },
  { id: "reports", label: "Reports" },
  { id: "milestones", label: "Milestones" },
  { id: "files", label: "Files" },
  { id: "data", label: "Data & automation" },
];

function emptyReport(): ReportForm {
  return {
    id: null,
    status: "draft",
    title: "",
    periodStart: "",
    periodEnd: "",
    executiveSummary: "",
    strategicTakeaway: "",
    progressUpdate: "",
    nextPriorities: "",
    metrics: [],
    publishedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    workspaceId: "",
    generationSource: "manual",
  };
}

function reportToForm(report: GrowthReport): ReportForm {
  return {
    id: report.id,
    status: report.status,
    title: report.title,
    periodStart: report.period_start || "",
    periodEnd: report.period_end || "",
    executiveSummary: report.executive_summary,
    strategicTakeaway: report.strategic_takeaway,
    progressUpdate: report.progress_update,
    nextPriorities: report.next_priorities,
    metrics: Array.isArray(report.metrics) ? report.metrics : [],
    publishedAt: report.published_at,
    createdAt: report.created_at,
    updatedAt: report.updated_at,
    workspaceId: report.workspace_id,
    generationSource: report.generation_source || "manual",
  };
}

function formToReport(form: ReportForm): GrowthReport {
  return {
    id: form.id || "preview",
    workspace_id: form.workspaceId || "preview",
    title: form.title || "Untitled weekly report",
    period_start: form.periodStart || null,
    period_end: form.periodEnd || null,
    executive_summary: form.executiveSummary,
    strategic_takeaway: form.strategicTakeaway,
    progress_update: form.progressUpdate,
    next_priorities: form.nextPriorities,
    metrics: form.metrics.filter((metric) => metric.label && metric.value),
    status: form.status,
    published_at: form.publishedAt,
    created_at: form.createdAt,
    updated_at: form.updatedAt,
    generation_source: form.generationSource,
  };
}

function initials(client: GrowthAdminClient) {
  return (client.businessName || client.fullName).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function shortDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Not yet";
}

export default function GrowthEngineClientWorkspace({ clientId }: { clientId: string }) {
  const { toast } = useToast();
  const [client, setClient] = useState<GrowthAdminClient | null>(null);
  const [capabilities, setCapabilities] = useState<GrowthAutomationCapabilities | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<WorkspaceTab>("overview");
  const [saving, setSaving] = useState(false);
  const [strategyTitle, setStrategyTitle] = useState("");
  const [strategySummary, setStrategySummary] = useState("");
  const [milestones, setMilestones] = useState<GrowthMilestone[]>([]);
  const [reportForm, setReportForm] = useState<ReportForm | null>(null);
  const [reportMode, setReportMode] = useState<"edit" | "preview">("edit");
  const [publishArmed, setPublishArmed] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/growth-engine/clients", { cache: "no-store" });
    const data = await response.json().catch(() => null) as GrowthClientsResponse | null;
    if (!response.ok || !data) throw new Error("The client workspace could not be loaded.");
    const nextClient = data.clients.find((item) => item.id === clientId) || null;
    if (!nextClient) throw new Error("Growth Engine client not found.");
    setClient(nextClient);
    setCapabilities(data.capabilities || null);
    setStrategyTitle(nextClient.workspace?.strategy_title || "");
    setStrategySummary(nextClient.workspace?.strategy_summary || "");
    setMilestones(Array.isArray(nextClient.workspace?.implementation_milestones) ? nextClient.workspace.implementation_milestones : []);
  }, [clientId]);

  useEffect(() => {
    load()
      .catch((loadError) => setError((loadError as Error).message))
      .finally(() => setLoading(false));
  }, [load]);

  const publishedReports = useMemo(() => client?.reports.filter((report) => report.status === "published") || [], [client]);
  const draftReports = useMemo(() => client?.reports.filter((report) => report.status === "draft") || [], [client]);
  const completedMilestones = milestones.filter((milestone) => milestone.status === "complete").length;

  async function saveWorkspace() {
    if (!client) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/growth-engine/clients/${client.id}/workspace`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategyTitle, strategySummary, milestones }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Workspace could not be saved.");
      await load();
      toast("Growth Engine workspace saved");
    } catch (saveError) {
      toast((saveError as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function openReport(reportId: string) {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/growth-engine/reports/${reportId}`, { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.report) throw new Error(data?.error || "Report could not be loaded.");
      setReportForm(reportToForm(data.report));
      setReportMode(data.report.status === "draft" ? "edit" : "preview");
      setPublishArmed(false);
    } catch (reportError) {
      toast((reportError as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  function reportPayload(form: ReportForm) {
    return {
      clientId,
      title: form.title,
      periodStart: form.periodStart,
      periodEnd: form.periodEnd,
      executiveSummary: form.executiveSummary,
      strategicTakeaway: form.strategicTakeaway,
      progressUpdate: form.progressUpdate,
      nextPriorities: form.nextPriorities,
      metrics: form.metrics,
    };
  }

  async function saveReport() {
    if (!reportForm || !reportForm.title.trim()) {
      toast("Add a report title before saving.", "error");
      return;
    }
    setSaving(true);
    try {
      const endpoint = reportForm.id ? `/api/admin/growth-engine/reports/${reportForm.id}` : "/api/admin/growth-engine/reports";
      const response = await fetch(endpoint, {
        method: reportForm.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reportPayload(reportForm)),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.report) throw new Error(data?.error || "Report could not be saved.");
      setReportForm(reportToForm(data.report));
      await load();
      toast("Draft saved");
    } catch (saveError) {
      toast((saveError as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function publishReport() {
    if (!reportForm?.id) return;
    setSaving(true);
    try {
      const saveResponse = await fetch(`/api/admin/growth-engine/reports/${reportForm.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reportPayload(reportForm)),
      });
      const saveData = await saveResponse.json().catch(() => null);
      if (!saveResponse.ok) throw new Error(saveData?.error || "The final draft could not be saved.");
      const response = await fetch(`/api/admin/growth-engine/reports/${reportForm.id}/publish`, { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Report could not be published.");
      await load();
      await openReport(reportForm.id);
      setPublishArmed(false);
      toast(data.notified ? "Report published and client notified" : "Report published");
    } catch (publishError) {
      toast((publishError as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function deleteDraft() {
    if (!reportForm?.id || reportForm.status !== "draft" || !window.confirm("Delete this private draft? This cannot be undone.")) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/growth-engine/reports/${reportForm.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Draft could not be deleted.");
      setReportForm(null);
      await load();
      toast("Draft deleted");
    } catch (deleteError) {
      toast((deleteError as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function withdrawReport() {
    if (!reportForm?.id || reportForm.status !== "published" || !window.confirm("Unpublish this report? The client will no longer be able to view it.")) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/growth-engine/reports/${reportForm.id}/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Withdrawn from the Growth Engine workspace" }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Report could not be unpublished.");
      await load();
      await openReport(reportForm.id);
      toast("Report unpublished");
    } catch (withdrawError) {
      toast((withdrawError as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  function updateMetric(index: number, field: keyof GrowthMetric, value: string) {
    if (!reportForm) return;
    const next = [...reportForm.metrics];
    next[index] = { ...next[index], [field]: value };
    setReportForm({ ...reportForm, metrics: next });
  }

  function addMilestone() {
    setMilestones((current) => [...current, {
      id: crypto.randomUUID(),
      title: "",
      owner: "Shared",
      status: "planned",
      targetDate: "",
      note: "",
    }]);
  }

  function updateMilestone(index: number, patch: Partial<GrowthMilestone>) {
    setMilestones((current) => current.map((milestone, milestoneIndex) => milestoneIndex === index ? { ...milestone, ...patch } : milestone));
  }

  if (loading) return <PageSkeleton rows={7} />;
  if (error) return <InlineNotice tone="error">{error}</InlineNotice>;
  if (!client) return null;
  if (!client.enabled) {
    return <div className="v2-surface"><EmptyState title="Client is not enrolled" description="Add this client through Growth Engine access management before opening a delivery workspace." action={<Link href="/admin/growth-engine" className="v2-button-secondary no-underline">Back to portfolio</Link>} /></div>;
  }

  return (
    <>
      <Link href="/admin/growth-engine" className="mb-5 inline-flex items-center gap-2 text-xs font-bold text-text-muted no-underline hover:text-text-primary">
        <span aria-hidden>←</span> Active client portfolio
      </Link>

      <header className="overflow-hidden rounded-[var(--cbb-radius-lg)] border border-white/[0.08] bg-[var(--cbb-surface-1)]">
        <div className="flex flex-col gap-5 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-6">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl border border-accent/25 bg-accent/10 font-heading text-lg font-black text-accent-bright">{initials(client)}</div>
            <div className="min-w-0">
              <div className="v2-eyebrow mb-1">Active Growth Engine client</div>
              <h1 className="truncate font-heading text-2xl font-black text-text-primary sm:text-3xl">{client.businessName || client.fullName}</h1>
              <p className="mt-1 text-sm text-text-muted">{client.fullName}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { setTab("reports"); setReportForm(emptyReport()); setReportMode("edit"); }} className="v2-button-primary">New weekly report</button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-white/[0.07] px-3 py-2 sm:px-5" aria-label="Growth Engine client workspace">
          {tabs.map((item) => (
            <button key={item.id} type="button" aria-pressed={tab === item.id} onClick={() => { setTab(item.id); setReportForm(null); }} className={`min-h-10 whitespace-nowrap rounded-xl px-3.5 text-xs font-bold transition-colors ${tab === item.id ? "bg-[rgba(34,114,222,0.14)] text-accent-bright" : "text-text-muted hover:bg-white/[0.04] hover:text-text-primary"}`}>
              {item.label}
              {item.id === "reports" && client.reports.length > 0 && <span className="ml-2 text-[10px]">{client.reports.length}</span>}
            </button>
          ))}
        </nav>
      </header>

      <main className="mt-5">
        {tab === "overview" && (
          <div className="space-y-5">
            <section className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--cbb-radius-lg)] border border-white/[0.07] bg-white/[0.07] lg:grid-cols-4">
              <WorkspaceMetric label="Published reports" value={String(publishedReports.length)} detail={`Latest ${shortDate(publishedReports[0]?.published_at)}`} />
              <WorkspaceMetric label="Drafts" value={String(draftReports.length)} detail={draftReports.length ? "Awaiting review" : "Queue clear"} tone={draftReports.length ? "warning" : "default"} />
              <WorkspaceMetric label="Milestones" value={milestones.length ? `${completedMilestones}/${milestones.length}` : "—"} detail="Complete" />
              <WorkspaceMetric label="Files" value={String(client.assets.length)} detail="Workspace assets" />
            </section>
            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
              <section className="v2-surface p-5 sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div><div className="v2-eyebrow">Current strategy</div><h2 className="mt-2 v2-section-title">{strategyTitle || "Strategy not added yet"}</h2></div>
                  <button type="button" onClick={() => setTab("strategy")} className="v2-button-secondary">Review strategy</button>
                </div>
                <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-text-secondary">{strategySummary || "Add the commercial direction, positioning and implementation priorities for this client."}</p>
              </section>
              <section className="v2-surface overflow-hidden">
                <div className="border-b border-white/[0.07] px-5 py-4"><h2 className="v2-section-title">Latest report</h2></div>
                {publishedReports[0] ? (
                  <button type="button" onClick={() => { setTab("reports"); void openReport(publishedReports[0].id); }} className="w-full px-5 py-5 text-left hover:bg-white/[0.025]">
                    <p className="text-sm font-bold text-text-primary">{publishedReports[0].title}</p>
                    <p className="mt-2 text-xs text-text-muted">Published {shortDate(publishedReports[0].published_at)}</p>
                    <p className="mt-4 text-xs font-bold text-accent-bright">Open report →</p>
                  </button>
                ) : <EmptyState compact title="No published report" description="Create and publish the first weekly Growth Engine report." />}
              </section>
            </div>
          </div>
        )}

        {tab === "strategy" && (
          <section className="v2-surface overflow-hidden">
            <div className="border-b border-white/[0.07] px-5 py-5 sm:px-7">
              <div className="v2-eyebrow">Growth strategy</div>
              <h2 className="mt-2 v2-section-title">Commercial direction and implementation plan</h2>
              <p className="mt-1 text-xs text-text-muted">This is the strategy the client sees inside their Growth Engine workspace.</p>
            </div>
            <div className="space-y-5 p-5 sm:p-7">
              <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.1em] text-text-muted">Strategy title</span><input value={strategyTitle} onChange={(event) => setStrategyTitle(event.target.value)} placeholder="e.g. Build a predictable qualified lead engine" className="min-h-11 w-full rounded-xl border border-white/[0.09] bg-white/[0.03] px-4 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent/45" /></label>
              <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.1em] text-text-muted">Strategy</span><textarea value={strategySummary} onChange={(event) => setStrategySummary(event.target.value)} placeholder="Set out the objective, offer direction, audience, systems being implemented and the commercial priorities." rows={14} className="w-full resize-y rounded-xl border border-white/[0.09] bg-white/[0.03] px-4 py-3 text-sm leading-7 text-text-primary outline-none placeholder:text-text-muted focus:border-accent/45" /></label>
              <div className="flex justify-end"><button type="button" onClick={saveWorkspace} disabled={saving} className="v2-button-primary">{saving ? "Saving…" : "Save strategy"}</button></div>
            </div>
          </section>
        )}

        {tab === "reports" && (
          reportForm ? (
            <ReportEditor
              form={reportForm}
              mode={reportMode}
              saving={saving}
              publishArmed={publishArmed}
              onForm={setReportForm}
              onMode={setReportMode}
              onClose={() => { setReportForm(null); setPublishArmed(false); }}
              onSave={saveReport}
              onArmPublish={() => setPublishArmed(true)}
              onCancelPublish={() => setPublishArmed(false)}
              onPublish={publishReport}
              onDelete={deleteDraft}
              onWithdraw={withdrawReport}
              onMetric={updateMetric}
            />
          ) : (
            <section className="v2-surface overflow-hidden">
              <header className="flex items-center justify-between gap-4 border-b border-white/[0.07] px-5 py-5 sm:px-7">
                <div><h2 className="v2-section-title">Weekly reports</h2><p className="mt-1 text-xs text-text-muted">Draft privately, preview the client view, then publish.</p></div>
                <button type="button" onClick={() => setReportForm(emptyReport())} className="v2-button-primary">New report</button>
              </header>
              {client.reports.length ? (
                <div className="divide-y divide-white/[0.06]">
                  {client.reports.map((report) => (
                    <button key={report.id} type="button" onClick={() => openReport(report.id)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-white/[0.025] sm:px-7">
                      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-bold text-text-primary">{report.title}</p>{report.generation_source !== "manual" && <span className="rounded-full border border-accent/20 bg-accent/[0.07] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-accent-bright">Automated intake</span>}</div><p className="mt-1 text-xs text-text-muted">{report.status === "published" ? `Published ${shortDate(report.published_at)}` : `Updated ${shortDate(report.updated_at)}`}</p></div>
                      <StatusBadge status={report.status} />
                    </button>
                  ))}
                </div>
              ) : <EmptyState title="No weekly reports yet" description="Create the first delivery report for this client." action={<button type="button" onClick={() => setReportForm(emptyReport())} className="v2-button-primary">Create report</button>} />}
            </section>
          )
        )}

        {tab === "milestones" && (
          <section className="v2-surface overflow-hidden">
            <header className="flex flex-col gap-4 border-b border-white/[0.07] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <div><h2 className="v2-section-title">Implementation milestones</h2><p className="mt-1 text-xs text-text-muted">Track systems from planned through to complete.</p></div>
              <button type="button" onClick={addMilestone} className="v2-button-secondary">Add milestone</button>
            </header>
            <div className="space-y-4 p-5 sm:p-7">
              {milestones.map((milestone, index) => (
                <div key={milestone.id} className="grid gap-3 rounded-[var(--cbb-radius-md)] border border-white/[0.07] bg-white/[0.02] p-4 lg:grid-cols-[minmax(220px,1fr)_150px_150px_150px_auto]">
                  <input value={milestone.title} onChange={(event) => updateMilestone(index, { title: event.target.value })} placeholder="Milestone" className="min-h-10 rounded-lg border border-white/[0.08] bg-black/10 px-3 text-sm text-text-primary outline-none" />
                  <select value={milestone.owner} onChange={(event) => updateMilestone(index, { owner: event.target.value as GrowthMilestone["owner"] })} className="min-h-10 rounded-lg border border-white/[0.08] bg-[var(--cbb-surface-1)] px-3 text-sm text-text-primary outline-none"><option>Flow State</option><option>Client</option><option>Shared</option></select>
                  <select value={milestone.status} onChange={(event) => updateMilestone(index, { status: event.target.value as GrowthMilestone["status"] })} className="min-h-10 rounded-lg border border-white/[0.08] bg-[var(--cbb-surface-1)] px-3 text-sm text-text-primary outline-none"><option value="planned">Planned</option><option value="in_progress">In progress</option><option value="complete">Complete</option></select>
                  <input type="date" value={milestone.targetDate || ""} onChange={(event) => updateMilestone(index, { targetDate: event.target.value })} className="min-h-10 rounded-lg border border-white/[0.08] bg-black/10 px-3 text-sm text-text-primary outline-none" />
                  <button type="button" onClick={() => setMilestones((current) => current.filter((_, milestoneIndex) => milestoneIndex !== index))} className="min-h-10 px-2 text-xs font-bold text-text-muted hover:text-red-300">Remove</button>
                </div>
              ))}
              {!milestones.length && <EmptyState compact title="No milestones yet" description="Add the first implementation milestone when delivery begins." action={<button type="button" onClick={addMilestone} className="v2-button-secondary">Add milestone</button>} />}
              <div className="flex justify-end border-t border-white/[0.07] pt-5"><button type="button" onClick={saveWorkspace} disabled={saving} className="v2-button-primary">{saving ? "Saving…" : "Save milestones"}</button></div>
            </div>
          </section>
        )}

        {tab === "files" && (
          <GrowthEngineFiles clientId={client.id} assets={client.assets} onChanged={load} />
        )}

        {tab === "data" && (
          <GrowthEngineDataSetup clientId={client.id} connection={client.connection} capabilities={capabilities} onChanged={load} />
        )}
      </main>
    </>
  );
}

function WorkspaceMetric({ label, value, detail, tone = "default" }: { label: string; value: string; detail: string; tone?: "default" | "warning" }) {
  return <div className="bg-[var(--cbb-surface-1)] p-4 sm:p-5"><p className="text-xs text-text-muted">{label}</p><p className={`mt-2 font-heading text-3xl font-black ${tone === "warning" ? "text-amber-300" : "text-text-primary"}`}>{value}</p><p className="mt-1 text-[11px] text-text-muted">{detail}</p></div>;
}

function StatusBadge({ status }: { status: "draft" | "published" | "withdrawn" }) {
  const tone = status === "published"
    ? "border-emerald-500/25 bg-emerald-500/8 text-emerald-300"
    : status === "withdrawn"
      ? "border-white/10 bg-white/[0.03] text-text-muted"
      : "border-amber-400/25 bg-amber-400/8 text-amber-300";
  return <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.1em] ${tone}`}>{status}</span>;
}

function ReportEditor({
  form,
  mode,
  saving,
  publishArmed,
  onForm,
  onMode,
  onClose,
  onSave,
  onArmPublish,
  onCancelPublish,
  onPublish,
  onDelete,
  onWithdraw,
  onMetric,
}: {
  form: ReportForm;
  mode: "edit" | "preview";
  saving: boolean;
  publishArmed: boolean;
  onForm: (form: ReportForm) => void;
  onMode: (mode: "edit" | "preview") => void;
  onClose: () => void;
  onSave: () => void;
  onArmPublish: () => void;
  onCancelPublish: () => void;
  onPublish: () => void;
  onDelete: () => void;
  onWithdraw: () => void;
  onMetric: (index: number, field: keyof GrowthMetric, value: string) => void;
}) {
  return (
    <section className="v2-surface overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-3 sm:px-7">
        <div className="flex rounded-xl bg-black/10 p-1">
          <button type="button" onClick={() => onMode("edit")} disabled={form.status !== "draft"} className={`min-h-9 rounded-lg px-4 text-xs font-bold ${mode === "edit" ? "bg-white/[0.08] text-text-primary" : "text-text-muted"} disabled:opacity-40`}>Edit</button>
          <button type="button" onClick={() => onMode("preview")} className={`min-h-9 rounded-lg px-4 text-xs font-bold ${mode === "preview" ? "bg-white/[0.08] text-text-primary" : "text-text-muted"}`}>Client preview</button>
        </div>
        <button type="button" onClick={onClose} className="text-xs font-bold text-text-muted hover:text-text-primary">Close report</button>
      </header>

      {mode === "preview" ? <div className="p-5 sm:p-7"><ReportView report={formToReport(form)} /></div> : (
        <div className="space-y-6 p-5 sm:p-7">
          {form.generationSource !== "manual" && (
            <div className="rounded-xl border border-accent/20 bg-accent/[0.07] p-4">
              <p className="text-xs font-black uppercase tracking-[0.1em] text-accent-bright">Arrived automatically</p>
              <p className="mt-1 text-xs leading-5 text-text-secondary">This report and any attached files were ingested as a private draft. Review the evidence and client visibility before publishing.</p>
            </div>
          )}
          <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.1em] text-text-muted">Report title</span><input value={form.title} onChange={(event) => onForm({ ...form, title: event.target.value })} placeholder="e.g. A stronger week for qualified demand" className="min-h-11 w-full rounded-xl border border-white/[0.09] bg-white/[0.03] px-4 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent/45" /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-bold uppercase tracking-[0.1em] text-text-muted">Period start<input type="date" value={form.periodStart} onChange={(event) => onForm({ ...form, periodStart: event.target.value })} className="mt-2 min-h-11 w-full rounded-xl border border-white/[0.09] bg-white/[0.03] px-4 text-sm text-text-primary outline-none" /></label>
            <label className="text-xs font-bold uppercase tracking-[0.1em] text-text-muted">Period end<input type="date" value={form.periodEnd} onChange={(event) => onForm({ ...form, periodEnd: event.target.value })} className="mt-2 min-h-11 w-full rounded-xl border border-white/[0.09] bg-white/[0.03] px-4 text-sm text-text-primary outline-none" /></label>
          </div>
          {([
            ["executiveSummary", "Executive summary", "Give the client the clearest short version of the week."],
            ["strategicTakeaway", "Growth Engine read", "What is the one strategic takeaway from this week?"],
            ["progressUpdate", "What moved forward", "Add one delivery win or useful learning per line."],
            ["nextPriorities", "What changes next", "Prefix each action with Flow State:, Client: or Shared:."],
          ] as const).map(([field, label, placeholder]) => <label key={field} className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.1em] text-text-muted">{label}</span><textarea value={form[field]} onChange={(event) => onForm({ ...form, [field]: event.target.value })} placeholder={placeholder} rows={field === "progressUpdate" || field === "nextPriorities" ? 6 : 4} className="w-full resize-y rounded-xl border border-white/[0.09] bg-white/[0.03] px-4 py-3 text-sm leading-6 text-text-primary outline-none placeholder:text-text-muted focus:border-accent/45" /></label>)}
          <section>
            <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="text-xs font-bold uppercase tracking-[0.1em] text-text-muted">Relevant results</h3><p className="mt-1 text-xs text-text-muted">Use only measures that matter for this client.</p></div><button type="button" onClick={() => onForm({ ...form, metrics: [...form.metrics, { label: "", value: "", change: "", context: "" }] })} className="v2-button-secondary">Add result</button></div>
            <div className="space-y-3">
              {form.metrics.map((metric, index) => <div key={index} className="grid gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 sm:grid-cols-2 xl:grid-cols-[1fr_0.6fr_0.55fr_1.1fr_auto]"><input value={metric.label} onChange={(event) => onMetric(index, "label", event.target.value)} placeholder="Measure" className="min-h-10 rounded-lg border border-white/[0.08] bg-black/10 px-3 text-sm text-text-primary outline-none" /><input value={metric.value} onChange={(event) => onMetric(index, "value", event.target.value)} placeholder="Value" className="min-h-10 rounded-lg border border-white/[0.08] bg-black/10 px-3 text-sm text-text-primary outline-none" /><input value={metric.change || ""} onChange={(event) => onMetric(index, "change", event.target.value)} placeholder="Change" className="min-h-10 rounded-lg border border-white/[0.08] bg-black/10 px-3 text-sm text-text-primary outline-none" /><input value={metric.context || ""} onChange={(event) => onMetric(index, "context", event.target.value)} placeholder="Context" className="min-h-10 rounded-lg border border-white/[0.08] bg-black/10 px-3 text-sm text-text-primary outline-none" /><button type="button" onClick={() => onForm({ ...form, metrics: form.metrics.filter((_, metricIndex) => metricIndex !== index) })} className="min-h-10 px-2 text-xs font-bold text-text-muted hover:text-red-300">Remove</button></div>)}
            </div>
          </section>
        </div>
      )}

      <footer className="border-t border-white/[0.07] bg-[var(--cbb-surface-1)]/95 px-5 py-4 sm:px-7">
        {form.status === "draft" && publishArmed ? (
          <div className="flex flex-col gap-4 rounded-xl border border-accent/25 bg-accent/[0.08] p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold text-text-primary">Publish this report?</p><p className="mt-1 text-xs text-text-muted">The latest edits will be saved first, then the client will be notified.</p></div><div className="flex gap-2"><button type="button" onClick={onCancelPublish} className="v2-button-secondary">Cancel</button><button type="button" onClick={onPublish} disabled={saving} className="v2-button-primary">{saving ? "Publishing…" : "Confirm publish"}</button></div></div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-text-muted">{form.status === "published" ? "Published and visible to the client." : form.status === "withdrawn" ? "Unpublished and no longer visible to the client." : "Drafts stay private until published."}</p>
            <div className="flex flex-wrap gap-2">
              {form.status === "draft" && form.id && <button type="button" onClick={onDelete} disabled={saving} className="min-h-10 rounded-xl px-3 text-xs font-bold text-red-300 hover:bg-red-500/10">Delete draft</button>}
              {form.status === "draft" && <><button type="button" onClick={onSave} disabled={saving} className="v2-button-secondary">{saving ? "Saving…" : "Save draft"}</button><button type="button" onClick={onArmPublish} disabled={!form.id || !form.title.trim()} className="v2-button-primary">Review &amp; publish</button></>}
              {form.status === "published" && <button type="button" onClick={onWithdraw} disabled={saving} className="min-h-10 rounded-xl border border-red-400/20 px-4 text-xs font-bold text-red-300 hover:bg-red-500/10">{saving ? "Unpublishing…" : "Unpublish report"}</button>}
            </div>
          </div>
        )}
      </footer>
    </section>
  );
}
