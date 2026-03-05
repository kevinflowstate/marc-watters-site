"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { AdminClient } from "@/lib/admin-data";
import type { TrafficLight } from "@/lib/types";

const glowClass: Record<TrafficLight, string> = {
  green: "glow-green",
  amber: "glow-amber",
  red: "glow-red",
};

const statusConfig: Record<TrafficLight, { label: string; dotClass: string; bgClass: string; textClass: string }> = {
  red: { label: "Needs Attention", dotClass: "bg-red-500", bgClass: "bg-red-500/10", textClass: "text-red-400" },
  amber: { label: "Check In Due", dotClass: "bg-amber-500", bgClass: "bg-amber-500/10", textClass: "text-amber-400" },
  green: { label: "On Track", dotClass: "bg-emerald-500", bgClass: "bg-emerald-500/10", textClass: "text-emerald-400" },
};

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
  const [filter, setFilter] = useState<TrafficLight | "all">("all");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/clients");
        if (res.ok) {
          const data = await res.json();
          setAllClients(data.clients || []);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <>
        <div className="mb-8">
          <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-8 w-32 mb-2" />
          <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-4 w-40" />
        </div>
        <div className="flex gap-2 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse bg-[rgba(255,255,255,0.04)] rounded-xl h-10 w-24 border border-[rgba(255,255,255,0.06)]" />
          ))}
        </div>
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-bg-card/80 border border-[rgba(255,255,255,0.04)] rounded-2xl p-5 flex items-center gap-4">
              <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-full w-11 h-11" />
              <div className="flex-1 space-y-2">
                <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-4 w-36" />
                <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-3 w-48" />
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  const filtered = filter === "all" ? allClients : allClients.filter((c) => c.status === filter);

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-heading font-bold text-text-primary">Clients</h1>
          <p className="text-text-secondary mt-1">{allClients.length} total clients</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {(["all", "red", "amber", "green"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${
              filter === f
                ? "bg-[rgba(34,114,222,0.1)] text-accent-bright border border-[rgba(34,114,222,0.2)]"
                : "text-text-muted hover:text-text-secondary border border-[rgba(255,255,255,0.06)]"
            }`}
          >
            {f === "all"
              ? `All (${allClients.length})`
              : `${statusConfig[f].label} (${allClients.filter((c) => c.status === f).length})`}
          </button>
        ))}
      </div>

      {/* Client cards */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(255,255,255,0.04)] rounded-2xl px-6 py-8 text-text-muted text-sm">
            No clients found.
          </div>
        ) : (
          filtered.map((client) => {
            const sc = statusConfig[client.status];
            const activePlan = client.business_plan.find((p) => p.status === "active");
            const allItems = activePlan?.phases.flatMap((ph) => ph.items) || [];
            const planTotal = allItems.length;
            const planDone = allItems.filter((p) => p.completed).length;
            const planPct = planTotal > 0 ? Math.round((planDone / planTotal) * 100) : 0;

            return (
              <Link
                key={client.id}
                href={`/admin/clients/${client.id}`}
                className={`group relative block bg-bg-card/80 backdrop-blur-sm border rounded-2xl p-5 overflow-hidden transition-all duration-300 no-underline hover:-translate-y-0.5 cursor-pointer ${glowClass[client.status]}`}
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[length:4px_4px] pointer-events-none" />
                <div className="flex items-center justify-between relative">
                  <div className="flex items-center gap-4">
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold ${sc.bgClass} ${sc.textClass} border ${
                      client.status === "red" ? "border-red-500/30" : client.status === "amber" ? "border-amber-500/30" : "border-emerald-500/30"
                    }`}>
                      {client.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-text-primary">{client.name}</div>
                      <div className="text-xs text-text-muted">{client.business_name} - {client.business_type}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right hidden sm:block">
                      <div className="text-xs text-text-muted">Week {client.current_week}/12</div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="h-1.5 w-20 bg-[rgba(255,255,255,0.03)] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              client.status === "red" ? "bg-red-500/60" : client.status === "amber" ? "bg-amber-500/60" : "bg-emerald-500/60"
                            }`}
                            style={{ width: `${planPct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-text-muted">{planPct}%</span>
                      </div>
                    </div>

                    <div className="text-right hidden md:block">
                      <div className="text-xs text-text-muted">Last Check-In</div>
                      <div className={`text-xs font-medium mt-0.5 ${
                        new Date().getTime() - new Date(client.last_checkin).getTime() > 7 * 24 * 60 * 60 * 1000
                          ? "text-red-400" : "text-text-secondary"
                      }`}>
                        {timeAgo(client.last_checkin)}
                      </div>
                    </div>

                    <div className="text-right hidden md:block">
                      <div className="text-xs text-text-muted">Last Login</div>
                      <div className={`text-xs font-medium mt-0.5 ${
                        new Date().getTime() - new Date(client.last_login).getTime() > 7 * 24 * 60 * 60 * 1000
                          ? "text-red-400" : "text-text-secondary"
                      }`}>
                        {timeAgo(client.last_login)}
                      </div>
                    </div>

                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${sc.bgClass} ${sc.textClass}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${sc.dotClass}`} />
                      {sc.label}
                    </span>

                    <svg className="w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </>
  );
}
