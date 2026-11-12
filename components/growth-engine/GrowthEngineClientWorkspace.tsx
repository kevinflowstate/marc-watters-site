"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import GrowthEngineDataSetup from "@/components/growth-engine/GrowthEngineDataSetup";
import GrowthEngineFiles from "@/components/growth-engine/GrowthEngineFiles";
import ReportView from "@/components/growth-engine/ReportView";
import { WsEmpty as EmptyState, WsNotice as InlineNotice, WsPageSkeleton as PageSkeleton } from "@/components/portal/WsState";
import { Icon } from "@/components/ops/workspace/WorkspaceUI";
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
  if (error) return <div className="ws ws-page"><InlineNotice tone="error">{error}</InlineNotice></div>;
  if (!client) return null;
  if (!client.enabled) {
    return <div className="ws ws-page"><div className="ws-panel"><EmptyState title="Client is not enrolled" description="Add this client through Growth Engine access management before opening a delivery workspace." action={<Link href="/admin/growth-engine" className="ws-btn ws-focus">Back to portfolio</Link>} /></div></div>;
  }

  return (
    <div className="ws ws-page">
      <Link href="/admin/growth-engine" className="ws-back ws-focus">
        <Icon name="chevron" size={14} className="ws-back-ic" /> Active client portfolio
      </Link>

      <header className="ws-ph">
        <div className="ws-cd-head">
          <span className="ws-avatar is-lg">{initials(client)}</span>
          <div className="min-w-0">
            <div className="ws-caption">Active Growth Engine client</div>
            <h1 className="ws-title ws-cd-title">{client.businessName || client.fullName}</h1>
            <p className="ws-meta">{client.fullName}</p>
          </div>
        </div>
        <div className="ws-ph-acts">
          <button type="button" onClick={() => { setTab("reports"); setReportForm(emptyReport()); setReportMode("edit"); }} className="ws-btn ws-btn-primary ws-focus">New weekly report</button>
        </div>
      </header>
      <nav className="ws-seg ws-ge-tabs" aria-label="Growth Engine client workspace">
        {tabs.map((item) => (
          <button key={item.id} type="button" aria-pressed={tab === item.id} onClick={() => { setTab(item.id); setReportForm(null); }} className="ws-seg-btn ws-focus">
            {item.label}
            {item.id === "reports" && client.reports.length > 0 && <span className="ws-seg-count">{client.reports.length}</span>}
          </button>
        ))}
      </nav>

      <main className="ws-ge-main">
        {tab === "overview" && (
          <div className="ws-stack">
            <section className="ws-strip">
              <WorkspaceMetric label="Published reports" value={String(publishedReports.length)} detail={`Latest ${shortDate(publishedReports[0]?.published_at)}`} />
              <WorkspaceMetric label="Drafts" value={String(draftReports.length)} detail={draftReports.length ? "Awaiting review" : "Queue clear"} tone={draftReports.length ? "warning" : "default"} />
              <WorkspaceMetric label="Milestones" value={milestones.length ? `${completedMilestones}/${milestones.length}` : "—"} detail="Complete" />
              <WorkspaceMetric label="Files" value={String(client.assets.length)} detail="Workspace assets" />
            </section>
            <div className="ws-grid2">
              <section className="ws-panel min-w-0">
                <div className="ws-panel-head">
                  <div className="min-w-0 ws-ge-head-t"><div className="ws-caption">Current strategy</div><h2 className="ws-h2">{strategyTitle || "Strategy not added yet"}</h2></div>
                  <button type="button" onClick={() => setTab("strategy")} className="ws-btn ws-btn-sm ws-focus">Review strategy</button>
                </div>
                <p className="ws-prose ws-pad">{strategySummary || "Add the commercial direction, positioning and implementation priorities for this client."}</p>
              </section>
              <section className="ws-panel min-w-0">
                <div className="ws-panel-head"><h2 className="ws-h2">Latest report</h2></div>
                {publishedReports[0] ? (
                  <button type="button" onClick={() => { setTab("reports"); void openReport(publishedReports[0].id); }} className="ws-row ws-focus ws-ge-open">
                    <Icon name="reporting" size={14} className="ws-status-ic" />
                    <span className="min-w-0">
                      <span className="ws-row-title">{publishedReports[0].title}</span>
                      <span className="ws-row-sub">Published {shortDate(publishedReports[0].published_at)}</span>
                    </span>
                    <span className="ws-link ws-ge-open-l">Open report</span>
                  </button>
                ) : <EmptyState compact title="No published report" description="Create and publish the first weekly Growth Engine report." />}
              </section>
            </div>
          </div>
        )}

        {tab === "strategy" && (
          <section className="ws-panel">
            <div className="ws-panel-head">
              <div className="min-w-0 ws-ge-head-t">
                <div className="ws-caption">Growth strategy</div>
                <h2 className="ws-h2">Commercial direction and implementation plan</h2>
                <p className="ws-caption">This is the strategy the client sees inside their Growth Engine workspace.</p>
              </div>
            </div>
            <div className="ws-ge-form">
              <label className="block"><span className="ws-label">Strategy title</span><input value={strategyTitle} onChange={(event) => setStrategyTitle(event.target.value)} placeholder="e.g. Build a predictable qualified lead engine" className="ws-input" /></label>
              <label className="block"><span className="ws-label">Strategy</span><textarea value={strategySummary} onChange={(event) => setStrategySummary(event.target.value)} placeholder="Set out the objective, offer direction, audience, systems being implemented and the commercial priorities." rows={14} className="ws-input" /></label>
              <div className="ws-ge-end"><button type="button" onClick={saveWorkspace} disabled={saving} className="ws-btn ws-btn-primary ws-focus">{saving ? "Saving…" : "Save strategy"}</button></div>
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
            <section className="ws-panel">
              <header className="ws-panel-head">
                <div className="min-w-0 ws-ge-head-t"><h2 className="ws-h2">Weekly reports</h2><p className="ws-caption">Draft privately, preview the client view, then publish.</p></div>
                <button type="button" onClick={() => setReportForm(emptyReport())} className="ws-btn ws-btn-primary ws-btn-sm ws-focus">New report</button>
              </header>
              {client.reports.length ? (
                <div>
                  {client.reports.map((report) => (
                    <button key={report.id} type="button" onClick={() => openReport(report.id)} className="ws-row ws-focus ws-ge-rep">
                      <Icon name="reporting" size={14} className="ws-status-ic" />
                      <div className="min-w-0"><div className="ws-ge-row-top"><p className="ws-row-title">{report.title}</p>{report.generation_source !== "manual" && <span className="ws-chip is-decide">Automated intake</span>}</div><p className="ws-row-sub">{report.status === "published" ? `Published ${shortDate(report.published_at)}` : `Updated ${shortDate(report.updated_at)}`}</p></div>
                      <StatusBadge status={report.status} />
                    </button>
                  ))}
                </div>
              ) : <EmptyState title="No weekly reports yet" description="Create the first delivery report for this client." action={<button type="button" onClick={() => setReportForm(emptyReport())} className="ws-btn ws-btn-primary ws-focus">Create report</button>} />}
            </section>
          )
        )}

        {tab === "milestones" && (
          <section className="ws-panel">
            <header className="ws-panel-head">
              <div className="min-w-0 ws-ge-head-t"><h2 className="ws-h2">Implementation milestones</h2><p className="ws-caption">Track systems from planned through to complete.</p></div>
              <button type="button" onClick={addMilestone} className="ws-btn ws-btn-sm ws-focus">Add milestone</button>
            </header>
            <div className="ws-ge-form">
              {milestones.map((milestone, index) => (
                <div key={milestone.id} className="ws-ge-ms">
                  <input value={milestone.title} onChange={(event) => updateMilestone(index, { title: event.target.value })} placeholder="Milestone" className="ws-input" />
                  <select value={milestone.owner} onChange={(event) => updateMilestone(index, { owner: event.target.value as GrowthMilestone["owner"] })} className="ws-input"><option>Flow State</option><option>Client</option><option>Shared</option></select>
                  <select value={milestone.status} onChange={(event) => updateMilestone(index, { status: event.target.value as GrowthMilestone["status"] })} className="ws-input"><option value="planned">Planned</option><option value="in_progress">In progress</option><option value="complete">Complete</option></select>
                  <input type="date" value={milestone.targetDate || ""} onChange={(event) => updateMilestone(index, { targetDate: event.target.value })} className="ws-input" />
                  <button type="button" onClick={() => setMilestones((current) => current.filter((_, milestoneIndex) => milestoneIndex !== index))} className="ws-btn ws-btn-quiet ws-btn-sm ws-focus ws-ge-remove">Remove</button>
                </div>
              ))}
              {!milestones.length && <EmptyState compact title="No milestones yet" description="Add the first implementation milestone when delivery begins." action={<button type="button" onClick={addMilestone} className="ws-btn ws-focus">Add milestone</button>} />}
              <div className="ws-ge-end is-ruled"><button type="button" onClick={saveWorkspace} disabled={saving} className="ws-btn ws-btn-primary ws-focus">{saving ? "Saving…" : "Save milestones"}</button></div>
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
    </div>
  );
}

