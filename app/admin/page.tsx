"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { ClientProfile, CheckIn } from "@/lib/types";

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-6">
      <div className="text-text-muted text-xs uppercase tracking-wider mb-2">{label}</div>
      <div className={`text-3xl font-heading font-bold ${color || "text-text-primary"}`}>{value}</div>
      {sub && <div className="text-text-secondary text-sm mt-1">{sub}</div>}
    </div>
  );
}

const statusColors = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
};

export default function AdminDashboard() {
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [recentCheckins, setRecentCheckins] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const [clientsRes, checkinsRes] = await Promise.all([
        supabase.from("client_profiles").select("*, user:users(full_name, email)"),
        supabase.from("checkins").select("*, client:client_profiles(*, user:users(full_name))").order("created_at", { ascending: false }).limit(10),
      ]);

      if (clientsRes.data) setClients(clientsRes.data);
      if (checkinsRes.data) setRecentCheckins(checkinsRes.data);
      setLoading(false);
    }
    load();
  }, []);

  const greenCount = clients.filter((c) => c.status === "green").length;
  const amberCount = clients.filter((c) => c.status === "amber").length;
  const redCount = clients.filter((c) => c.status === "red").length;
  const unrepliedCheckins = recentCheckins.filter((c) => !c.admin_reply).length;

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold text-text-primary">Admin Dashboard</h1>
        <p className="text-text-secondary mt-1">Overview of all clients and activity.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Clients" value={`${clients.length}`} />
        <StatCard label="On Track" value={`${greenCount}`} color="text-emerald-400" />
        <StatCard label="Needs Attention" value={`${amberCount + redCount}`} color={amberCount + redCount > 0 ? "text-amber-400" : "text-text-primary"} />
        <StatCard label="Unreplied Check-Ins" value={`${unrepliedCheckins}`} color={unrepliedCheckins > 0 ? "text-red-400" : "text-text-primary"} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Client list */}
        <div className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-heading font-bold text-text-primary">Clients</h2>
            <Link href="/admin/clients" className="text-sm text-accent-bright hover:text-accent-light transition-colors no-underline">
              View All
            </Link>
          </div>
          {loading ? (
            <div className="text-text-muted text-sm">Loading...</div>
          ) : clients.length === 0 ? (
            <div className="text-text-muted text-sm">No clients yet.</div>
          ) : (
            <div className="space-y-2">
              {clients.slice(0, 8).map((client) => (
                <Link
                  key={client.id}
                  href={`/admin/clients/${client.id}`}
                  className="flex items-center justify-between py-3 px-3 rounded-xl hover:bg-[rgba(255,255,255,0.02)] transition-colors no-underline"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${statusColors[client.status]}`} />
                    <div>
                      <div className="text-sm font-medium text-text-primary">{(client as ClientProfile & { user?: { full_name: string } }).user?.full_name || "Unknown"}</div>
                      <div className="text-xs text-text-muted">{client.business_name || "No business"}</div>
                    </div>
                  </div>
                  <div className="text-xs text-text-muted">
                    {client.last_checkin
                      ? new Date(client.last_checkin).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                      : "No check-in"}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent check-ins */}
        <div className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-6">
          <h2 className="text-lg font-heading font-bold text-text-primary mb-4">Recent Check-Ins</h2>
          {loading ? (
            <div className="text-text-muted text-sm">Loading...</div>
          ) : recentCheckins.length === 0 ? (
            <div className="text-text-muted text-sm">No check-ins yet.</div>
          ) : (
            <div className="space-y-2">
              {recentCheckins.map((checkin) => {
                const clientData = checkin as CheckIn & { client?: { user?: { full_name: string } } };
                return (
                  <div key={checkin.id} className="flex items-center justify-between py-3 px-3 rounded-xl">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        checkin.mood === "great" ? "bg-emerald-500/10 text-emerald-400" :
                        checkin.mood === "good" ? "bg-blue-500/10 text-blue-400" :
                        checkin.mood === "okay" ? "bg-amber-500/10 text-amber-400" :
                        "bg-red-500/10 text-red-400"
                      }`}>
                        {checkin.mood}
                      </span>
                      <div>
                        <div className="text-sm font-medium text-text-primary">{clientData.client?.user?.full_name || "Unknown"}</div>
                        <div className="text-xs text-text-muted">Week {checkin.week_number}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {checkin.admin_reply ? (
                        <span className="text-xs text-emerald-400">Replied</span>
                      ) : (
                        <span className="text-xs text-amber-400">Pending</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
