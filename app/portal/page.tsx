"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ClientProfile, ClientModule, CheckIn } from "@/lib/types";

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-6">
      <div className="text-text-muted text-xs uppercase tracking-wider mb-2">{label}</div>
      <div className="text-2xl font-heading font-bold text-text-primary">{value}</div>
      {sub && <div className="text-text-secondary text-sm mt-1">{sub}</div>}
    </div>
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="w-full bg-[rgba(255,255,255,0.04)] rounded-full h-2">
      <div
        className="h-2 rounded-full gradient-accent transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function PortalDashboard() {
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [modules, setModules] = useState<ClientModule[]>([]);
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [profileRes, modulesRes, checkinsRes] = await Promise.all([
        supabase.from("client_profiles").select("*").eq("user_id", user.id).single(),
        supabase.from("client_modules").select("*, module:training_modules(*)").eq("client_id", user.id),
        supabase.from("checkins").select("*").eq("client_id", user.id).order("created_at", { ascending: false }).limit(5),
      ]);

      if (profileRes.data) setProfile(profileRes.data);
      if (modulesRes.data) setModules(modulesRes.data);
      if (checkinsRes.data) setCheckins(checkinsRes.data);
      setLoading(false);
    }
    load();
  }, []);

  const completedModules = modules.filter((m) => m.status === "completed").length;
  const totalModules = modules.length;
  const currentWeek = checkins.length > 0 ? checkins[0].week_number : 0;

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold text-text-primary">
          {loading ? "Loading..." : `Welcome back${profile?.user?.full_name ? `, ${profile.user.full_name.split(" ")[0]}` : ""}`}
        </h1>
        <p className="text-text-secondary mt-1">Here&apos;s your progress overview.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Modules Completed" value={`${completedModules}/${totalModules}`} sub={totalModules > 0 ? `${Math.round((completedModules / totalModules) * 100)}% complete` : "No modules assigned"} />
        <StatCard label="Current Week" value={`Week ${currentWeek || "-"}`} />
        <StatCard label="Check-Ins Submitted" value={`${checkins.length}`} />
        <StatCard label="Status" value={profile?.status === "green" ? "On Track" : profile?.status === "amber" ? "Needs Attention" : profile?.status === "red" ? "Behind" : "-"} />
      </div>

      {/* Progress */}
      <div className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-6 mb-8">
        <h2 className="text-lg font-heading font-bold text-text-primary mb-4">Overall Progress</h2>
        <ProgressBar value={completedModules} max={totalModules} />
        <div className="flex justify-between mt-2 text-sm text-text-muted">
          <span>{completedModules} completed</span>
          <span>{totalModules - completedModules} remaining</span>
        </div>
      </div>

      {/* Recent check-ins */}
      <div className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-6">
        <h2 className="text-lg font-heading font-bold text-text-primary mb-4">Recent Check-Ins</h2>
        {checkins.length === 0 ? (
          <p className="text-text-muted text-sm">No check-ins yet. Submit your first one to get started.</p>
        ) : (
          <div className="space-y-3">
            {checkins.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-3 border-b border-[rgba(255,255,255,0.04)] last:border-0">
                <div>
                  <span className="text-text-primary text-sm font-medium">Week {c.week_number}</span>
                  <span className="text-text-muted text-sm ml-3">
                    {new Date(c.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    c.mood === "great" ? "bg-emerald-500/10 text-emerald-400" :
                    c.mood === "good" ? "bg-blue-500/10 text-blue-400" :
                    c.mood === "okay" ? "bg-amber-500/10 text-amber-400" :
                    "bg-red-500/10 text-red-400"
                  }`}>
                    {c.mood}
                  </span>
                  {c.admin_reply && (
                    <span className="text-xs text-accent-bright">Replied</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
