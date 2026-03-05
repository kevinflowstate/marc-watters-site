"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { CalendarEvent, RecurrenceType } from "@/lib/types";

const recurrenceLabels: Record<RecurrenceType, { label: string; color: string }> = {
  none: { label: "One-off", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  weekly: { label: "Weekly", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  biweekly: { label: "Biweekly", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  monthly: { label: "Monthly", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

export default function AdminCalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("19:00");
  const [newRecurrence, setNewRecurrence] = useState<RecurrenceType>("none");
  const [newRecurrenceDay, setNewRecurrenceDay] = useState(0);
  const [newLink, setNewLink] = useState("");
  const [newLinkLabel, setNewLinkLabel] = useState("");

  const loadEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/calendar");
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  async function handleCreate() {
    if (!newTitle.trim() || !newDate || !newTime) return;
    setSaving(true);

    try {
      const res = await fetch("/api/admin/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          description: newDesc,
          event_date: `${newDate}T${newTime}:00Z`,
          event_time: newTime,
          recurrence: newRecurrence,
          recurrence_day: newRecurrence !== "none" ? newRecurrenceDay : null,
          link: newLink,
          link_label: newLinkLabel,
        }),
      });

      if (res.ok) {
        setShowAdd(false);
        setNewTitle(""); setNewDesc(""); setNewDate(""); setNewTime("19:00");
        setNewRecurrence("none"); setNewRecurrenceDay(0); setNewLink(""); setNewLinkLabel("");
        loadEvents();
      }
    } catch {
      // Silently fail
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(id: string, currentActive: boolean) {
    try {
      await fetch("/api/admin/calendar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, is_active: !currentActive }),
      });
      setEvents((prev) => prev.map((e) => e.id === id ? { ...e, is_active: !currentActive } : e));
    } catch {
      // Silently fail
    }
  }

  async function handleDelete(id: string) {
    try {
      await fetch("/api/admin/calendar", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch {
      // Silently fail
    }
  }

  const recurringCount = events.filter((e) => e.recurrence !== "none").length;
  const activeCount = events.filter((e) => e.is_active).length;
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  if (loading) {
    return (
      <>
        <div className="mb-8">
          <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-8 w-48 mb-2" />
          <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-4 w-64" />
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-bg-card/80 border border-[rgba(255,255,255,0.04)] rounded-2xl p-5 flex items-start gap-4">
              <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-xl w-12 h-12" />
              <div className="flex-1 space-y-2">
                <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-5 w-48" />
                <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-3 w-36" />
                <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-3 w-64" />
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-heading font-bold text-text-primary">Calendar Events</h1>
          <p className="text-text-secondary mt-1">
            {events.length} events - {recurringCount} recurring - {activeCount} active
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-5 py-3 gradient-accent text-white rounded-xl text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Event
        </button>
      </div>

      {showAdd && (
        <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(255,255,255,0.06)] rounded-2xl p-6 mb-6">
          <h3 className="text-lg font-heading font-bold text-text-primary mb-4">New Event</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Title</label>
              <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Tuesday Night Coaching Call" className="w-full bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Description</label>
              <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={2} placeholder="Brief description of the event" className="w-full bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40 resize-none" />
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
                <label className="block text-xs font-medium text-text-secondary mb-1.5">Recurrence Day</label>
                <select value={newRecurrenceDay} onChange={(e) => setNewRecurrenceDay(Number(e.target.value))} className="w-full bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm focus:outline-none focus:border-accent/40">
                  {dayNames.map((day, i) => <option key={i} value={i}>{day}</option>)}
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
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handleCreate} disabled={saving} className="px-5 py-2.5 gradient-accent text-white rounded-xl text-sm font-medium disabled:opacity-50">
              {saving ? "Creating..." : "Create"}
            </button>
            <button onClick={() => setShowAdd(false)} className="px-5 py-2.5 text-text-muted text-sm hover:text-text-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* Event list */}
      <div className="space-y-3">
        {events.map((event) => (
          <EventCard key={event.id} event={event} onToggleActive={handleToggleActive} onDelete={handleDelete} />
        ))}
      </div>

      {events.length === 0 && (
        <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(255,255,255,0.04)] rounded-2xl p-8 text-center">
          <p className="text-text-muted text-sm">No events yet. Add your first one above.</p>
        </div>
      )}
    </>
  );
}

function EventCard({ event, onToggleActive, onDelete }: {
  event: CalendarEvent;
  onToggleActive: (id: string, current: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const rec = recurrenceLabels[event.recurrence];
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <div className={`group relative bg-bg-card/80 backdrop-blur-sm border rounded-2xl p-5 overflow-hidden transition-all duration-300 hover:-translate-y-0.5 will-change-transform ${
      event.is_active ? "border-[rgba(255,255,255,0.04)] hover:border-[rgba(255,255,255,0.08)] hover:shadow-[0_10px_30px_rgba(0,0,0,0.2)]" : "border-[rgba(255,255,255,0.02)] opacity-60"
    }`}>
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[length:4px_4px] pointer-events-none" />
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0">
          <svg className="w-6 h-6 text-accent-bright" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <Link href={`/admin/calendar/${event.id}`} className="text-base font-heading font-bold text-text-primary hover:text-accent-bright transition-colors no-underline">
              {event.title}
            </Link>
            <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold border ${rec.color}`}>
              {rec.label}
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs text-text-muted mb-2">
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {formatDate(event.event_date)}
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {formatTime(event.event_time)}
            </span>
          </div>

          {event.description && (
            <p className="text-xs text-text-secondary leading-relaxed line-clamp-2 mb-2">{event.description}</p>
          )}

          {event.link && (
            <a href={event.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-accent-bright hover:text-accent-light transition-colors no-underline">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              {event.link_label || event.link}
            </a>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => onToggleActive(event.id, event.is_active)}
            className={`text-[10px] px-2.5 py-1 rounded-full font-semibold transition-all cursor-pointer ${
              event.is_active
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30"
                : "bg-white/10 text-white/60 border border-white/10 hover:border-white/20"
            }`}
          >
            {event.is_active ? "Active" : "Inactive"}
          </button>
          <Link href={`/admin/calendar/${event.id}`} className="p-2 text-text-muted hover:text-accent-bright transition-colors rounded-lg hover:bg-[rgba(255,255,255,0.03)]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </Link>
          {showDeleteConfirm ? (
            <div className="flex items-center gap-1">
              <button onClick={() => onDelete(event.id)} className="p-2 text-red-400 hover:text-red-300 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </button>
              <button onClick={() => setShowDeleteConfirm(false)} className="p-2 text-text-muted hover:text-text-secondary transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <button onClick={() => setShowDeleteConfirm(true)} className="p-2 text-text-muted hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
