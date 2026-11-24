export function reportWeekStart(now = new Date()) {
  const monday = new Date(now);
  monday.setUTCHours(0, 0, 0, 0);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

export function reportWeekLabel(week: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) return "date unavailable";
  const date = new Date(week + "T12:00:00Z");
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" })
    : "date unavailable";
}
