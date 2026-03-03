"use client";

import Link from "next/link";
import { getClientsSorted, getAllRecentCheckins } from "@/lib/demo-data";
import type { TrafficLight, CheckInMood } from "@/lib/types";

const glowClass: Record<TrafficLight, string> = {
  green: "glow-green",
  amber: "glow-amber",
  red: "glow-red",
};

const statusLabel: Record<TrafficLight, { text: string; dotClass: string; bgClass: string; textClass: string }> = {
  red: { text: "Needs Attention", dotClass: "bg-red-500", bgClass: "bg-red-500/10", textClass: "text-red-400" },
  amber: { text: "Check In Due", dotClass: "bg-amber-500", bgClass: "bg-amber-500/10", textClass: "text-amber-400" },
  green: { text: "On Track", dotClass: "bg-emerald-500", bgClass: "bg-emerald-500/10", textClass: "text-emerald-400" },
};

const moodConfig: Record<CheckInMood, { bgClass: string; textClass: string }> = {
  great: { bgClass: "bg-emerald-500/10", textClass: "text-emerald-400" },
  good: { bgClass: "bg-blue-500/10", textClass: "text-blue-400" },
  okay: { bgClass: "bg-amber-500/10", textClass: "text-amber-400" },
  struggling: { bgClass: "bg-red-500/10", textClass: "text-red-400" },
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

export default function AdminDashboard() {
  const clients = getClientsSorted();
  const recentCheckins = getAllRecentCheckins().slice(0, 8);

  const greenCount = clients.filter((c) => c.status === "green").length;
  const amberCount = clients.filter((c) => c.status === "amber").length;
  const redCount = clients.filter((c) => c.status === "red").length;
  const unreplied = recentCheckins.filter((c) => !c.admin_reply).length;

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold text-text-primary">Admin Dashboard</h1>
        <p className="text-text-secondary mt-1">Overview of all clients and activity.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(255,255,255,0.04)] rounded-2xl p-6">
          <div className="text-text-muted text-xs uppercase tracking-wider mb-2">Total Clients</div>
          <div className="text-3xl font-heading font-bold text-text-primary">{clients.length}</div>
        </div>
        <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(16,185,129,0.15)] rounded-2xl p-6">
          <div className="text-text-muted text-xs uppercase tracking-wider mb-2">On Track</div>
          <div className="text-3xl font-heading font-bold text-emerald-400">{greenCount}</div>
        </div>
        <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(245,158,11,0.15)] rounded-2xl p-6">
          <div className="text-text-muted text-xs uppercase tracking-wider mb-2">Needs Attention</div>
          <div className={`text-3xl font-heading font-bold ${amberCount + redCount > 0 ? "text-amber-400" : "text-text-primary"}`}>
            {amberCount + redCount}
          </div>
          {redCount > 0 && (
            <div className="text-red-400 text-xs mt-1">{redCount} behind schedule</div>
          )}
        </div>
        <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(255,255,255,0.04)] rounded-2xl p-6">
          <div className="text-text-muted text-xs uppercase tracking-wider mb-2">Unreplied Check-Ins</div>
          <div className={`text-3xl font-heading font-bold ${unreplied > 0 ? "text-red-400" : "text-text-primary"}`}>
            {unreplied}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6">
        {/* Client cards with glow */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-heading font-bold text-text-primary">Clients</h2>
            <Link href="/admin/clients" className="text-sm text-accent-bright hover:text-accent-light transition-colors no-underline">
              View All
            </Link>
          </div>
          <div className="space-y-3">
            {clients.map((client) => {
              const sl = statusLabel[client.status];
              const planTotal = client.business_plan.length;
              const planDone = client.business_plan.filter((p) => p.completed).length;
              const planPct = planTotal > 0 ? Math.round((planDone / planTotal) * 100) : 0;

              return (
                <Link
                  key={client.id}
                  href={`/admin/clients/${client.id}`}
                  className={`block bg-bg-card/80 backdrop-blur-sm border rounded-2xl p-5 transition-all duration-300 no-underline hover:-translate-y-0.5 ${glowClass[client.status]}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {/* Avatar with glow ring */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${sl.bgClass} ${sl.textClass} border ${
                        client.status === "red" ? "border-red-500/30" : client.status === "amber" ? "border-amber-500/30" : "border-emerald-500/30"
                      }`}>
                        {client.name.split(" ").map((n) => n[0]).join("")}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-text-primary">{client.name}</div>
                        <div className="text-xs text-text-muted">{client.business_name}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${sl.bgClass} ${sl.textClass}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sl.dotClass}`} />
                        {sl.text}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-xs">
                    <div>
                      <div className="text-text-muted mb-1">Week</div>
                      <div className="text-text-primary font-semibold">{client.current_week} of 12</div>
                    </div>
                    <div>
                      <div className="text-text-muted mb-1">Last Check-In</div>
                      <div className={`font-semibold ${
                        new Date().getTime() - new Date(client.last_checkin).getTime() > 7 * 24 * 60 * 60 * 1000
                          ? "text-red-400"
                          : "text-text-primary"
                      }`}>
                        {timeAgo(client.last_checkin)}
                      </div>
                    </div>
                    <div>
                      <div className="text-text-muted mb-1">Plan Progress</div>
                      <div className="text-text-primary font-semibold">{planDone}/{planTotal} ({planPct}%)</div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3 h-1.5 bg-[rgba(255,255,255,0.03)] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        client.status === "red" ? "bg-red-500/60" : client.status === "amber" ? "bg-amber-500/60" : "bg-emerald-500/60"
                      }`}
                      style={{ width: `${planPct}%` }}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Recent check-ins */}
        <div>
          <h2 className="text-lg font-heading font-bold text-text-primary mb-4">Recent Check-Ins</h2>
          <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(255,255,255,0.04)] rounded-2xl p-5">
            <div className="space-y-1">
              {recentCheckins.map((checkin) => {
                const mc = moodConfig[checkin.mood];
                return (
                  <div
                    key={checkin.id}
                    className="flex items-start gap-3 py-3 px-3 rounded-xl hover:bg-[rgba(255,255,255,0.02)] transition-colors"
                  >
                    <span className={`text-[10px] font-semibold px-2 py-1 rounded-full mt-0.5 uppercase tracking-wider ${mc.bgClass} ${mc.textClass}`}>
                      {checkin.mood}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-text-primary">{checkin.client_name}</span>
                        <span className="text-[10px] text-text-muted">Week {checkin.week_number}</span>
                      </div>
                      {checkin.wins && (
                        <p className="text-xs text-text-secondary truncate">{checkin.wins}</p>
                      )}
                      {checkin.questions && !checkin.wins && (
                        <p className="text-xs text-text-secondary truncate">{checkin.questions}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-[10px] text-text-muted">{timeAgo(checkin.created_at)}</span>
                      {checkin.admin_reply ? (
                        <span className="text-[10px] text-emerald-400 font-medium">Replied</span>
                      ) : (
                        <span className="text-[10px] text-amber-400 font-medium">Pending</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
