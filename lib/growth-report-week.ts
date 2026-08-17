function dateInLondon(reference: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(reference);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return new Date(value).toISOString().slice(0, 10);
}

export function growthReportWeek(reference = new Date()) {
  const date = dateInLondon(reference);
  const day = new Date(`${date}T12:00:00.000Z`).getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const weekStart = addDays(date, mondayOffset);
  return { weekStart, weekEnd: addDays(weekStart, 6) };
}
