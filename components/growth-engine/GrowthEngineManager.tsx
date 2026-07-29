"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EmptyState, InlineNotice, PageSkeleton } from "@/components/ui/PortalState";
import { useToast } from "@/components/ui/Toast";
import type { GrowthAdminClient, GrowthClientsResponse } from "@/lib/growth-engine-admin";

function formatDate(value: string | null | undefined) {
  if (!value) return "Not published yet";
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function initials(client: GrowthAdminClient) {
  return (client.businessName || client.fullName)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default function GrowthEngineManager() {
  const { toast } = useToast();
  const [clients, setClients] = useState<GrowthAdminClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [manageOpen, setManageOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [savingClientId, setSavingClientId] = useState("");

  async function loadClients() {
    setError("");
    const response = await fetch("/api/admin/growth-engine/clients", { cache: "no-store" });
    const data = await response.json().catch(() => null) as GrowthClientsResponse | null;
    if (!response.ok || !data) throw new Error("The Growth Engine portfolio could not be loaded.");
    setClients(Array.isArray(data.clients) ? data.clients : []);
  }

  useEffect(() => {
    loadClients()
      .catch((loadError) => setError((loadError as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const activeClients = useMemo(() => clients.filter((client) => client.enabled), [clients]);
  const accessClients = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return [...clients]
      .sort((a, b) => Number(b.enabled) - Number(a.enabled) || (a.businessName || a.fullName).localeCompare(b.businessName || b.fullName))
      .filter((client) => !normalized || `${client.businessName} ${client.fullName}`.toLowerCase().includes(normalized));
  }, [clients, query]);

  const totals = useMemo(() => {
    const reports = activeClients.flatMap((client) => client.reports);
    return {
      active: activeClients.length,
      drafts: reports.filter((report) => report.status === "draft").length,
      published: reports.filter((report) => report.status === "published").length,
      awaiting: activeClients.filter((client) => !client.reports.some((report) => report.status === "published")).length,
    };
  }, [activeClients]);

  async function toggleAccess(client: GrowthAdminClient) {
    setSavingClientId(client.id);
    try {
      const response = await fetch(`/api/admin/growth-engine/clients/${client.id}/entitlement`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !client.enabled }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Access could not be updated.");
      await loadClients();
      toast(client.enabled ? "Client removed from Growth Engine" : "Client added to Growth Engine");
    } catch (toggleError) {
      toast((toggleError as Error).message, "error");
    } finally {
      setSavingClientId("");
    }
  }

  if (loading) return <PageSkeleton rows={6} />;

  return (
    <>
      <header className="mb-7 sm:mb-9">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="v2-eyebrow mb-3">AI growth delivery</div>
            <h1 className="v2-page-title">CBB Growth Engine</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
              Strategy, implementation and weekly reporting for active Growth Engine clients.
            </p>
          </div>
          <button type="button" onClick={() => setManageOpen(true)} className="v2-button-secondary">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M12 5v14M5 12h14" />
            </svg>
            Manage access
          </button>
        </div>
      </header>

      {error && <InlineNotice tone="error" className="mb-5">{error}</InlineNotice>}

      <section className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--cbb-radius-lg)] border border-white/[0.07] bg-white/[0.07] lg:grid-cols-4" aria-label="Growth Engine portfolio summary">
        <PortfolioMetric label="Active clients" value={totals.active} detail="Currently enrolled" />
        <PortfolioMetric label="Drafts to review" value={totals.drafts} detail={totals.drafts ? "Awaiting your review" : "Queue is clear"} tone={totals.drafts ? "accent" : "default"} />
        <PortfolioMetric label="Published reports" value={totals.published} detail="Across active clients" />
        <PortfolioMetric label="Awaiting first report" value={totals.awaiting} detail={totals.awaiting ? "Workspace needs a report" : "Every client is reporting"} tone={totals.awaiting ? "warning" : "default"} />
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="v2-section-title">Active client portfolio</h2>
            <p className="mt-1 text-xs text-text-muted">Open a workspace to review its strategy, delivery milestones, reports and files.</p>
          </div>
          <span className="text-xs font-semibold text-text-muted">{activeClients.length} active</span>
        </div>

        {activeClients.length === 0 ? (
          <div className="v2-surface">
            <EmptyState
              title="No active Growth Engine clients yet"
              description="When a client joins the offer, add them through Manage access. Only enrolled clients appear in this operating portfolio."
              action={<button type="button" onClick={() => setManageOpen(true)} className="v2-button-primary">Add first client</button>}
            />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {activeClients.map((client) => {
              const published = client.reports.filter((report) => report.status === "published");
              const drafts = client.reports.filter((report) => report.status === "draft");
              const latest = published[0];
              const milestones = Array.isArray(client.workspace?.implementation_milestones)
                ? client.workspace.implementation_milestones
                : [];
              const completeMilestones = milestones.filter((milestone) => milestone.status === "complete").length;
              return (
                <Link
                  key={client.id}
                  href={`/admin/growth-engine/${client.id}`}
                  className="group v2-surface block overflow-hidden no-underline transition-colors hover:border-accent/30"
                >
                  <div className="p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-accent/20 bg-accent/8 text-sm font-black text-accent-bright">
                          {initials(client)}
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate font-heading text-lg font-black text-text-primary group-hover:text-accent-bright">
                            {client.businessName || client.fullName}
                          </h3>
                          <p className="mt-0.5 truncate text-xs text-text-muted">{client.fullName}</p>
                        </div>
                      </div>
                      {drafts.length > 0 ? (
                        <span className="shrink-0 rounded-full border border-amber-400/25 bg-amber-400/8 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-amber-300">
                          {drafts.length} draft{drafts.length === 1 ? "" : "s"}
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full border border-emerald-500/25 bg-emerald-500/8 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-emerald-300">
                          Active
                        </span>
                      )}
                    </div>

                    <div className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.07]">
                      <ClientMetric label="Reports" value={String(published.length)} />
                      <ClientMetric label="Milestones" value={milestones.length ? `${completeMilestones}/${milestones.length}` : "—"} />
                      <ClientMetric label="Files" value={String(client.assets.length)} />
                    </div>

                    <div className="mt-5 border-t border-white/[0.07] pt-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">Latest report</p>
                      <p className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-text-primary">
                        {latest?.title || "First report not published yet"}
                      </p>
                      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-text-muted">
                        <span>{formatDate(latest?.published_at)}</span>
                        <span className="font-bold text-accent-bright">Open workspace →</span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {manageOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Manage Growth Engine access">
          <button type="button" className="absolute inset-0" onClick={() => setManageOpen(false)} aria-label="Close access manager" />
          <section className="relative flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[var(--cbb-radius-lg)] border border-white/[0.1] bg-[var(--cbb-surface-1)] shadow-2xl sm:rounded-[var(--cbb-radius-lg)]">
            <header className="flex items-start justify-between gap-4 border-b border-white/[0.07] px-5 py-5 sm:px-6">
              <div>
                <h2 className="font-heading text-xl font-black text-text-primary">Manage Growth Engine access</h2>
                <p className="mt-1 text-xs leading-5 text-text-muted">Add or remove clients from the offer. Only active clients appear in the delivery portfolio.</p>
              </div>
              <button type="button" onClick={() => setManageOpen(false)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-text-muted hover:bg-white/[0.05] hover:text-text-primary" aria-label="Close">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={1.7} d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </header>
            <div className="border-b border-white/[0.07] p-4 sm:px-6">
              <label className="relative block">
                <span className="sr-only">Search CBB clients</span>
                <svg className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={1.7} d="m21 21-4.35-4.35m1.35-5.65a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" /></svg>
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search all CBB clients" className="min-h-11 w-full rounded-xl border border-white/[0.09] bg-white/[0.03] py-2 pl-10 pr-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent/45" />
              </label>
            </div>
            <div className="min-h-0 flex-1 divide-y divide-white/[0.06] overflow-y-auto">
              {accessClients.map((client) => (
                <div key={client.id} className="flex items-center gap-4 px-5 py-4 sm:px-6">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-xs font-black text-text-secondary">{initials(client)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-text-primary">{client.businessName || client.fullName}</div>
                    <div className="mt-0.5 truncate text-xs text-text-muted">{client.fullName}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleAccess(client)}
                    disabled={savingClientId === client.id}
                    className={client.enabled ? "v2-button-secondary" : "v2-button-primary"}
                  >
                    {savingClientId === client.id ? "Saving…" : client.enabled ? "Remove" : "Add client"}
                  </button>
                </div>
              ))}
              {accessClients.length === 0 && <p className="px-6 py-12 text-center text-sm text-text-muted">No CBB clients match that search.</p>}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function PortfolioMetric({ label, value, detail, tone = "default" }: { label: string; value: number; detail: string; tone?: "default" | "accent" | "warning" }) {
  const valueTone = tone === "accent" ? "text-accent-bright" : tone === "warning" ? "text-amber-300" : "text-text-primary";
  return <div className="bg-[var(--cbb-surface-1)] px-4 py-5 sm:px-5"><p className="text-xs text-text-muted">{label}</p><p className={`mt-2 font-heading text-3xl font-black tracking-[-0.04em] ${valueTone}`}>{value}</p><p className="mt-1 text-[11px] text-text-muted">{detail}</p></div>;
}

function ClientMetric({ label, value }: { label: string; value: string }) {
  return <div className="bg-[var(--cbb-surface-1)] px-3 py-3"><p className="text-[9px] font-bold uppercase tracking-[0.1em] text-text-muted">{label}</p><p className="mt-1 text-sm font-black text-text-primary">{value}</p></div>;
}
