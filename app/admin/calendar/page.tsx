"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatFileSize, guessAttachmentType } from "@/lib/attachments";
import type { Attachment, CalendarEvent, RecurrenceType } from "@/lib/types";

const recurrenceLabels: Record<RecurrenceType, { label: string; color: string }> = {
  none: { label: "One-off", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  weekly: { label: "Weekly", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  biweekly: { label: "Biweekly", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  monthly: { label: "Monthly", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
};

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayNamesFull = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Get all occurrences of an event in a given month
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

// Get next upcoming occurrence of an event
function getNextOccurrence(event: CalendarEvent): Date | null {
  const now = new Date();
  const baseDate = new Date(event.event_date);

  if (event.recurrence === "none") {
    return baseDate >= now ? baseDate : null;
  }

  // Check next 60 days
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

export default function AdminCalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Calendar navigation
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  // New event form
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("19:00");
  const [newRecurrence, setNewRecurrence] = useState<RecurrenceType>("none");
  const [newRecurrenceDay, setNewRecurrenceDay] = useState(0);
  const [newLink, setNewLink] = useState("");
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newAttachments, setNewAttachments] = useState<Attachment[]>([]);
  const [uploadingNewAttachments, setUploadingNewAttachments] = useState(false);

  const loadEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/calendar");
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events);
      }
    } catch { /* */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  async function uploadAttachments(files: FileList | File[]): Promise<Attachment[]> {
    const uploaded: Attachment[] = [];

    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("bucket", "plan-documents");

      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error("upload_failed");

      const data = await res.json();
      uploaded.push({
        id: crypto.randomUUID(),
        name: data.fileName || file.name,
        url: data.url,
        type: guessAttachmentType(file.name, file.type),
        size: formatFileSize(file.size),
      });
    }

    return uploaded;
  }

  async function handleCreate() {
    if (!newTitle.trim() || !newDate || !newTime) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle, description: newDesc,
          event_date: `${newDate}T${newTime}:00`, event_time: newTime,
          recurrence: newRecurrence,
          recurrence_day: newRecurrence !== "none" ? newRecurrenceDay : null,
          link: newLink, link_label: newLinkLabel,
          attachments: newAttachments,
        }),
      });
      if (res.ok) {
        setShowAdd(false);
        setNewTitle(""); setNewDesc(""); setNewDate(""); setNewTime("19:00");
        setNewRecurrence("none"); setNewRecurrenceDay(0); setNewLink(""); setNewLinkLabel(""); setNewAttachments([]);
        loadEvents();
      }
    } catch { /* */ } finally { setSaving(false); }
  }

  async function handleToggleActive(id: string, currentActive: boolean) {
    await fetch("/api/admin/calendar", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, is_active: !currentActive }) });
    setEvents((prev) => prev.map((e) => e.id === id ? { ...e, is_active: !currentActive } : e));
  }

  async function handleDelete(id: string) {
    await fetch("/api/admin/calendar", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }

  // Find next upcoming event
  const activeEvents = events.filter(e => e.is_active);
  const upNext = activeEvents
    .map(e => ({ event: e, next: getNextOccurrence(e) }))
    .filter(x => x.next !== null)
    .sort((a, b) => a.next!.getTime() - b.next!.getTime())[0] || null;

  // Build calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  // Map: "YYYY-MM-DD" -> events for that day
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
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-heading font-bold text-text-primary">Calendar</h1>
          <p className="text-text-secondary mt-1 text-sm">{activeEvents.length} active events</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2.5 gradient-accent text-white rounded-xl text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Event
        </button>
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
                className="px-4 py-2 gradient-accent text-white rounded-lg text-xs font-semibold no-underline inline-flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
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
          {/* Empty cells before first day */}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="h-20 border-b border-r border-[rgba(255,255,255,0.02)] bg-[rgba(0,0,0,0.15)]" />
          ))}

          {/* Day cells */}
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
                <div key={ev.id} className="flex items-start justify-between gap-4 bg-bg-primary/50 rounded-xl px-4 py-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                      <svg className="w-4 h-4 text-accent-bright" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-text-primary">{ev.title}</div>
                      <div className="text-xs text-text-muted">{formatTime(ev.event_time)}</div>
                      {ev.description && (
                        <p className="mt-1 text-xs text-text-secondary whitespace-pre-line">{ev.description}</p>
                      )}
                      {ev.attachments && ev.attachments.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {ev.attachments.map((attachment) => (
                            <a
                              key={attachment.id}
                              href={attachment.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-2.5 py-1 text-[11px] text-text-secondary no-underline hover:text-text-primary hover:border-[rgba(255,255,255,0.14)]"
                            >
                              <svg className="h-3.5 w-3.5 text-accent-bright" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                              </svg>
                              <span className="truncate max-w-[180px]">{attachment.name}</span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {ev.link && (
                      <a href={ev.link} target="_blank" rel="noopener noreferrer" className="text-xs text-accent-bright hover:text-accent-light no-underline">
                        {ev.link_label || "Join"}
                      </a>
                    )}
                    <Link href={`/admin/calendar/${ev.id}`} className="p-1.5 text-text-muted hover:text-text-primary transition-colors no-underline">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* All events list */}
      <div className="mb-4">
        <h2 className="text-lg font-heading font-bold text-text-primary mb-3">All Events</h2>
      </div>
      <div className="space-y-3">
        {events.map((event) => {
          const rec = recurrenceLabels[event.recurrence];
          return (
            <div key={event.id} className={`bg-bg-card/80 backdrop-blur-sm border rounded-2xl p-4 flex items-center justify-between transition-all ${
              event.is_active ? "border-[rgba(255,255,255,0.04)]" : "border-[rgba(255,255,255,0.02)] opacity-50"
            }`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-accent-bright" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text-primary">{event.title}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${rec.color}`}>{rec.label}</span>
                  </div>
                  <div className="text-xs text-text-muted mt-0.5">
                    {formatTime(event.event_time)}
                    {event.recurrence !== "none" && ` - Every ${event.recurrence === "biweekly" ? "other " : ""}${dayNamesFull[event.recurrence_day ?? new Date(event.event_date).getDay()]}`}
                  </div>
                  {event.attachments && event.attachments.length > 0 && (
                    <div className="text-[11px] text-text-muted mt-1">
                      {event.attachments.length} attachment{event.attachments.length !== 1 ? "s" : ""}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handleToggleActive(event.id, event.is_active)}
                  className={`text-[10px] px-2.5 py-1 rounded-full font-semibold transition-all cursor-pointer ${
                    event.is_active ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-white/10 text-white/60 border border-white/10"
                  }`}
                >
                  {event.is_active ? "Active" : "Inactive"}
                </button>
                <Link href={`/admin/calendar/${event.id}`} className="p-1.5 text-text-muted hover:text-accent-bright transition-colors no-underline">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </Link>
                <button onClick={() => handleDelete(event.id)} className="p-1.5 text-text-muted hover:text-red-400 transition-colors cursor-pointer">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add event modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-bg-card border border-[rgba(255,255,255,0.08)] rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-heading font-bold text-text-primary mb-4">New Event</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Title</label>
                <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Tuesday Night Coaching Call" className="w-full bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Description</label>
                <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={2} placeholder="Brief description" className="w-full bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Date</label>
                <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="w-full bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm focus:outline-none focus:border-accent/40" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Time</label>
                <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="w-full bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm focus:outline-none focus:border-accent/40" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Recurrence</label>
                <select value={newRecurrence} onChange={(e) => setNewRecurrence(e.target.value as RecurrenceType)} className="w-full bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm focus:outline-none focus:border-accent/40">
                  <option value="none">One-off</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Biweekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              {newRecurrence !== "none" && (
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Day</label>
                  <select value={newRecurrenceDay} onChange={(e) => setNewRecurrenceDay(Number(e.target.value))} className="w-full bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm focus:outline-none focus:border-accent/40">
                    {dayNamesFull.map((day, i) => <option key={i} value={i}>{day}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Link URL</label>
                <input type="url" value={newLink} onChange={(e) => setNewLink(e.target.value)} placeholder="https://zoom.us/j/..." className="w-full bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Link Label</label>
                <input type="text" value={newLinkLabel} onChange={(e) => setNewLinkLabel(e.target.value)} placeholder="e.g. Join Zoom" className="w-full bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Attachments</label>
                <div className="space-y-3">
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.zip,.png,.jpg,.jpeg,.webp"
                    onChange={async (e) => {
                      const files = e.target.files;
                      if (!files?.length) return;
                      setUploadingNewAttachments(true);
                      try {
                        const uploaded = await uploadAttachments(files);
                        setNewAttachments((prev) => [...prev, ...uploaded]);
                      } finally {
                        setUploadingNewAttachments(false);
                        e.target.value = "";
                      }
                    }}
                    className="w-full bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-accent/10 file:text-accent-bright hover:file:bg-accent/20"
                  />
                  {uploadingNewAttachments && <p className="text-xs text-text-muted">Uploading...</p>}
                  {newAttachments.length > 0 && (
                    <div className="space-y-2">
                      {newAttachments.map((attachment) => (
                        <div key={attachment.id} className="flex items-center gap-3 rounded-xl border border-[rgba(255,255,255,0.06)] bg-bg-primary px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm text-text-primary">{attachment.name}</div>
                            {attachment.size && <div className="text-xs text-text-muted">{attachment.size}</div>}
                          </div>
                          <button
                            type="button"
                            onClick={() => setNewAttachments((prev) => prev.filter((item) => item.id !== attachment.id))}
                            className="text-xs text-text-muted hover:text-red-400 transition-colors cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowAdd(false)} className="flex-1 px-4 py-2.5 text-sm font-medium text-text-secondary bg-white/5 hover:bg-white/10 rounded-xl transition-colors cursor-pointer">Cancel</button>
              <button onClick={handleCreate} disabled={saving || uploadingNewAttachments || !newTitle.trim() || !newDate} className="flex-1 px-4 py-2.5 gradient-accent text-white rounded-xl text-sm font-semibold disabled:opacity-40 cursor-pointer">
                {saving ? "Creating..." : "Create Event"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
