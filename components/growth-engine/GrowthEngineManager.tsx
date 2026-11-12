"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { WsEmpty as EmptyState, WsNotice as InlineNotice, WsPageSkeleton as PageSkeleton } from "@/components/portal/WsState";
import { Chip, Icon } from "@/components/ops/workspace/WorkspaceUI";
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
    <div className="ws ws-page">
      <header className="ws-ph">
        <div className="min-w-0">
          <h1 className="ws-title">CBB Growth Engine</h1>
          <p className="ws-meta mt-1 max-w-2xl">
            Strategy, implementation and weekly reporting for active Growth Engine clients.
          </p>
        </div>
        <div className="ws-ph-acts">
          <Link href="/growth-engine-pricing" className="ws-btn ws-focus">
            <Icon name="external" size={14} />
            View pricing
          </Link>
          <button type="button" onClick={() => setManageOpen(true)} className="ws-btn ws-btn-primary ws-focus">
            <Icon name="plus" size={14} />
            Manage access
          </button>
        </div>
      </header>

      {error && <InlineNotice tone="error" className="">{error}</InlineNotice>}

      <section className="ws-strip" aria-label="Growth Engine portfolio summary">
        <PortfolioMetric label="Active clients" value={totals.active} detail="Currently enrolled" />
        <PortfolioMetric label="Drafts to review" value={totals.drafts} detail={totals.drafts ? "Awaiting your review" : "Queue is clear"} tone={totals.drafts ? "accent" : "default"} />
        <PortfolioMetric label="Published reports" value={totals.published} detail="Across active clients" />
        <PortfolioMetric label="Awaiting first report" value={totals.awaiting} detail={totals.awaiting ? "Workspace needs a report" : "Every client is reporting"} tone={totals.awaiting ? "warning" : "default"} />
      </section>

      <section className="ws-panel">
        <div className="ws-panel-head">
          <div className="min-w-0 ws-ge-head-t">
            <h2 className="ws-h2">Active client portfolio</h2>
            <p className="ws-caption">Open a workspace to review its strategy, delivery milestones, reports and files.</p>
          </div>
          <span className="ws-caption">{activeClients.length} active</span>
        </div>

        {activeClients.length === 0 ? (
          <div>
            <EmptyState
              title="No active Growth Engine clients yet"
              description="When a client joins the offer, add them through Manage access. Only enrolled clients appear in this operating portfolio."
              action={<button type="button" onClick={() => setManageOpen(true)} className="ws-btn ws-btn-primary ws-focus">Add first client</button>}
            />
          </div>
        ) : (
          <div>
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
                  className="ws-row ws-focus ws-ge-row no-underline"
                >
                  <span className="ws-avatar is-md">
                    {initials(client)}
                  </span>
                  <span className="min-w-0">
                    <span className="ws-ge-row-top">
                      <span className="ws-row-title">
                        {client.businessName || client.fullName}
                      </span>
                      {drafts.length > 0 ? (
                        <Chip tone="attn">
                          {drafts.length} draft{drafts.length === 1 ? "" : "s"}
                        </Chip>
                      ) : (
                        <Chip tone="ok">
                          Active
                        </Chip>
                      )}
                    </span>
                    <span className="ws-row-sub">{client.fullName}</span>
                    <span className="ws-row-sub ws-ge-latest">
                      <span className="ws-ge-k">Latest report</span>{" "}
                      {latest?.title || "First report not published yet"}
                    </span>
                  </span>
                  <span className="ws-ge-cols">
                    <span className="ws-ge-metrics">
                      <ClientMetric label="Reports" value={String(published.length)} />
                      <ClientMetric label="Milestones" value={milestones.length ? `${completeMilestones}/${milestones.length}` : "—"} />
                      <ClientMetric label="Files" value={String(client.assets.length)} />
                    </span>
                    <span className="ws-ge-when">
                      <span>{formatDate(latest?.published_at)}</span>
                      <span className="ws-link">Open workspace</span>
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {manageOpen && (
        <div className="ws-overlay ws-ge-overlay" role="dialog" aria-modal="true" aria-label="Manage Growth Engine access">
          <button type="button" className="ws-overlay-bg" onClick={() => setManageOpen(false)} aria-label="Close access manager" />
          <section className="ws-dialog is-wide ws-ge-dialog">
            <header className="ws-dialog-head ws-ge-dialog-head">
              <div className="min-w-0">
                <h2 className="ws-dialog-title">Manage Growth Engine access</h2>
                <p className="ws-caption mt-0.5">Add or remove clients from the offer. Only active clients appear in the delivery portfolio.</p>
              </div>
              <button type="button" onClick={() => setManageOpen(false)} className="ws-btn ws-btn-quiet ws-btn-icon ws-focus" aria-label="Close">
                <Icon name="close" size={16} />
              </button>
            </header>
            <div className="ws-ge-search">
              <label className="ws-cl-search ws-ge-search-l">
                <span className="sr-only">Search CBB clients</span>
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeWidth={1.8} d="m21 21-4.35-4.35m1.35-5.65a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" /></svg>
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search all CBB clients" className="ws-input" />
              </label>
            </div>
            <div className="ws-ge-access">
              {accessClients.map((client) => (
                <div key={client.id} className="ws-ge-access-row">
                  <span className="ws-avatar is-md">{initials(client)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="ws-row-title">{client.businessName || client.fullName}</div>
                    <div className="ws-row-sub">{client.fullName}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleAccess(client)}
                    disabled={savingClientId === client.id}
                    className={client.enabled ? "ws-btn ws-btn-sm ws-focus" : "ws-btn ws-btn-sm ws-btn-primary ws-focus"}
                  >
                    {savingClientId === client.id ? "Saving…" : client.enabled ? "Remove" : "Add client"}
                  </button>
                </div>
              ))}
              {accessClients.length === 0 && <p className="ws-caption ws-ge-none">No CBB clients match that search.</p>}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function PortfolioMetric({ label, value, detail, tone = "default" }: { label: string; value: number; detail: string; tone?: "default" | "accent" | "warning" }) {
  const valueTone = tone === "accent" ? "is-accent" : tone === "warning" ? "is-attn" : "";
  return <div className="ws-stat is-static"><p className="ws-stat-l">{label}</p><p className="ws-stat-n">{value}</p><p className={`ws-stat-s ${valueTone}`}>{detail}</p></div>;
}

function ClientMetric({ label, value }: { label: string; value: string }) {
  return <span className="ws-ge-metric"><span className="ws-ge-metric-l">{label}</span><span className="ws-ge-metric-n">{value}</span></span>;
}
