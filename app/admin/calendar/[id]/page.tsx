"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { CalendarEvent, RecurrenceType } from "@/lib/types";

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function EventEditorPage() {
  const { id } = useParams();
  const router = useRouter();
  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("19:00");
  const [recurrence, setRecurrence] = useState<RecurrenceType>("none");
  const [recurrenceDay, setRecurrenceDay] = useState(0);
  const [link, setLink] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/calendar");
        if (res.ok) {
          const data = await res.json();
          const found = data.events.find((e: CalendarEvent) => e.id === id);
          if (found) {
            setEvent(found);
            setTitle(found.title);
            setDescription(found.description || "");
            setEventDate(found.event_date.split("T")[0]);
            setEventTime(found.event_time);
            setRecurrence(found.recurrence);
            setRecurrenceDay(found.recurrence_day ?? 0);
            setLink(found.link || "");
            setLinkLabel(found.link_label || "");
            setIsActive(found.is_active);
          }
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function saveField(updates: Partial<CalendarEvent>) {
    setSaving(true);
    try {
      await fetch("/api/admin/calendar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
    } catch {
      // Silently fail
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    try {
      await fetch("/api/admin/calendar", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      router.push("/admin/calendar");
    } catch {
      // Silently fail
    }
  }

  if (loading) {
    return <div className="text-text-muted text-sm">Loading...</div>;
  }

  if (!event) {
    return (
      <div className="text-text-muted">
        <Link href="/admin/calendar" className="text-accent-bright hover:text-accent-light transition-colors no-underline text-sm">
          Back to Calendar
        </Link>
        <p className="mt-4">Event not found.</p>
      </div>
    );
  }

  return (
    <>
      <Link href="/admin/calendar" className="text-text-muted text-sm hover:text-text-secondary transition-colors no-underline inline-flex items-center gap-1 mb-6">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Calendar
      </Link>

      {/* Event header card */}
      <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(255,255,255,0.04)] rounded-2xl overflow-hidden mb-6">
        <div className="relative h-32 bg-gradient-to-br from-blue-600/20 to-blue-900/40 overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-16 h-16 text-white/10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="absolute top-4 right-4">
            <button
              onClick={() => { setIsActive(!isActive); saveField({ is_active: !isActive }); }}
              className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-all ${
                isActive
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30"
                  : "bg-white/10 text-white/60 border border-white/10 hover:border-white/20"
              }`}
            >
              {isActive ? "Active" : "Inactive - Click to Activate"}
            </button>
          </div>
          {saving && (
            <div className="absolute top-4 left-4 text-[10px] text-white/50">Saving...</div>
          )}
        </div>

        <div className="p-6">
          {editingTitle ? (
            <div className="flex items-center gap-3 mb-3">
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="flex-1 bg-bg-primary border border-[rgba(255,255,255,0.1)] rounded-xl px-4 py-3 text-xl font-heading font-bold text-text-primary focus:outline-none focus:border-accent/40" autoFocus />
              <button onClick={() => { setEditingTitle(false); saveField({ title }); }} className="px-4 py-2 gradient-accent text-white rounded-xl text-sm font-medium">Save</button>
              <button onClick={() => { setTitle(event.title); setEditingTitle(false); }} className="px-4 py-2 text-text-muted text-sm">Cancel</button>
            </div>
          ) : (
            <div className="flex items-center gap-3 mb-3 group">
              <h1 className="text-2xl font-heading font-bold text-text-primary">{title}</h1>
              <button onClick={() => setEditingTitle(true)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-text-muted hover:text-accent-bright">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </div>
          )}

          {editingDesc ? (
            <div className="mb-4">
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full bg-bg-primary border border-[rgba(255,255,255,0.1)] rounded-xl px-4 py-3 text-sm text-text-secondary focus:outline-none focus:border-accent/40 resize-none" autoFocus />
              <div className="flex gap-2 mt-2">
                <button onClick={() => { setEditingDesc(false); saveField({ description }); }} className="px-3 py-1.5 gradient-accent text-white rounded-lg text-xs font-medium">Save</button>
                <button onClick={() => { setDescription(event.description || ""); setEditingDesc(false); }} className="px-3 py-1.5 text-text-muted text-xs">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="group flex items-start gap-2 mb-4">
              <p className="text-sm text-text-secondary leading-relaxed">{description || "No description"}</p>
              <button onClick={() => setEditingDesc(true)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-text-muted hover:text-accent-bright flex-shrink-0 mt-0.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Event details */}
      <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(255,255,255,0.04)] rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-heading font-bold text-text-primary mb-4">Event Details</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Date</label>
            <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} onBlur={() => saveField({ event_date: `${eventDate}T${eventTime}:00Z` })} className="w-full bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm focus:outline-none focus:border-accent/40" />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Time</label>
            <input type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} onBlur={() => saveField({ event_time: eventTime, event_date: `${eventDate}T${eventTime}:00Z` })} className="w-full bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm focus:outline-none focus:border-accent/40" />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Recurrence</label>
            <select value={recurrence} onChange={(e) => { const v = e.target.value as RecurrenceType; setRecurrence(v); saveField({ recurrence: v }); }} className="w-full bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm focus:outline-none focus:border-accent/40">
              <option value="none">One-off</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Biweekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          {recurrence !== "none" && (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Recurrence Day</label>
              <select value={recurrenceDay} onChange={(e) => { const v = Number(e.target.value); setRecurrenceDay(v); saveField({ recurrence_day: v }); }} className="w-full bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm focus:outline-none focus:border-accent/40">
                {dayNames.map((day, i) => <option key={i} value={i}>{day}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Link section */}
      <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(255,255,255,0.04)] rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-heading font-bold text-text-primary mb-4">Meeting Link</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Link URL</label>
            <input type="url" value={link} onChange={(e) => setLink(e.target.value)} onBlur={() => saveField({ link: link || undefined })} placeholder="https://zoom.us/j/..." className="w-full bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40" />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Link Label</label>
            <input type="text" value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} onBlur={() => saveField({ link_label: linkLabel || undefined })} placeholder="e.g. Join Zoom" className="w-full bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40" />
          </div>
        </div>
        {link && (
          <div className="mt-3 flex items-center gap-2 bg-bg-primary border border-[rgba(255,255,255,0.04)] rounded-xl px-4 py-3">
            <svg className="w-4 h-4 text-text-muted flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <a href={link} target="_blank" rel="noopener noreferrer" className="text-xs text-accent-bright hover:text-accent-light transition-colors truncate no-underline">{link}</a>
          </div>
        )}
      </div>

      {/* Danger zone */}
      <div className="bg-bg-card/80 backdrop-blur-sm border border-red-500/10 rounded-2xl p-6">
        <h2 className="text-lg font-heading font-bold text-text-primary mb-2">Danger Zone</h2>
        <p className="text-xs text-text-muted mb-4">Deleting an event is permanent and cannot be undone.</p>
        {showDelete ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-red-400">Are you sure?</span>
            <button onClick={handleDelete} className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-sm font-medium hover:bg-red-500/30 transition-colors">
              Yes, Delete Event
            </button>
            <button onClick={() => setShowDelete(false)} className="px-4 py-2 text-text-muted text-sm hover:text-text-secondary">Cancel</button>
          </div>
        ) : (
          <button onClick={() => setShowDelete(true)} className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-sm font-medium hover:bg-red-500/20 transition-colors">
            Delete Event
          </button>
        )}
      </div>
    </>
  );
}
