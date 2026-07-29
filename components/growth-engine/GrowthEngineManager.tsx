"use client";

import { useEffect, useMemo, useState } from "react";
import ReportView from "@/components/growth-engine/ReportView";
import { EmptyState, InlineNotice, PageSkeleton } from "@/components/ui/PortalState";
import { useToast } from "@/components/ui/Toast";
import type { GrowthMetric, GrowthReport } from "@/lib/growth-engine";

interface ReportSummary {
  id: string;
  workspace_id: string;
  title: string;
  period_start: string | null;
  period_end: string | null;
  status: "draft" | "published";
  published_at: string | null;
  updated_at: string;
}

interface GrowthClient {
  id: string;
  fullName: string;
  businessName: string;
  enabled: boolean;
  workspaceId: string | null;
  reports: ReportSummary[];
}

interface ReportForm {
  id: string | null;
  status: "draft" | "published";
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
}

const emptyForm = (): ReportForm => ({
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
});

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
  };
}

export default function GrowthEngineManager() {
  const { toast } = useToast();
  const [clients, setClients] = useState<GrowthClient[]>([]);
  const [viewerRole, setViewerRole] = useState<"admin" | "growth_operator">("growth_operator");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [form, setForm] = useState<ReportForm | null>(null);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "enabled" | "locked">("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishArmed, setPublishArmed] = useState(false);
  const [error, setError] = useState("");

  async function loadClients(preferredClientId?: string) {
    setError("");
    const response = await fetch("/api/admin/growth-engine/clients", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load Growth Engine clients.");
    const data = await response.json();
    const nextClients = Array.isArray(data.clients) ? data.clients : [];
    setClients(nextClients);
    setViewerRole(data.viewerRole === "admin" ? "admin" : "growth_operator");
    const nextSelected = preferredClientId || selectedClientId || nextClients[0]?.id || "";
    setSelectedClientId(nextSelected);
  }

  useEffect(() => {
    loadClients()
      .catch(() => setError("The Growth Engine workspace could not be loaded."))
      .finally(() => setLoading(false));
    // Initial load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedClient = clients.find((client) => client.id === selectedClientId) || null;
  const visibleClients = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return clients.filter((client) => {
      if (filter === "enabled" && !client.enabled) return false;
      if (filter === "locked" && client.enabled) return false;
      if (!normalizedQuery) return true;
      return `${client.fullName} ${client.businessName}`.toLowerCase().includes(normalizedQuery);
    });
  }, [clients, filter, query]);

  async function toggleAccess() {
    if (!selectedClient) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/growth-engine/clients/${selectedClient.id}/entitlement`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !selectedClient.enabled }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Access could not be updated.");
      }
      await loadClients(selectedClient.id);
      toast(selectedClient.enabled ? "Growth Engine access locked" : "Growth Engine access enabled");
    } catch (toggleError) {
      toast((toggleError as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  function startReport() {
    setForm(emptyForm());
    setMode("edit");
    setPublishArmed(false);
  }

  async function openReport(reportId: string) {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/growth-engine/reports/${reportId}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Report could not be loaded.");
      const data = await response.json();
      setForm(reportToForm(data.report));
      setMode(data.report.status === "published" ? "preview" : "edit");
      setPublishArmed(false);
    } catch (openError) {
      toast((openError as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function saveDraft() {
    if (!selectedClient || !form) return;
    if (!form.title.trim()) {
      toast("Add a report title before saving.", "error");
      return;
    }
    setSaving(true);
    try {
      const endpoint = form.id
        ? `/api/admin/growth-engine/reports/${form.id}`
        : "/api/admin/growth-engine/reports";
      const response = await fetch(endpoint, {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClient.id,
          title: form.title,
          periodStart: form.periodStart,
          periodEnd: form.periodEnd,
          executiveSummary: form.executiveSummary,
          strategicTakeaway: form.strategicTakeaway,
          progressUpdate: form.progressUpdate,
          nextPriorities: form.nextPriorities,
          metrics: form.metrics,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Report could not be saved.");
      setForm(reportToForm(data.report));
      await loadClients(selectedClient.id);
      toast("Draft saved");
    } catch (saveError) {
      toast((saveError as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function publishReport() {
    if (!form?.id || form.status !== "draft") {
      toast("Save the draft before publishing.", "error");
      return;
    }
    setSaving(true);
    try {
      const saveResponse = await fetch(`/api/admin/growth-engine/reports/${form.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          periodStart: form.periodStart,
          periodEnd: form.periodEnd,
          executiveSummary: form.executiveSummary,
          strategicTakeaway: form.strategicTakeaway,
          progressUpdate: form.progressUpdate,
          nextPriorities: form.nextPriorities,
          metrics: form.metrics,
        }),
      });
      const savedData = await saveResponse.json().catch(() => null);
      if (!saveResponse.ok) throw new Error(savedData?.error || "The final draft could not be saved.");

      const response = await fetch(`/api/admin/growth-engine/reports/${form.id}/publish`, { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Report could not be published.");
      await loadClients(selectedClientId);
      await openReport(form.id);
      setPublishArmed(false);
      toast(data.notified ? "Report published and client notified" : "Report published — client remains locked, so no notification was sent");
    } catch (publishError) {
      toast((publishError as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  function updateMetric(index: number, field: keyof GrowthMetric, value: string) {
    if (!form) return;
    const metrics = [...form.metrics];
    metrics[index] = { ...metrics[index], [field]: value };
    setForm({ ...form, metrics });
  }

  if (loading) return <PageSkeleton rows={6} />;

  return (
    <>
      <header className="mb-7 sm:mb-9">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="v2-eyebrow mb-3">AI delivery workspace</div>
            <h1 className="v2-page-title">CBB Growth Engine</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
              Manage enrolled clients and publish clear weekly delivery reports.
            </p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-accent/20 bg-accent/8 px-3 py-2 text-xs font-semibold text-accent-bright">
            <span className="h-2 w-2 rounded-full bg-accent-bright" />
            {viewerRole === "growth_operator" ? "Flow State operator access" : "Administrator access"}
          </div>
        </div>
      </header>

      {error && <InlineNotice tone="error" className="mb-5">{error}</InlineNotice>}

      <div className="grid min-h-[680px] overflow-hidden rounded-[var(--cbb-radius-lg)] border border-white/[0.075] bg-[var(--cbb-surface-1)] xl:grid-cols-[310px_minmax(0,1fr)]">
        <aside className="border-b border-white/[0.07] xl:border-b-0 xl:border-r">
          <div className="border-b border-white/[0.07] p-4">
            <label className="relative block">
              <span className="sr-only">Search Growth Engine clients</span>
              <svg className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="m21 21-4.35-4.35m1.35-5.65a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search clients"
                className="min-h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-2 pl-10 pr-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent/45"
              />
            </label>
            <div className="mt-3 flex gap-1 rounded-xl bg-black/10 p-1">
              {(["all", "enabled", "locked"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`min-h-9 flex-1 rounded-lg px-2 text-[11px] font-bold capitalize transition-colors ${
                    filter === value ? "bg-white/[0.08] text-text-primary" : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          <div className="max-h-[560px] divide-y divide-white/[0.055] overflow-y-auto xl:max-h-[720px]">
            {visibleClients.map((client) => (
              <button
                key={client.id}
                type="button"
                onClick={() => { setSelectedClientId(client.id); setForm(null); setPublishArmed(false); }}
                className={`w-full px-4 py-4 text-left transition-colors ${
                  selectedClientId === client.id ? "bg-accent/10" : "hover:bg-white/[0.025]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-text-primary">{client.fullName}</div>
                    <div className="mt-1 truncate text-xs text-text-muted">{client.businessName || "Business details not set"}</div>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.1em] ${
                    client.enabled
                      ? "border-emerald-500/25 bg-emerald-500/8 text-emerald-300"
                      : "border-white/[0.08] bg-white/[0.025] text-text-muted"
                  }`}>
                    {client.enabled ? "Enabled" : "Locked"}
                  </span>
                </div>
              </button>
            ))}
            {visibleClients.length === 0 && <p className="px-5 py-10 text-center text-sm text-text-muted">No clients match this view.</p>}
          </div>
        </aside>

        <main className="min-w-0">
          {!selectedClient ? (
            <EmptyState title="Select a client" description="Choose a client to manage access and weekly Growth Engine reports." />
          ) : (
            <>
              <div className="flex flex-col gap-4 border-b border-white/[0.07] px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-7">
                <div>
                  <h2 className="font-heading text-xl font-black text-text-primary">{selectedClient.fullName}</h2>
                  <p className="mt-1 text-xs text-text-muted">{selectedClient.businessName || "Business details not set"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={toggleAccess}
                    disabled={saving}
                    className={selectedClient.enabled ? "v2-button-secondary" : "v2-button-primary"}
                  >
                    {selectedClient.enabled ? "Lock client access" : "Enable client access"}
                  </button>
                  <button type="button" onClick={startReport} className="v2-button-secondary">New weekly report</button>
                </div>
              </div>

              {!form ? (
                <div className="p-5 lg:p-7">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="v2-section-title">Weekly reports</h3>
                      <p className="mt-1 text-xs text-text-muted">Drafts stay private. Published reports appear only when client access is enabled.</p>
                    </div>
                  </div>
                  {selectedClient.reports.length === 0 ? (
                    <div className="rounded-[var(--cbb-radius-md)] border border-dashed border-white/[0.09]">
                      <EmptyState compact title="No reports yet" description="Create the first weekly update for this client." action={<button type="button" onClick={startReport} className="v2-button-primary">Create report</button>} />
                    </div>
                  ) : (
                    <div className="divide-y divide-white/[0.06] overflow-hidden rounded-[var(--cbb-radius-md)] border border-white/[0.07]">
                      {selectedClient.reports.map((report) => (
                        <button key={report.id} type="button" onClick={() => openReport(report.id)} className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left hover:bg-white/[0.025]">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-bold text-text-primary">{report.title}</div>
                            <div className="mt-1 text-xs text-text-muted">Updated {new Date(report.updated_at).toLocaleDateString("en-GB")}</div>
                          </div>
                          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${
                            report.status === "published"
                              ? "border-emerald-500/25 bg-emerald-500/8 text-emerald-300"
                              : "border-amber-400/25 bg-amber-400/8 text-amber-300"
                          }`}>{report.status}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-3 lg:px-7">
                    <div className="flex rounded-xl bg-black/10 p-1">
                      <button type="button" onClick={() => setMode("edit")} disabled={form.status === "published"} className={`min-h-9 rounded-lg px-4 text-xs font-bold ${mode === "edit" ? "bg-white/[0.08] text-text-primary" : "text-text-muted"} disabled:opacity-40`}>Edit</button>
                      <button type="button" onClick={() => setMode("preview")} className={`min-h-9 rounded-lg px-4 text-xs font-bold ${mode === "preview" ? "bg-white/[0.08] text-text-primary" : "text-text-muted"}`}>Preview</button>
                    </div>
                    <button type="button" onClick={() => { setForm(null); setPublishArmed(false); }} className="text-xs font-bold text-text-muted hover:text-text-primary">Close report</button>
                  </div>

                  {mode === "preview" ? (
                    <div className="p-5 lg:p-7"><ReportView report={formToReport(form)} /></div>
                  ) : (
                    <div className="space-y-6 p-5 lg:p-7">
                      <div>
                        <label className="mb-2 block text-xs font-bold uppercase tracking-[0.1em] text-text-muted">Report title</label>
                        <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Weekly Growth Report — 29 July" className="min-h-11 w-full rounded-xl border border-white/[0.09] bg-white/[0.03] px-4 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent/45" />
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="text-xs font-bold uppercase tracking-[0.1em] text-text-muted">Period start<input type="date" value={form.periodStart} onChange={(event) => setForm({ ...form, periodStart: event.target.value })} className="mt-2 min-h-11 w-full rounded-xl border border-white/[0.09] bg-white/[0.03] px-4 text-sm text-text-primary outline-none focus:border-accent/45" /></label>
                        <label className="text-xs font-bold uppercase tracking-[0.1em] text-text-muted">Period end<input type="date" value={form.periodEnd} onChange={(event) => setForm({ ...form, periodEnd: event.target.value })} className="mt-2 min-h-11 w-full rounded-xl border border-white/[0.09] bg-white/[0.03] px-4 text-sm text-text-primary outline-none focus:border-accent/45" /></label>
                      </div>
                      {([
                        ["executiveSummary", "Executive summary", "Give the client the clearest short version of the week."],
                        ["strategicTakeaway", "Growth Engine read", "What is the one strategic takeaway from this week?"],
                        ["progressUpdate", "What moved forward", "Add one delivery win or useful learning per line."],
                        ["nextPriorities", "What changes next", "Add one action per line. Prefix with Flow State:, Client: or Shared:."],
                      ] as const).map(([field, label, placeholder]) => (
                        <div key={field}>
                          <label className="mb-2 block text-xs font-bold uppercase tracking-[0.1em] text-text-muted">{label}</label>
                          <textarea value={form[field]} onChange={(event) => setForm({ ...form, [field]: event.target.value })} placeholder={placeholder} rows={field === "progressUpdate" || field === "nextPriorities" ? 6 : 4} className="w-full resize-y rounded-xl border border-white/[0.09] bg-white/[0.03] px-4 py-3 text-sm leading-6 text-text-primary outline-none placeholder:text-text-muted focus:border-accent/45" />
                        </div>
                      ))}
                      <section>
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-text-muted">Relevant results</h3>
                            <p className="mt-1 text-xs text-text-muted">Only add measures that are meaningful for this client.</p>
                          </div>
                          <button type="button" onClick={() => setForm({ ...form, metrics: [...form.metrics, { label: "", value: "", change: "", context: "" }] })} disabled={form.metrics.length >= 12} className="v2-button-secondary">Add result</button>
                        </div>
                        <div className="space-y-3">
                          {form.metrics.map((metric, index) => (
                            <div key={index} className="grid gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 sm:grid-cols-2 xl:grid-cols-[1fr_0.6fr_0.55fr_1.1fr_auto]">
                              <input value={metric.label} onChange={(event) => updateMetric(index, "label", event.target.value)} placeholder="Measure" className="min-h-10 rounded-lg border border-white/[0.08] bg-black/10 px-3 text-sm text-text-primary outline-none" />
                              <input value={metric.value} onChange={(event) => updateMetric(index, "value", event.target.value)} placeholder="Value" className="min-h-10 rounded-lg border border-white/[0.08] bg-black/10 px-3 text-sm text-text-primary outline-none" />
                              <input value={metric.change || ""} onChange={(event) => updateMetric(index, "change", event.target.value)} placeholder="Change" aria-label="Week-on-week change" className="min-h-10 rounded-lg border border-white/[0.08] bg-black/10 px-3 text-sm text-text-primary outline-none" />
                              <input value={metric.context || ""} onChange={(event) => updateMetric(index, "context", event.target.value)} placeholder="Context (optional)" className="min-h-10 rounded-lg border border-white/[0.08] bg-black/10 px-3 text-sm text-text-primary outline-none" />
                              <button type="button" onClick={() => setForm({ ...form, metrics: form.metrics.filter((_, metricIndex) => metricIndex !== index) })} className="min-h-10 px-3 text-xs font-bold text-text-muted hover:text-red-300">Remove</button>
                            </div>
                          ))}
                        </div>
                      </section>
                    </div>
                  )}

                  <div className="sticky bottom-[72px] border-t border-white/[0.07] bg-[var(--cbb-surface-1)]/95 px-5 py-4 backdrop-blur-xl lg:bottom-0 lg:px-7">
                    {form.status === "draft" && publishArmed ? (
                      <div className="flex flex-col gap-4 rounded-xl border border-accent/25 bg-accent/[0.08] p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="text-sm font-bold text-text-primary">Publish this report?</div>
                          <p className="mt-1 text-xs leading-5 text-text-muted">
                            The latest edits will be saved first. The report becomes visible and the client is notified only if access is enabled.
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <button type="button" onClick={() => setPublishArmed(false)} disabled={saving} className="v2-button-secondary">Cancel</button>
                          <button type="button" onClick={publishReport} disabled={saving} className="v2-button-primary">{saving ? "Publishing…" : "Confirm publish"}</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-xs text-text-muted">
                          {form.status === "published" ? "Published reports are read-only." : "Drafts are private until published."}
                        </div>
                        {form.status === "draft" && (
                          <div className="flex gap-2">
                            <button type="button" onClick={saveDraft} disabled={saving} className="v2-button-secondary">{saving ? "Saving…" : "Save draft"}</button>
                            <button type="button" onClick={() => setPublishArmed(true)} disabled={saving || !form.id || !form.title.trim()} className="v2-button-primary">Review &amp; publish</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </>
  );
}