function WorkspaceMetric({ label, value, detail, tone = "default" }: { label: string; value: string; detail: string; tone?: "default" | "warning" }) {
  return <div className="ws-stat is-static"><p className="ws-stat-l">{label}</p><p className="ws-stat-n">{value}</p><p className={`ws-stat-s ${tone === "warning" ? "is-attn" : ""}`}>{detail}</p></div>;
}

function StatusBadge({ status }: { status: "draft" | "published" | "withdrawn" }) {
  const tone = status === "published"
    ? "is-ok"
    : status === "withdrawn"
      ? ""
      : "is-attn";
  return <span className={`ws-chip ws-ge-status ${tone}`}>{status}</span>;
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
    <section className="ws-panel">
      <header className="ws-panel-head ws-ge-ed-head">
        <div className="ws-seg">
          <button type="button" onClick={() => onMode("edit")} disabled={form.status !== "draft"} className={`ws-seg-btn ws-focus ${mode === "edit" ? "is-on" : ""}`}>Edit</button>
          <button type="button" onClick={() => onMode("preview")} className={`ws-seg-btn ws-focus ${mode === "preview" ? "is-on" : ""}`}>Client preview</button>
        </div>
        <button type="button" onClick={onClose} className="ws-btn ws-btn-quiet ws-btn-sm ws-focus">Close report</button>
      </header>

      {mode === "preview" ? <div className="ws-ge-form"><ReportView report={formToReport(form)} /></div> : (
        <div className="ws-ge-form">
          {form.generationSource !== "manual" && (
            <div className="ws-note is-info">
              <Icon name="info" size={15} />
              <div>
                <p className="ws-st-strong">Arrived automatically</p>
                <p className="ws-caption">This report and any attached files were ingested as a private draft. Review the evidence and client visibility before publishing.</p>
              </div>
            </div>
          )}
          <label className="block"><span className="ws-label">Report title</span><input value={form.title} onChange={(event) => onForm({ ...form, title: event.target.value })} placeholder="e.g. A stronger week for qualified demand" className="ws-input" /></label>
          <div className="ws-st-2">
            <label className="ws-label ws-ge-datel">Period start<input type="date" value={form.periodStart} onChange={(event) => onForm({ ...form, periodStart: event.target.value })} className="ws-input" /></label>
            <label className="ws-label ws-ge-datel">Period end<input type="date" value={form.periodEnd} onChange={(event) => onForm({ ...form, periodEnd: event.target.value })} className="ws-input" /></label>
          </div>
          {([
            ["executiveSummary", "Executive summary", "Give the client the clearest short version of the week."],
            ["strategicTakeaway", "Growth Engine read", "What is the one strategic takeaway from this week?"],
            ["progressUpdate", "What moved forward", "Add one delivery win or useful learning per line."],
            ["nextPriorities", "What changes next", "Prefix each action with Flow State:, Client: or Shared:."],
          ] as const).map(([field, label, placeholder]) => <label key={field} className="block"><span className="ws-label">{label}</span><textarea value={form[field]} onChange={(event) => onForm({ ...form, [field]: event.target.value })} placeholder={placeholder} rows={field === "progressUpdate" || field === "nextPriorities" ? 6 : 4} className="ws-input" /></label>)}
          <section>
            <div className="ws-ge-sub"><div className="min-w-0"><h3 className="ws-h3">Relevant results</h3><p className="ws-caption">Use only measures that matter for this client.</p></div><button type="button" onClick={() => onForm({ ...form, metrics: [...form.metrics, { label: "", value: "", change: "", context: "" }] })} className="ws-btn ws-btn-sm ws-focus">Add result</button></div>
            <div className="ws-ge-metrics-ed">
              {form.metrics.map((metric, index) => <div key={index} className="ws-ge-mrow"><input value={metric.label} onChange={(event) => onMetric(index, "label", event.target.value)} placeholder="Measure" className="ws-input" /><input value={metric.value} onChange={(event) => onMetric(index, "value", event.target.value)} placeholder="Value" className="ws-input" /><input value={metric.change || ""} onChange={(event) => onMetric(index, "change", event.target.value)} placeholder="Change" className="ws-input" /><input value={metric.context || ""} onChange={(event) => onMetric(index, "context", event.target.value)} placeholder="Context" className="ws-input" /><button type="button" onClick={() => onForm({ ...form, metrics: form.metrics.filter((_, metricIndex) => metricIndex !== index) })} className="ws-btn ws-btn-quiet ws-btn-sm ws-focus ws-ge-remove">Remove</button></div>)}
            </div>
          </section>
        </div>
      )}

      <footer className="ws-ge-foot">
        {form.status === "draft" && publishArmed ? (
          <div className="ws-note is-info ws-ge-confirm"><div className="min-w-0"><p className="ws-st-strong">Publish this report?</p><p className="ws-caption">The latest edits will be saved first, then the client will be notified.</p></div><div className="ws-ge-acts"><button type="button" onClick={onCancelPublish} className="ws-btn ws-focus">Cancel</button><button type="button" onClick={onPublish} disabled={saving} className="ws-btn ws-btn-primary ws-focus">{saving ? "Publishing…" : "Confirm publish"}</button></div></div>
        ) : (
          <div className="ws-ge-foot-row">
            <p className="ws-caption">{form.status === "published" ? "Published and visible to the client." : form.status === "withdrawn" ? "Unpublished and no longer visible to the client." : "Drafts stay private until published."}</p>
            <div className="ws-ge-acts">
              {form.status === "draft" && form.id && <button type="button" onClick={onDelete} disabled={saving} className="ws-btn ws-btn-quiet ws-focus ws-ge-del">Delete draft</button>}
              {form.status === "draft" && <><button type="button" onClick={onSave} disabled={saving} className="ws-btn ws-focus">{saving ? "Saving…" : "Save draft"}</button><button type="button" onClick={onArmPublish} disabled={!form.id || !form.title.trim()} className="ws-btn ws-btn-primary ws-focus">Review &amp; publish</button></>}
              {form.status === "published" && <button type="button" onClick={onWithdraw} disabled={saving} className="ws-btn ws-btn-danger ws-focus">{saving ? "Unpublishing…" : "Unpublish report"}</button>}
            </div>
          </div>
        )}
      </footer>
    </section>
  );
}
