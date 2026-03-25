"use client";

import { useState, useEffect, useCallback } from "react";
import type { CalendarEvent, RecurrenceType } from "@/lib/types";

const recurrenceLabels: Record<RecurrenceType, { label: string; color: string }> = {
  none: { label: "One-off", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  weekly: { label: "Weekly", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  biweekly: { label: "Biweekly", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  monthly: { label: "Monthly", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
};

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

function getEventDates(event: CalendarEvent, year: number, month: number): Date[] {
  const dates: Date[] = [];
  const baseDate = new Date(event.event_date);

  if (event.recurrence === "none") {
    if (baseDate.getFullYear() === year && baseDate.getMonth() === month) {
      dates.push(baseDate);
    }
    return dates;
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    if (event.recurrence === "weekly" && d.getDay() === (event.recurrence_day ?? baseDate.getDay())) {
      if (d >= baseDate) dates.push(d);
    } else if (event.recurrence === "biweekly" && d.getDay() === (event.recurrence_day ?? baseDate.getDay())) {
      const diffWeeks = Math.round((d.getTime() - baseDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
      if (diffWeeks >= 0 && diffWeeks % 2 === 0) dates.push(d);
    } else if (event.recurrence === "monthly" && d.getDate() === baseDate.getDate()) {
      if (d >= baseDate) dates.push(d);
    }
  }
  return dates;
}

function getNextOccurrence(event: CalendarEvent): Date | null {
  const now = new Date();
  const baseDate = new Date(event.event_date);

  if (event.recurrence === "none") {
    return baseDate >= now ? baseDate : null;
  }

  for (let i = 0; i < 60; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const targetDay = event.recurrence_day ?? baseDate.getDay();

    if (event.recurrence === "weekly" && d.getDay() === targetDay && d >= baseDate) return d;
    if (event.recurrence === "biweekly" && d.getDay() === targetDay && d >= baseDate) {
      const diffWeeks = Math.round((d.getTime() - baseDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
      if (diffWeeks % 2 === 0) return d;
    }
    if (event.recurrence === "monthly" && d.getDate() === baseDate.getDate() && d >= baseDate) return d;
  }
  return null;
}

export default function PortalCalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const loadEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/calendar");
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch { /* */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const activeEvents = events.filter(e => e.is_active);

  // Up next
  const upNext = activeEvents
    .map(e => ({ event: e, next: getNextOccurrence(e) }))
    .filter(x => x.next !== null)
    .sort((a, b) => a.next!.getTime() - b.next!.getTime())[0] || null;

  // Build calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const dayEventsMap = new Map<string, CalendarEvent[]>();
  for (const event of activeEvents) {
    const dates = getEventDates(event, viewYear, viewMonth);
    for (const d of dates) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!dayEventsMap.has(key)) dayEventsMap.set(key, []);
      dayEventsMap.get(key)!.push(event);
    }
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  }

  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const selectedEvents = selectedDay ? (dayEventsMap.get(selectedDay) || []) : [];

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-8 w-48 mb-6" />
        <div className="animate-pulse bg-[rgba(255,255,255,0.04)] rounded-2xl h-20 mb-4" />
        <div className="animate-pulse bg-[rgba(255,255,255,0.04)] rounded-2xl h-80" />
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-heading font-bold text-text-primary">Calendar</h1>
        <p className="text-text-secondary mt-1 text-sm">Upcoming events and coaching sessions.</p>
      </div>

      {/* Up Next card */}
      {upNext && (
        <div className="bg-bg-card/80 backdrop-blur-sm border border-accent/15 rounded-2xl p-5 mb-6">
          <div className="text-[10px] font-semibold text-accent-bright uppercase tracking-wider mb-2">Up Next</div>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-heading font-bold text-text-primary">{upNext.event.title}</h3>
              <div className="flex items-center gap-3 text-xs text-text-muted mt-1">
                <span>
                  {upNext.next!.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
                </span>
                <span>{formatTime(upNext.event.event_time)}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${recurrenceLabels[upNext.event.recurrence].color}`}>
                  {recurrenceLabels[upNext.event.recurrence].label}
                </span>
              </div>
            </div>
            {upNext.event.link && (
              <a
                href={upNext.event.link}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 gradient-accent text-white rounded-xl text-sm font-medium no-underline inline-flex items-center gap-2 hover:opacity-90 transition-opacity"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                {upNext.event.link_label || "Join"}
              </a>
            )}
          </div>
        </div>
      )}

      {/* Calendar grid */}
      <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(255,255,255,0.04)] rounded-2xl overflow-hidden mb-6">
        {/* Month navigation */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.04)]">
          <button onClick={prevMonth} className="p-2 text-text-muted hover:text-text-primary transition-colors rounded-lg hover:bg-white/5 cursor-pointer">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-sm font-heading font-bold text-text-primary">
            {monthNames[viewMonth]} {viewYear}
          </h2>
          <button onClick={nextMonth} className="p-2 text-text-muted hover:text-text-primary transition-colors rounded-lg hover:bg-white/5 cursor-pointer">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-[rgba(255,255,255,0.04)]">
          {dayNames.map((d) => (
            <div key={d} className="text-center py-2 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="h-20 border-b border-r border-[rgba(255,255,255,0.02)] bg-[rgba(0,0,0,0.15)]" />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const key = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
            const isToday = key === todayKey;
            const isSelected = key === selectedDay;
            const dayEvents = dayEventsMap.get(key) || [];
            const hasEvents = dayEvents.length > 0;

            return (
              <button
                key={key}
                onClick={() => setSelectedDay(isSelected ? null : key)}
                className={`h-20 border-b border-r border-[rgba(255,255,255,0.02)] p-1.5 text-left transition-all cursor-pointer relative ${
                  isSelected ? "bg-accent/10 border-accent/20" : hasEvents ? "hover:bg-[rgba(255,255,255,0.03)]" : "hover:bg-[rgba(255,255,255,0.02)]"
                }`}
              >
                <span className={`text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full ${
                  isToday ? "bg-accent text-white" : "text-text-secondary"
                }`}>
                  {dayNum}
                </span>
                {dayEvents.length > 0 && (
                  <div className="mt-0.5 space-y-0.5">
                    {dayEvents.slice(0, 2).map((ev) => (
                      <div
                        key={ev.id}
                        className="text-[9px] leading-tight px-1 py-0.5 rounded bg-accent/15 text-accent-bright truncate"
                      >
                        {ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-[9px] text-text-muted px-1">+{dayEvents.length - 2} more</div>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day detail */}
      {selectedDay && (
        <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(255,255,255,0.04)] rounded-2xl p-5 mb-6">
          <h3 className="text-sm font-heading font-bold text-text-primary mb-3">
            {new Date(selectedDay + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </h3>
          {selectedEvents.length === 0 ? (
            <p className="text-xs text-text-muted">No events on this day.</p>
          ) : (
            <div className="space-y-2">
              {selectedEvents.map((ev) => (
                <div key={ev.id} className="flex items-center justify-between bg-bg-primary/50 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                      <svg className="w-4 h-4 text-accent-bright" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-text-primary">{ev.title}</div>
                      <div className="text-xs text-text-muted">{formatTime(ev.event_time)}</div>
                      {ev.description && (
                        <p className="text-xs text-text-secondary mt-1">{ev.description}</p>
                      )}
                    </div>
                  </div>
                  {ev.link && (
                    <a
                      href={ev.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 gradient-accent text-white rounded-lg text-xs font-semibold no-underline inline-flex items-center gap-1.5 hover:opacity-90 transition-opacity"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      {ev.link_label || "Join"}
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
