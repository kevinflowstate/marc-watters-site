"use client";
import { initials } from "@/lib/initials";

import { useState, useEffect, type CSSProperties } from "react";
import Link from "next/link";
import { Chip, Empty, Icon, SkeletonRows } from "@/components/ops/workspace/WorkspaceUI";
import type { AdminClient } from "@/lib/admin-data";
import type { TrafficLight } from "@/lib/types";

const statusConfig: Record<TrafficLight, { label: string; tone: "bad" | "attn" | "ok"; colour: string; note: string }> = {
  red: { label: "Gone quiet", tone: "bad", colour: "var(--ws-bad)", note: "no activity for 14+ days" },
  amber: { label: "Behind", tone: "attn", colour: "var(--ws-attn)", note: "still active, missed a round" },
  green: { label: "On track", tone: "ok", colour: "var(--ws-ok)", note: "checked in and active" },
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

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

export default function ClientsPage() {
  const [allClients, setAllClients] = useState<AdminClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TrafficLight | "all">("all");
  const [lifecycle, setLifecycle] = useState<"active" | "archived">("active");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"attention" | "name" | "recent">("attention");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ success: boolean; alreadyExisted?: boolean; emailSent?: boolean; passwordSet?: boolean; setupUrl?: string; error?: string } | null>(null);

  async function loadClients() {
    setLoadError(null);
    try {
      const res = await fetch("/api/admin/clients?includeArchived=true");
      if (res.ok) {
        const data = await res.json();
        setAllClients(data.clients || []);
      } else {
        throw new Error("Could not load clients.");
      }
    } catch {
      setLoadError("Could not load clients. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadClients(); }, []);

  if (loading) {
    return (
      <div className="ws ws-page">
        <div>
          <span className="ws-skel" style={{ width: 140, height: 22 }} />
          <span className="ws-skel mt-2" style={{ width: 180, height: 12 }} />
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

  const activeClients = allClients.filter((client) => !client.archived_at);
  const archivedClients = allClients.filter((client) => Boolean(client.archived_at));
  const lifecycleClients = lifecycle === "active" ? activeClients : archivedClients;
  const lifecycleFiltered = lifecycle === "archived" || filter === "all"
    ? lifecycleClients
    : lifecycleClients.filter((client) => client.status === filter);
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = lifecycleFiltered
    .filter((client) => {
      if (!normalizedQuery) return true;
      return [client.name, client.email, client.business_name, client.business_type]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    })
    .sort((first, second) => {
      if (sort === "name") return first.name.localeCompare(second.name);
      if (sort === "recent") return new Date((second.health?.last_active_at || second.last_login)).getTime() - new Date((first.health?.last_active_at || first.last_login)).getTime();
      const attentionRank: Record<TrafficLight, number> = { red: 0, amber: 1, green: 2 };
      return attentionRank[first.status] - attentionRank[second.status] || first.name.localeCompare(second.name);
    });

  return (
    <div className="ws ws-page">
      <div className="ws-ph">
        <div className="min-w-0">
          <h1 className="ws-title">Clients</h1>
          <p className="ws-meta mt-1">{activeClients.length} active · {archivedClients.length} archived</p>
        </div>
        <div className="ws-ph-acts">
          <button
            type="button"
            onClick={() => { setInviteOpen(true); setInviteResult(null); setInviteName(""); setInviteEmail(""); setInvitePassword(""); }}
            className="ws-btn ws-btn-primary ws-focus"
          >
            <Icon name="plus" size={14} />
            Add client
          </button>
        </div>
      </div>

      {/* Add Client Modal */}
      {inviteOpen && (
        <div className="ws-overlay">
          <div className="ws-overlay-bg" />
          <div className="ws-dialog" role="dialog" aria-modal="true" aria-label="Add client">
            <div className="ws-dialog-head">
              <div className="min-w-0">
                <h3 className="ws-dialog-title">Add client</h3>
                <p className="ws-caption mt-0.5">They&apos;ll receive an activation email for their portal account</p>
              </div>
            </div>

            {inviteResult?.success ? (
              <div className="ws-dialog-body">
                <div className="ws-note is-ok" role="status">
                  <Icon name="checkCircle" size={15} />
                  <span>
                    {inviteResult.passwordSet
                      ? "Client added - password set, ready to log in"
                      : inviteResult.alreadyExisted
                        ? inviteResult.emailSent
                          ? "Password reset email sent"
                          : "Client found - reset link ready"
                        : inviteResult.emailSent
                          ? "Client added and email sent"
                          : "Client added"}
                  </span>
                </div>
                {!inviteResult.passwordSet && !inviteResult.emailSent && inviteResult.setupUrl && (
                  <div>
                    <p className="ws-caption mb-2" style={{ color: "var(--ws-attn)" }}>Email couldn&apos;t be sent. Share this {inviteResult.alreadyExisted ? "reset" : "activation"} link manually:</p>
                    <p className="ws-original select-all" style={{ maxHeight: 120 }}>{inviteResult.setupUrl}</p>
                  </div>
                )}
                <div className="ws-dialog-foot">
                  <button
                    type="button"
                    onClick={() => { setInviteOpen(false); loadClients(); }}
                    className="ws-btn ws-btn-primary ws-focus"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <div className="ws-dialog-body">
                {inviteResult?.error && (
                  <div className="ws-note is-bad" role="alert">
                    <Icon name="alert" size={15} />
                    <span>{inviteResult.error}</span>
                  </div>
                )}
                <div>
                  <label className="ws-label" htmlFor="invite-name">Full name</label>
                  <input
                    id="invite-name"
                    type="text"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="e.g. James McConnell"
                    className="ws-input"
                  />
                </div>
                <div>
                  <label className="ws-label" htmlFor="invite-email">Email address</label>
                  <input
                    id="invite-email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="e.g. james@example.com"
                    className="ws-input"
                  />
                </div>
                <div>
                  <label className="ws-label" htmlFor="invite-password">Set password <span>(optional - or they set via email)</span></label>
                  <input
                    id="invite-password"
                    type="password"
                    value={invitePassword}
                    onChange={(e) => setInvitePassword(e.target.value)}
                    placeholder="Min 8 characters"
                    className="ws-input"
                  />
                </div>
                <div className="ws-dialog-foot">
                  <button
                    type="button"
                    onClick={() => setInviteOpen(false)}
                    className="ws-btn ws-btn-quiet ws-focus"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!inviteName.trim() || !inviteEmail.trim() || inviteSending}
                    onClick={async () => {
                      setInviteSending(true);
                      setInviteResult(null);
                      try {
                        const res = await fetch("/api/admin/invite-client", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ name: inviteName, email: inviteEmail, ...(invitePassword.trim() ? { password: invitePassword.trim() } : {}) }),
                        });
                        const data = await res.json();
                        if (res.ok) {
                          setInviteResult({ success: true, alreadyExisted: data.alreadyExisted, emailSent: data.emailSent, passwordSet: data.passwordSet, setupUrl: data.setupUrl });
                        } else {
                          setInviteResult({ success: false, error: data.error });
                        }
                      } catch {
                        setInviteResult({ success: false, error: "Something went wrong" });
                      } finally {
                        setInviteSending(false);
                      }
                    }}
                    className="ws-btn ws-btn-primary ws-focus"
                  >
                    {inviteSending ? (
                      <>
                        <Icon name="refresh" size={14} className="ws-spin" />
                        Adding...
                      </>
                    ) : "Add client"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {loadError && (
        <div className="ws-note is-bad" role="alert">
          <Icon name="alert" size={15} />
          <span className="flex-1">{loadError}</span>
          <button type="button" onClick={() => void loadClients()} className="ws-link">Retry</button>
        </div>
      )}

      {/* Status filters (active clients only): each cell filters the list below. */}
      {lifecycle === "active" && (
        <div className="ws-strip" aria-label="Filter clients by status">
          {(["all", "red", "amber", "green"] as const).map((f) => {
            const count = f === "all" ? activeClients.length : activeClients.filter((c) => c.status === f).length;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className="ws-stat ws-cl-stat ws-focus"
              >
                <span className="ws-stat-l">
                  {f === "all" ? <Icon name="users" size={14} /> : <span className="ws-dot" style={{ color: statusConfig[f].colour }} />}
                  {f === "all" ? "All" : statusConfig[f].label}
                </span>
                <span className="ws-stat-n">{count}</span>
                <span className="ws-stat-s">{f === "all" ? "active clients" : statusConfig[f].note}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="ws-cl-toolbar">
        <label className="ws-cl-search">
          <span className="sr-only">Search clients</span>
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="m21 21-4.35-4.35m2.35-5.65a8 8 0 11-16 0 8 8 0 0116 0z" /></svg>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, business or email"
            className="ws-input"
          />
        </label>
        <label className="ws-cl-sort">
          <span className="ws-caption shrink-0">Sort by</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as typeof sort)}
            className="ws-input"
          >
            <option value="attention">Needs attention</option>
            <option value="recent">Recent login</option>
            <option value="name">Client name</option>
          </select>
        </label>
        <span className="ws-cl-grow" />
        <div role="group" aria-label="Active or archived clients" className="ws-seg">
          {(["active", "archived"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setLifecycle(value)}
              aria-pressed={lifecycle === value}
              className="ws-seg-btn ws-focus"
            >
              {value === "active" ? "Active" : "Archived"}
              <span className="ws-seg-count">{value === "active" ? activeClients.length : archivedClients.length}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Client rows */}
      <section className="ws-panel min-w-0" aria-label="Clients">
        <div className="ws-panel-head">
          <h2 className="ws-h2">{lifecycle === "active" ? "Active clients" : "Archived clients"}</h2>
          <span className="ws-caption">{filtered.length}</span>
        </div>
        <div>
          {filtered.length === 0 ? (
            <Empty
              icon="users"
              title={normalizedQuery ? "No matching clients" : lifecycle === "archived" ? "No archived clients" : "No clients in this view"}
              text={normalizedQuery ? "Try a different name, business or email address." : lifecycle === "archived" ? "Clients you archive will remain available here for viewing and export." : "Change the status filter to see the rest of your clients."}
            />
          ) : (
            filtered.map((client) => {
              const isArchived = Boolean(client.archived_at);
              const sc = statusConfig[client.status];
              const activePlans = client.business_plan.filter((p) => p.status === "active");
              const allItems = activePlans.flatMap((plan) => plan.phases.flatMap((ph) => ph.items));
              const planTotal = allItems.length;
              const planDone = allItems.filter((p) => p.completed).length;
              const planPct = planTotal > 0 ? Math.round((planDone / planTotal) * 100) : 0;
              const lastActive = client.health?.last_active_at || client.last_login;

              return (
                <Link
                  key={client.id}
                  href={`/admin/clients/${client.id}`}
                  className="ws-row ws-cl-row ws-focus"
                >
                  <span className="ws-avatar is-md" aria-hidden="true">
                    {initials(client.name)}
                  </span>
                  <span className="min-w-0">
                    <span className="ws-row-title">{client.name}</span>
                    <span className="ws-row-sub">
                      {client.business_name}{client.business_type ? ` · ${client.business_type}` : ""}
                      {isArchived && client.archived_at ? `${client.business_name || client.business_type ? " · " : ""}Archived ${new Date(client.archived_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : ""}
                    </span>
                  </span>
                  <span className="ws-row-meta">
                    {!isArchived && (
                      <span className="ws-cl-col is-sm">
                        <span>Week {client.current_week}/12</span>
                        <span className="ws-cl-prog">
                          <span className="ws-bar" style={{ "--c": sc.colour } as CSSProperties}>
                            <i style={{ width: `${planPct}%` }} />
                          </span>
                          <span className="ws-pct">{planPct}%</span>
                        </span>
                      </span>
                    )}
                    {!isArchived && (
                      <span className="ws-cl-col is-md">
                        <span>Last check-in</span>
                        <b className={new Date().getTime() - new Date(client.last_checkin).getTime() > WEEK_MS ? "is-bad" : ""}>
                          {timeAgo(client.last_checkin)}
                        </b>
                      </span>
                    )}
                    {!isArchived && (
                      <span className="ws-cl-col is-md">
                        <span>Last active</span>
                        <b className={new Date().getTime() - new Date(lastActive).getTime() > WEEK_MS ? "is-bad" : ""}>
                          {timeAgo(lastActive)}
                        </b>
                      </span>
                    )}
                    <span className="ws-cl-status">
                      {isArchived ? <Chip>Archived</Chip> : <Chip tone={sc.tone}>{client.health?.label ?? sc.label}</Chip>}
                    </span>
                    <Icon name="chevron" size={14} className="ws-chev" />
                  </span>
                </Link>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
