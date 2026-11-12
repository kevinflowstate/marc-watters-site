"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatFileSize, guessAttachmentType } from "@/lib/attachments";
import type { Attachment, CalendarEvent, RecurrenceType } from "@/lib/types";
import { Empty, Icon } from "@/components/ops/workspace/WorkspaceUI";

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
  const [selectedFolder, setSelectedFolder] = useState("all");

  // Calendar navigation
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  // New event form
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newFolder, setNewFolder] = useState("General");
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
          folder: newFolder,
          event_date: `${newDate}T${newTime}:00`, event_time: newTime,
          recurrence: newRecurrence,
          recurrence_day: newRecurrence !== "none" ? newRecurrenceDay : null,
          link: newLink, link_label: newLinkLabel,
          attachments: newAttachments,
        }),
      });
      if (res.ok) {
        setShowAdd(false);
        setNewTitle(""); setNewDesc(""); setNewFolder("General"); setNewDate(""); setNewTime("19:00");
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
  const folders = Array.from(new Set(events.map((event) => event.folder || "General"))).sort();
  const filteredEvents = selectedFolder === "all" ? events : events.filter((event) => (event.folder || "General") === selectedFolder);
  const activeEvents = filteredEvents.filter(e => e.is_active);
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
      <div className="ws ws-page">
        <div>
          <span className="ws-skel" style={{ width: 140, height: 22 }} />
          <span className="ws-skel mt-2" style={{ width: 120, height: 12 }} />
        </div>
        <span className="ws-skel" style={{ height: 72, borderRadius: 10 }} />
        <span className="ws-skel" style={{ height: 320, borderRadius: 10 }} />
      </div>
    );
  }

  return (
    <div className="ws ws-page">
      {/* Header */}
      <div className="ws-ph">
        <div className="min-w-0">
          <h1 className="ws-title">Calendar</h1>
          <p className="ws-meta mt-1">{activeEvents.length} active events</p>
        </div>
        <div className="ws-ph-acts">
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="ws-btn ws-btn-primary ws-focus"
          >
            <Icon name="plus" size={14} />
            Add event
          </button>
        </div>
      </div>

      {folders.length > 1 && (
        <div className="ws-seg ws-cal-folders" role="group" aria-label="Folders">
          {["all", ...folders].map((folder) => (
            <button
              key={folder}
              type="button"
              onClick={() => setSelectedFolder(folder)}
              aria-pressed={selectedFolder === folder}
              className="ws-seg-btn ws-focus"
            >
              {folder === "all" ? "All folders" : folder}
            </button>
          ))}
        </div>
      )}

      {/* Up Next card */}
      {upNext && (
        <section className="ws-panel ws-cal-next" aria-label="Up next">
          <div className="ws-cal-next-m">
            <div className="ws-field-l">Up next</div>
            <h3 className="ws-cal-next-t">{upNext.event.title}</h3>
            <div className="ws-cal-next-s">
              <span>
                {upNext.next!.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
              </span>
              <span>{formatTime(upNext.event.event_time)}</span>
              <span className="ws-chip">
                {recurrenceLabels[upNext.event.recurrence].label}
              </span>
            </div>
          </div>
          {upNext.event.link && (
            <a
              href={upNext.event.link}
              target="_blank"
              rel="noopener noreferrer"
              className="ws-btn ws-btn-primary ws-focus"
            >
              <Icon name="link" size={14} />
              {upNext.event.link_label || "Join"}
            </a>
          )}
        </section>
      )}

      {/* Calendar grid */}
      <section className="ws-panel ws-cal" aria-label="Month">
        {/* Month navigation */}
        <header className="ws-panel-head ws-cal-head">
          <button type="button" onClick={prevMonth} className="ws-btn ws-btn-quiet ws-btn-icon ws-focus" aria-label="Previous month">
            <Icon name="chevron" size={15} className="ws-back-ic" />
          </button>
          <h2 className="ws-h2 ws-cal-month">
            {monthNames[viewMonth]} {viewYear}
          </h2>
          <button type="button" onClick={nextMonth} className="ws-btn ws-btn-quiet ws-btn-icon ws-focus" aria-label="Next month">
            <Icon name="chevron" size={15} />
          </button>
        </header>

        {/* Day headers */}
        <div className="ws-cal-dows">
          {dayNames.map((d) => (
            <div key={d} className="ws-cal-dow">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="ws-cal-grid">
          {/* Empty cells before first day */}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="ws-cal-cell is-pad" />
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
                type="button"
                onClick={() => setSelectedDay(isSelected ? null : key)}
                aria-pressed={isSelected}
                className={`ws-cal-cell ws-focus ${isSelected ? "is-on" : ""} ${hasEvents ? "has-events" : ""}`}
              >
                <span className={`ws-cal-num ${isToday ? "is-today" : ""}`}>
                  {dayNum}
                </span>
                {dayEvents.length > 0 && (
                  <div className="ws-cal-evs">
                    {dayEvents.slice(0, 2).map((ev) => (
                      <div
                        key={ev.id}
                        className="ws-cal-ev"
                      >
                        {ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="ws-cal-more">+{dayEvents.length - 2} more</div>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Selected day detail */}
      {selectedDay && (
        <section className="ws-panel" aria-label="Selected day">
          <header className="ws-panel-head">
            <h3 className="ws-h2">
              {new Date(selectedDay + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </h3>
          </header>
          {selectedEvents.length === 0 ? (
            <p className="ws-cal-none">No events on this day.</p>
          ) : (
            <div>
              {selectedEvents.map((ev) => (
                <div key={ev.id} className="ws-cal-row">
                  <Icon name="clock" size={15} className="ws-cal-row-ic" />
                  <div className="min-w-0">
                    <div className="ws-cal-row-t">{ev.title}</div>
                    <div className="ws-cal-row-s">{formatTime(ev.event_time)}</div>
                    {ev.description && (
                      <p className="ws-cal-desc">{ev.description}</p>
                    )}
                    {ev.attachments && ev.attachments.length > 0 && (
                      <div className="ws-cal-atts">
                        {ev.attachments.map((attachment) => (
                          <a
                            key={attachment.id}
                            href={attachment.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ws-chip ws-cal-att ws-focus"
                          >
                            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                            <span className="ws-cal-att-n">{attachment.name}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="ws-cal-row-acts">
                    {ev.link && (
                      <a href={ev.link} target="_blank" rel="noopener noreferrer" className="ws-link ws-cal-join">
                        {ev.link_label || "Join"}
                      </a>
                    )}
                    <Link href={`/admin/calendar/${ev.id}`} className="ws-btn ws-btn-quiet ws-btn-icon ws-focus" aria-label="Edit event">
                      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* All events list */}
      <section className="ws-panel" aria-label="All events">
        <header className="ws-panel-head">
          <h2 className="ws-h2">All events</h2>
          <span className="ws-caption">{filteredEvents.length}</span>
        </header>
        <div>
          {filteredEvents.length === 0 && <Empty icon="calendar" title="No events yet" />}
          {filteredEvents.map((event) => {
            const rec = recurrenceLabels[event.recurrence];
            return (
              <div key={event.id} className={`ws-cal-row ${event.is_active ? "" : "is-off"}`}>
                <Icon name="calendar" size={15} className="ws-cal-row-ic" />
                <div className="min-w-0">
                  <div className="ws-cal-row-top">
                    <span className="ws-cal-row-t">{event.title}</span>
                    <span className="ws-chip">{rec.label}</span>
                  </div>
                  <div className="ws-cal-row-s">
                    <span>{event.folder || "General"}</span>
                    <span> - </span>
                    {formatTime(event.event_time)}
                    {event.recurrence !== "none" && ` - Every ${event.recurrence === "biweekly" ? "other " : ""}${dayNamesFull[event.recurrence_day ?? new Date(event.event_date).getDay()]}`}
                  </div>
                  {event.attachments && event.attachments.length > 0 && (
                    <div className="ws-cal-row-s">
                      {event.attachments.length} attachment{event.attachments.length !== 1 ? "s" : ""}
                    </div>
                  )}
                </div>
                <div className="ws-cal-row-acts">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(event.id, event.is_active)}
                    className={`ws-chip ws-cal-toggle ws-focus ${event.is_active ? "is-ok" : ""}`}
                  >
                    {event.is_active ? "Active" : "Inactive"}
                  </button>
                  <Link href={`/admin/calendar/${event.id}`} className="ws-btn ws-btn-quiet ws-btn-icon ws-focus" aria-label="Edit event">
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                  </Link>
                  <button type="button" onClick={() => handleDelete(event.id)} className="ws-btn ws-btn-quiet ws-btn-icon ws-focus ws-cal-del" aria-label="Delete event">
                    <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Add event modal */}
      {showAdd && (
        <div className="ws-overlay">
          <div className="ws-overlay-bg" />
          <div className="ws-dialog is-wide" role="dialog" aria-modal="true" aria-label="New event">
            <div className="ws-dialog-head">
              <h3 className="ws-dialog-title">New event</h3>
            </div>
            <div className="ws-dialog-body">
              <div className="ws-cal-form">
                <div className="is-full">
                  <label className="ws-label">Title</label>
                  <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Tuesday Night Coaching Call" className="ws-input" />
                </div>
                <div className="is-full">
                  <label className="ws-label">Description</label>
                  <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={2} placeholder="Brief description" className="ws-input ws-cal-ta" />
                </div>
                <div className="is-full">
                  <label className="ws-label">Folder</label>
                  <input type="text" value={newFolder} onChange={(e) => setNewFolder(e.target.value)} placeholder="e.g. Catch-up calls" className="ws-input" />
                </div>
                <div>
                  <label className="ws-label">Date</label>
                  <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="ws-input" />
                </div>
                <div>
                  <label className="ws-label">Time</label>
                  <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="ws-input" />
                </div>
                <div>
                  <label className="ws-label">Recurrence</label>
                  <select value={newRecurrence} onChange={(e) => setNewRecurrence(e.target.value as RecurrenceType)} className="ws-input">
                    <option value="none">One-off</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Biweekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                {newRecurrence !== "none" && (
                  <div>
                    <label className="ws-label">Day</label>
                    <select value={newRecurrenceDay} onChange={(e) => setNewRecurrenceDay(Number(e.target.value))} className="ws-input">
                      {dayNamesFull.map((day, i) => <option key={i} value={i}>{day}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="ws-label">Link URL</label>
                  <input type="url" value={newLink} onChange={(e) => setNewLink(e.target.value)} placeholder="https://zoom.us/j/..." className="ws-input" />
                </div>
                <div>
                  <label className="ws-label">Link label</label>
                  <input type="text" value={newLinkLabel} onChange={(e) => setNewLinkLabel(e.target.value)} placeholder="e.g. Join Zoom" className="ws-input" />
                </div>
                <div className="is-full">
                  <label className="ws-label">Attachments</label>
                  <div className="ws-cal-files">
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
                      className="ws-input ws-file"
                    />
                    {uploadingNewAttachments && <p className="ws-caption">Uploading...</p>}
                    {newAttachments.length > 0 && (
                      <div className="ws-cal-files">
                        {newAttachments.map((attachment) => (
                          <div key={attachment.id} className="ws-cal-file">
                            <div className="min-w-0 flex-1">
                              <div className="ws-cal-file-n">{attachment.name}</div>
                              {attachment.size && <div className="ws-caption">{attachment.size}</div>}
                            </div>
                            <button
                              type="button"
                              onClick={() => setNewAttachments((prev) => prev.filter((item) => item.id !== attachment.id))}
                              className="ws-btn ws-btn-quiet ws-btn-sm ws-focus ws-cal-remove"
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
              <div className="ws-dialog-foot">
                <button type="button" onClick={() => setShowAdd(false)} className="ws-btn ws-btn-quiet ws-focus">Cancel</button>
                <button type="button" onClick={handleCreate} disabled={saving || uploadingNewAttachments || !newTitle.trim() || !newDate} className="ws-btn ws-btn-primary ws-focus">
                  {saving ? "Creating..." : "Create event"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
