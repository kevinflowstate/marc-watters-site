"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { ClientProfile, TrafficLight } from "@/lib/types";

const statusConfig: Record<TrafficLight, { label: string; bg: string; text: string; dot: string }> = {
  green: { label: "On Track", bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-500" },
  amber: { label: "Needs Attention", bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-500" },
  red: { label: "Behind", bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-500" },
};

export default function ClientsPage() {
  const [clients, setClients] = useState<(ClientProfile & { user?: { full_name: string; email: string } })[]>([]);
  const [filter, setFilter] = useState<TrafficLight | "all">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("client_profiles")
        .select("*, user:users(full_name, email)")
        .order("status");

      if (data) setClients(data);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = filter === "all" ? clients : clients.filter((c) => c.status === filter);

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-heading font-bold text-text-primary">Clients</h1>
          <p className="text-text-secondary mt-1">{clients.length} total clients</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {(["all", "red", "amber", "green"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              filter === f
                ? "bg-[rgba(34,114,222,0.1)] text-accent-bright border border-[rgba(34,114,222,0.2)]"
                : "text-text-muted hover:text-text-secondary border border-[rgba(255,255,255,0.06)]"
            }`}
          >
            {f === "all" ? `All (${clients.length})` : `${statusConfig[f].label} (${clients.filter((c) => c.status === f).length})`}
          </button>
        ))}
      </div>

      {/* Client table */}
      <div className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_auto] gap-4 px-6 py-3 border-b border-[rgba(255,255,255,0.04)] text-xs text-text-muted uppercase tracking-wider">
          <div>Status</div>
          <div>Name</div>
          <div>Business</div>
          <div>Last Check-In</div>
          <div>Last Login</div>
          <div></div>
        </div>
        {loading ? (
          <div className="px-6 py-8 text-text-muted text-sm">Loading clients...</div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-8 text-text-muted text-sm">No clients found.</div>
        ) : (
          filtered.map((client) => {
            const sc = statusConfig[client.status];
            return (
              <Link
                key={client.id}
                href={`/admin/clients/${client.id}`}
                className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_auto] gap-4 px-6 py-4 border-b border-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.02)] transition-colors no-underline items-center"
              >
                <div>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs ${sc.bg} ${sc.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                    {sc.label}
                  </span>
                </div>
                <div>
                  <div className="text-sm font-medium text-text-primary">{client.user?.full_name || "Unknown"}</div>
                  <div className="text-xs text-text-muted">{client.user?.email}</div>
                </div>
                <div className="text-sm text-text-secondary">{client.business_name || "-"}</div>
                <div className="text-sm text-text-secondary">
                  {client.last_checkin
                    ? new Date(client.last_checkin).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                    : "Never"}
                </div>
                <div className="text-sm text-text-secondary">
                  {client.last_login
                    ? new Date(client.last_login).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                    : "Never"}
                </div>
                <div>
                  <svg className="w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </>
  );
}
