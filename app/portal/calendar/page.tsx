"use client";

import { useState, useEffect } from "react";
import type { CalendarEvent, RecurrenceType } from "@/lib/types";

const recurrenceLabels: Record<RecurrenceType, { label: string; color: string }> = {
  none: { label: "One-off", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  weekly: { label: "Weekly", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  biweekly: { label: "Biweekly", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  monthly: { label: "Monthly", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
};

function getNextOccurrence(event: CalendarEvent): Date | null {
  const now = new Date();

  if (event.recurrence === "none") {
    const d = new Date(event.event_date);
    return d > now ? d : null;
  }

  const [hours, minutes] = event.event_time.split(":").map(Number);
  const targetDay = event.recurrence_day ?? 0;

  const next = new Date(now);
  next.setHours(hours, minutes, 0, 0);

  const currentDay = next.getDay();
  let daysUntil = targetDay - currentDay;
  if (daysUntil < 0 || (daysUntil === 0 && next <= now)) {
    daysUntil += 7;
  }
  next.setDate(next.getDate() + daysUntil);

  if (event.recurrence === "biweekly") {
    const start = new Date(event.event_date);
    const weeksDiff = Math.floor((next.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
    if (weeksDiff % 2 !== 0) {
      next.setDate(next.getDate() + 7);
    }
  }

  if (event.recurrence === "monthly") {
    let candidate = new Date(next);
    for (let i = 0; i < 12; i++) {
      const month = (now.getMonth() + i) % 12;
      const year = now.getFullYear() + Math.floor((now.getMonth() + i) / 12);
      const first = new Date(year, month, 1, hours, minutes, 0, 0);
      let dayDiff = targetDay - first.getDay();
      if (dayDiff < 0) dayDiff += 7;
      candidate = new Date(year, month, 1 + dayDiff, hours, minutes, 0, 0);
      if (candidate > now) return candidate;
    }
    return candidate;
  }

  return next;
}

function formatEventDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

export default function PortalCalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/calendar");
        if (res.ok) {
          const data = await res.json();
          setEvents(data.events);
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const upcoming = events
    .map((event) => ({ event, nextDate: getNextOccurrence(event) }))
    .filter((e): e is { event: CalendarEvent; nextDate: Date } => e.nextDate !== null)
    .sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime())
    .slice(0, 10);

  if (loading) {
    return <div className="text-text-muted text-sm">Loading...</div>;
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold text-text-primary">Calendar</h1>
        <p className="text-text-secondary mt-1">Upcoming events and coaching sessions.</p>
      </div>

      <div className="space-y-3">
        {upcoming.length === 0 ? (
          <div className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-8 text-center">
            <svg className="w-12 h-12 text-text-muted mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-text-muted text-sm">No upcoming events.</p>
          </div>
        ) : (
          upcoming.map(({ event, nextDate }) => {
            const rec = recurrenceLabels[event.recurrence];
            return (
              <div key={event.id} className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(255,255,255,0.04)] rounded-2xl p-5 hover:border-[rgba(255,255,255,0.08)] transition-all duration-200">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-xl bg-accent/10 border border-accent/20 flex flex-col items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-semibold text-accent-bright uppercase">
                      {nextDate.toLocaleDateString("en-GB", { month: "short" })}
                    </span>
                    <span className="text-lg font-heading font-bold text-text-primary leading-tight">
                      {nextDate.getDate()}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-base font-heading font-bold text-text-primary">{event.title}</h3>
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold border ${rec.color}`}>
                        {rec.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-text-muted mb-2">
                      <span>{formatEventDate(nextDate)}</span>
                      <span>{formatTime(event.event_time)}</span>
                    </div>
                    {event.description && (
                      <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">{event.description}</p>
                    )}
                  </div>

                  {event.link && (
                    <a href={event.link} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 px-4 py-2.5 gradient-accent text-white rounded-xl text-sm font-medium no-underline inline-flex items-center gap-2 hover:opacity-90 transition-opacity">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      {event.link_label || "Join"}
                    </a>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
