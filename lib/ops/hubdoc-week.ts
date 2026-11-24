type HubdocResult = { run_key: string; summary: string; outcome: string };

/** An absent weekday can mean no documents or a missed job. Only count dated Codex receipts. */
export function summariseHubdocWeek(rows: HubdocResult[], weekStart: string, throughDate?: string) {
  const start = new Date(weekStart + "T12:00:00Z");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart) || !Number.isFinite(start.getTime()) ||
      start.getUTCDay() !== 1 || start.toISOString().slice(0, 10) !== weekStart)
    throw new Error("Hubdoc week must start on a Monday");
  const byKey = new Map(rows.map(row => [row.run_key, row]));
  const summaryCount = (row: HubdocResult | undefined) => {
    if (!row || !["complete","partial"].includes(row.outcome)) return null;
    const match = /^Hubdoc forwards: (\d{1,6})\.(?:\s|$)/i.exec(row.summary);
    return match ? Number(match[1]) : null;
  };
  const weekdays = Array.from({length:5}, (_, index) =>
    new Date(start.getTime() + index * 86400000).toISOString().slice(0,10))
    .filter(date => !throughDate || date <= throughDate);
  const expectedDays = weekdays.length;
  const weekly = byKey.get(`hubdoc:${weekStart}:week-reconciled`);
  const reconciled = summaryCount(weekly);
  if (reconciled !== null)
    return { forwarded: reconciled, recordedDays: null, expectedDays,
      coverage: weekly?.outcome === "complete" ? "complete" as const : "partial" as const,
      ingestion: "unverified" as const };
  let recordedDays = 0, completeDays = 0, total = 0;
  for (const date of weekdays) {
    const row = byKey.get(`hubdoc:${date}:scheduled`);
    const count = summaryCount(row);
    if (count === null) continue;
    recordedDays++;
    total += count;
    if (row?.outcome === "complete") completeDays++;
  }
  return { forwarded: recordedDays ? total : null, recordedDays, expectedDays,
    coverage: recordedDays && completeDays === expectedDays ? "complete" as const : recordedDays ? "partial" as const : "missing" as const,
    ingestion: "unverified" as const };
}
