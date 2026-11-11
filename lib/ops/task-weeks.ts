import type { OpsTask } from "./types";

/**
 * Weekly task lists (Kevin, 11 Nov 2026). A week runs Monday 00:00 to Sunday midnight, London time.
 * - Open tasks stay in their owner's list; one created before this week is "carried over".
 * - A task completed this week moves to the bottom of its owner's list under "Completed".
 * - After Sunday midnight it leaves the list and appears in the weekly archive.
 * Nothing is moved by a job: every view is worked out from the completion time, so the change at
 * midnight cannot fail or run twice.
 */

const ZONE = "Europe/London";

/** Minutes London is ahead of UTC at this instant (0 or 60). */
function londonOffsetMinutes(at: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return Math.round((asUtc - Math.floor(at.getTime() / 60000) * 60000) / 60000);
}

/** The London calendar date (YYYY-MM-DD) of an instant. */
export function londonDate(at: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

/** Monday 00:00 London of the week containing `at`, as a UTC instant. */
export function weekStart(at: Date): Date {
  const [y, m, d] = londonDate(at).split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d));
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  // London midnight on that Monday: subtract London's offset at (roughly) that time.
  const guess = new Date(day.getTime() - londonOffsetMinutes(day) * 60000);
  return new Date(day.getTime() - londonOffsetMinutes(guess) * 60000);
}

export function weekLabel(start: Date) {
  const text = new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, day: "numeric", month: "short" }).format(start);
  const year = new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, year: "numeric" }).format(start);
  const thisYear = new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, year: "numeric" }).format(new Date());
  return `Week of ${text}${year === thisYear ? "" : ` ${year}`}`;
}

type Timed = Pick<OpsTask, "status" | "created_at"> & { completed_at?: string | null };

const time = (v: string | null | undefined) => (v ? Date.parse(v) : NaN);

export function completedAt(task: Timed) {
  return task.status === "done" ? time(task.completed_at) : NaN;
}

/** Still open and created before this week began. */
export function isCarriedOver(task: Timed, now = new Date()) {
  if (["done", "cancelled"].includes(task.status)) return false;
  return time(task.created_at) < weekStart(now).getTime();
}

/** Completed since Monday 00:00 London: shown under "Completed" in the owner's list. */
export function isCompletedThisWeek(task: Timed, now = new Date()) {
  const at = completedAt(task);
  return Number.isFinite(at) && at >= weekStart(now).getTime();
}

export type ArchiveWeek<T> = { key: string; label: string; start: string; tasks: T[] };

/** Tasks completed before this week, grouped by the week they were completed in, newest first. */
export function archiveWeeks<T extends Timed>(tasks: T[], now = new Date()): ArchiveWeek<T>[] {
  const cutoff = weekStart(now).getTime();
  const weeks = new Map<string, ArchiveWeek<T>>();
  for (const t of tasks) {
    const at = completedAt(t);
    if (!Number.isFinite(at) || at >= cutoff) continue;
    const start = weekStart(new Date(at));
    const key = londonDate(start);
    if (!weeks.has(key)) weeks.set(key, { key, label: weekLabel(start), start: start.toISOString(), tasks: [] });
    weeks.get(key)!.tasks.push(t);
  }
  for (const w of weeks.values()) w.tasks.sort((a, b) => completedAt(b) - completedAt(a));
  return [...weeks.values()].sort((a, b) => b.start.localeCompare(a.start));
}

/** "YYYY-MM-DD" at a London clock hour, as an ISO instant (for due dates picked in a date field). */
export function londonDateAt(date: string, hour = 17): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const naive = Date.UTC(+m[1], +m[2] - 1, +m[3], hour);
  const guess = new Date(naive - londonOffsetMinutes(new Date(naive)) * 60000);
  return new Date(naive - londonOffsetMinutes(guess) * 60000).toISOString();
}
