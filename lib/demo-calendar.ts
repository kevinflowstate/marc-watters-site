import type { CalendarEvent } from "./types";

const demoEvents: CalendarEvent[] = [
  {
    id: "evt-1",
    title: "Tuesday Night Coaching Call",
    description: "Weekly group coaching session. Bring your questions, wins, and challenges from the week. We'll work through them together.",
    event_date: "2026-03-10T19:00:00Z",
    event_time: "19:00",
    recurrence: "weekly",
    recurrence_day: 2,
    link: "https://zoom.us/j/1234567890",
    link_label: "Join Zoom",
    is_active: true,
    created_at: "2026-01-15T10:00:00Z",
  },
  {
    id: "evt-2",
    title: "Monthly Q&A Session",
    description: "Open floor Q&A. Anything goes - finances, team, operations, marketing. First Saturday of every month.",
    event_date: "2026-03-07T10:00:00Z",
    event_time: "10:00",
    recurrence: "monthly",
    recurrence_day: 6,
    link: "https://zoom.us/j/0987654321",
    link_label: "Join Zoom",
    is_active: true,
    created_at: "2026-01-15T10:00:00Z",
  },
  {
    id: "evt-3",
    title: "Goal Setting Workshop",
    description: "One-off intensive workshop. We'll map out your 90-day plan with clear targets, milestones, and accountability checkpoints.",
    event_date: "2026-03-22T14:00:00Z",
    event_time: "14:00",
    recurrence: "none",
    link: "https://zoom.us/j/1122334455",
    link_label: "Join Workshop",
    is_active: true,
    created_at: "2026-02-01T10:00:00Z",
  },
  {
    id: "evt-4",
    title: "Accountability Check-In",
    description: "Biweekly 30-minute check-in. Quick progress review against your targets.",
    event_date: "2026-03-12T08:00:00Z",
    event_time: "08:00",
    recurrence: "biweekly",
    recurrence_day: 3,
    is_active: false,
    created_at: "2026-02-10T10:00:00Z",
  },
];

export function getDemoEvents(): CalendarEvent[] {
  return demoEvents;
}

export function getDemoEventById(id: string): CalendarEvent | undefined {
  return demoEvents.find((e) => e.id === id);
}

function getNextOccurrence(event: CalendarEvent): Date | null {
  const now = new Date();

  if (event.recurrence === "none") {
    const d = new Date(event.event_date);
    return d > now ? d : null;
  }

  const [hours, minutes] = event.event_time.split(":").map(Number);
  const targetDay = event.recurrence_day ?? 0;

  // Start from today, find the next matching day
  const next = new Date(now);
  next.setHours(hours, minutes, 0, 0);

  // Find the next occurrence of the target day of week
  const currentDay = next.getDay();
  let daysUntil = targetDay - currentDay;
  if (daysUntil < 0 || (daysUntil === 0 && next <= now)) {
    daysUntil += 7;
  }
  next.setDate(next.getDate() + daysUntil);

  if (event.recurrence === "biweekly") {
    // If the found date is an odd week from the start, skip ahead
    const start = new Date(event.event_date);
    const weeksDiff = Math.floor((next.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
    if (weeksDiff % 2 !== 0) {
      next.setDate(next.getDate() + 7);
    }
  }

  if (event.recurrence === "monthly") {
    // Find the next month where the target weekday falls on the first week
    let candidate = new Date(next);
    for (let i = 0; i < 12; i++) {
      const month = (now.getMonth() + i) % 12;
      const year = now.getFullYear() + Math.floor((now.getMonth() + i) / 12);
      // Find first occurrence of targetDay in this month
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

export function getNextUpcomingEvent(): { event: CalendarEvent; nextDate: Date } | null {
  const activeEvents = demoEvents.filter((e) => e.is_active);
  let earliest: { event: CalendarEvent; nextDate: Date } | null = null;

  for (const event of activeEvents) {
    const nextDate = getNextOccurrence(event);
    if (nextDate && (!earliest || nextDate < earliest.nextDate)) {
      earliest = { event, nextDate };
    }
  }

  return earliest;
}

export function getUpcomingEvents(count = 10): { event: CalendarEvent; nextDate: Date }[] {
  const activeEvents = demoEvents.filter((e) => e.is_active);
  const upcoming: { event: CalendarEvent; nextDate: Date }[] = [];

  for (const event of activeEvents) {
    const nextDate = getNextOccurrence(event);
    if (nextDate) {
      upcoming.push({ event, nextDate });
    }
  }

  return upcoming.sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime()).slice(0, count);
}
