"use client";

import { useState, useEffect, useCallback } from "react";
import { WsEmpty as EmptyState, WsNotice as InlineNotice, WsPageSkeleton as PageSkeleton } from "@/components/portal/WsState";
import { Icon } from "@/components/ops/workspace/WorkspaceUI";
import type { CalendarEvent, RecurrenceType } from "@/lib/types";

const recurrenceLabels: Record<RecurrenceType, { label: string; color: string }> = {
  none: { label: "One-off", color: "is-decide" },
  weekly: { label: "Weekly", color: "is-ok" },
  biweekly: { label: "Biweekly", color: "" },
  monthly: { label: "Monthly", color: "is-attn" },
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
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState("all");

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const loadEvents = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/calendar");
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      } else {
        throw new Error("Could not load the calendar.");
      }
    } catch {
      setError("Could not load the calendar. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const folders = Array.from(new Set(events.map((event) => event.folder || "General"))).sort();
  const filteredEvents = selectedFolder === "all" ? events : events.filter((event) => (event.folder || "General") === selectedFolder);
  const activeEvents = filteredEvents.filter(e => e.is_active);

  // Up next
  const upNext = activeEvents
    .map(e => ({ event: e, next: getNextOccurrence(e) }))
    .filter(x => x.next !== null)
    .sort((a, b) => a.next!.getTime() - b.next!.getTime())[0] || null;
  const upcomingOccurrences = activeEvents
    .map((event) => ({ event, next: getNextOccurrence(event) }))
    .filter((item): item is { event: CalendarEvent; next: Date } => item.next !== null)
    .sort((a, b) => a.next.getTime() - b.next.getTime());
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone.replaceAll("_", " ");

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
    return <PageSkeleton rows={4} />;
  }

  return (
    <div className="ws ws-page">
      <div className="ws-ph">
        <div className="min-w-0">
          <h1 className="ws-title">Calendar</h1>
          <p className="ws-meta mt-1">Upcoming events and coaching sessions.</p>
        </div>
        <div className="ws-caption ws-cal-tz">
          <Icon name="clock" size={14} />
          Times shown in {timezone}
        </div>
      </div>

      {error && (
        <InlineNotice
          tone="error"
          className=""
          action={<button type="button" onClick={() => void loadEvents()} className="ws-btn ws-btn-sm ws-focus">Retry</button>}
        >
          {error}
        </InlineNotice>
      )}

      {folders.length > 1 && (
        <div className="ws-seg ws-cal-folders">
          {["all", ...folders].map((folder) => (
            <button
              key={folder}
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
        <section className="ws-panel" aria-label="Up next">
          <div className="ws-cal-next">
            <div className="min-w-0 flex-1">
              <div className="ws-caption">Up next</div>
              <h2 className="ws-cal-next-t">{upNext.event.title}</h2>
              <div className="ws-cal-next-meta">
                <span>{upNext.event.folder || "General"}</span>
                <span>
                  {upNext.next!.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
                </span>
                <span>{formatTime(upNext.event.event_time)}</span>
                <span className={`ws-chip ${recurrenceLabels[upNext.event.recurrence].color}`}>
                  {recurrenceLabels[upNext.event.recurrence].label}
                </span>
              </div>
              {upNext.event.description && (
                <p className="ws-prose ws-cal-desc whitespace-pre-line line-clamp-5 md:line-clamp-none">{upNext.event.description}</p>
              )}
              {upNext.event.attachments && upNext.event.attachments.length > 0 && (
                <div className="ws-cal-atts">
                  {upNext.event.attachments.map((attachment) => (
                    <a
                      key={attachment.id}
                      href={attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ws-cal-att ws-focus"
                    >
                      <Icon name="link" size={13} />
                      <span className="truncate max-w-[180px]">{attachment.name}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
            {upNext.event.link && (
              <a
                href={upNext.event.link}
                target="_blank"
                rel="noopener noreferrer"
                className="ws-btn ws-btn-primary ws-focus ws-cal-join"
              >
                <Icon name="play" size={14} />
                {upNext.event.link_label || "Join"}
              </a>
            )}
          </div>
        </section>
      )}

      {!error && activeEvents.length === 0 && (
        <div className="ws-panel">
          <EmptyState
            icon={<Icon name="calendar" size={20} />}
            title="No upcoming events"
            description="New coaching calls and events will appear here as soon as Marc adds them."
          />
        </div>
      )}

      {upcomingOccurrences.length > 0 && (
        <section className="ws-panel md:hidden">
          <div className="ws-panel-head">
            <h2 className="ws-h2">Upcoming schedule</h2>
          </div>
          <div>
            {upcomingOccurrences.slice(0, 6).map(({ event, next }) => (
              <div key={event.id} className="ws-cal-up">
                <div className="ws-cal-up-date">
                  <div className="ws-cal-up-m">{next.toLocaleDateString("en-GB", { month: "short" })}</div>
                  <div className="ws-cal-up-d">{next.getDate()}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="ws-row-title ws-wrap">{event.title}</div>
                  <div className="ws-row-sub">{next.toLocaleDateString("en-GB", { weekday: "long" })} · {formatTime(event.event_time)}</div>
                  {event.link && (
                    <a href={event.link} target="_blank" rel="noopener noreferrer" className="ws-link ws-cal-up-link">{event.link_label || "Join call"} <Icon name="chevron" size={13} /></a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Calendar grid */}
      <div className="ws-panel ws-cal">
        {/* Month navigation */}
        <div className="ws-cal-nav">
          <button onClick={prevMonth} aria-label="Previous month" className="ws-btn ws-btn-quiet ws-btn-icon ws-focus">
            <Icon name="chevron" size={15} className="ws-back-ic" />
          </button>
          <h2 className="ws-h2">
            {monthNames[viewMonth]} {viewYear}
          </h2>
          <button onClick={nextMonth} aria-label="Next month" className="ws-btn ws-btn-quiet ws-btn-icon ws-focus">
            <Icon name="chevron" size={15} />
          </button>
        </div>

        {/* Day headers */}
        <div className="ws-cal-dow">
          {dayNames.map((d) => (
            <div key={d} className="ws-cal-dow-c">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="ws-cal-grid">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="ws-cal-cell is-blank" />
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
                className={`ws-cal-cell ws-focus ${
                  isSelected ? "is-selected" : hasEvents ? "has-events" : ""
                }`}
              >
                <span className={`ws-cal-n ${
                  isToday ? "is-today" : ""
                }`}>
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
      </div>

      {/* Selected day detail */}
      {selectedDay && (
        <div className="ws-panel">
          <div className="ws-panel-head">
            <h3 className="ws-h2">
              {new Date(selectedDay + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </h3>
          </div>
          {selectedEvents.length === 0 ? (
            <p className="ws-caption ws-pad">No events on this day.</p>
          ) : (
            <div>
              {selectedEvents.map((ev) => (
                <div key={ev.id} className="ws-cal-day-ev">
                  <div className="ws-cal-day-main">
                    <Icon name="clock" size={14} className="ws-cal-day-ic" />
                    <div className="min-w-0 flex-1">
                      <div className="ws-row-title ws-wrap">{ev.title}</div>
                      <div className="ws-row-sub">{ev.folder || "General"} - {formatTime(ev.event_time)}</div>
                      {ev.description && (
                        <p className="ws-prose ws-cal-desc whitespace-pre-line">{ev.description}</p>
                      )}
                      {ev.attachments && ev.attachments.length > 0 && (
                        <div className="ws-cal-atts">
                          {ev.attachments.map((attachment) => (
                            <a
                              key={attachment.id}
                              href={attachment.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ws-cal-att ws-focus"
                            >
                              <Icon name="link" size={13} />
                              <span className="truncate max-w-[180px]">{attachment.name}</span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {ev.link && (
                    <a
                      href={ev.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ws-btn ws-btn-primary ws-btn-sm ws-focus"
                    >
                      <Icon name="play" size={13} />
                      {ev.link_label || "Join"}
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
