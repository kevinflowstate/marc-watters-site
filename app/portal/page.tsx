"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getNextUpcomingEvent } from "@/lib/demo-calendar";
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

      {/* Next Event */}
      <NextEventCard />

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
              <div key={c.id} className="py-3 border-b border-[rgba(255,255,255,0.04)] last:border-0">
                <div className="flex items-center justify-between">
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
                    {c.admin_reply ? (
                      <span className="text-xs text-accent-bright">Replied</span>
                    ) : (
                      <span className="text-xs text-text-muted">Pending</span>
                    )}
                  </div>
                </div>
                {c.admin_reply && (
                  <div className="mt-2 pl-3 border-l-2 border-accent/30 bg-accent/5 rounded-r-lg py-2 pr-3">
                    <div className="text-[10px] text-accent-bright font-semibold uppercase tracking-wider mb-1">Marc&apos;s Reply</div>
                    <p className="text-xs text-text-secondary leading-relaxed">{c.admin_reply}</p>
                    {c.replied_at && (
                      <div className="text-[10px] text-text-muted mt-1">
                        {new Date(c.replied_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function NextEventCard() {
  const upcoming = getNextUpcomingEvent();

  if (!upcoming) {
    return (
      <div className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-5 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[rgba(255,255,255,0.04)] flex items-center justify-center">
            <svg className="w-5 h-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="text-sm text-text-muted">No upcoming events</span>
        </div>
      </div>
    );
  }

  const { event, nextDate } = upcoming;
  const dayName = nextDate.toLocaleDateString("en-GB", { weekday: "long" });
  const [h, m] = event.event_time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  const timeStr = `${hour}:${m.toString().padStart(2, "0")} ${period}`;

  const recurrenceText: Record<string, string> = {
    weekly: `Every ${dayName}`,
    biweekly: `Every other ${dayName}`,
    monthly: `Monthly`,
    none: formatFullDate(nextDate),
  };

  return (
    <div className="bg-bg-card border border-accent/10 rounded-2xl p-5 mb-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-accent-bright" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <div className="text-xs text-text-muted uppercase tracking-wider mb-0.5">Next Event</div>
            <div className="text-base font-heading font-bold text-text-primary">{event.title}</div>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-sm text-text-secondary">{dayName}, {timeStr}</span>
              <span className="text-xs text-text-muted">{recurrenceText[event.recurrence]}</span>
            </div>
          </div>
        </div>
        {event.link && (
          <a
            href={event.link}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 gradient-accent text-white rounded-xl text-sm font-medium no-underline inline-flex items-center gap-2 hover:opacity-90 transition-opacity flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {event.link_label || "Join"}
          </a>
        )}
      </div>
    </div>
  );
}

function formatFullDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}
