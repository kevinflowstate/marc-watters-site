const zone = "Europe/London";
export function londonDate(value: string | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
export function londonInput(value: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(value));
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
/** Resolve wall time, reject the missing/ambiguous DST hour instead of guessing. */
export function londonToUtc(local: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))
    throw new Error("Choose a valid London date and time");
  const nominal = Date.parse(local + ":00Z");
  const matches = [nominal, nominal - 3600000].filter(
    (n) =>
      Number.isFinite(n) && londonInput(new Date(n).toISOString()) === local,
  );
  if (matches.length !== 1)
    throw new Error("Choose a time outside the clock-change hour");
  return new Date(matches[0]).toISOString();
}
export function nextSlots(
  count: number,
  occupied: string[],
  now = new Date(),
  time = "18:00",
) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    throw new Error("Posting time must be HH:mm");
  const used = new Set(occupied.map(londonDate));
  const start = Date.parse(londonDate(now) + "T12:00:00Z");
  const slots: string[] = [];
  for (let day = 1; day <= 28 && slots.length < count; day++) {
    const date = new Date(start + day * 86400000).toISOString().slice(0, 10);
    if (!used.has(date)) slots.push(londonToUtc(`${date}T${time}`));
  }
  return slots; // Never guess beyond the CRM's 28-day read window.
}
