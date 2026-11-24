type HubdocResult = { run_key: string; summary: string; outcome: string };

/** An absent weekday can mean no documents or a missing run; never infer zero. */
export function summariseHubdocWeek(rows: HubdocResult[], weekStart: string) {
  const start = new Date(weekStart + "T12:00:00Z");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart) || !Number.isFinite(start.getTime()) ||
      start.getUTCDay() !== 1 || start.toISOString().slice(0, 10) !== weekStart)
    throw new Error("Hubdoc week must start on a Monday");
  const byKey = new Map(rows.map(row => [row.run_key, row]));
  const summaryCount = (row: HubdocResult | undefined) => {
    if (!row || row.outcome === "failed") return null;
    const match = /^Hubdoc forwards: (\d{1,6})\.(?:\s|$)/i.exec(row.summary);
    return match ? Number(match[1]) : null;
  };
  const weekly = byKey.get(`hubdoc:${weekStart}:week-reconciled`);
  const reconciled = summaryCount(weekly);
  if (reconciled !== null)
    return { forwarded: reconciled, recordedDays: null, expectedDays: 5,
      coverage: weekly?.outcome === "complete" ? "complete" as const : "partial" as const,
      ingestion: "unverified" as const };
  let recordedDays = 0, completeDays = 0, total = 0;
  for (let day = 0; day < 5; day++) {
    const date = new Date(start.getTime() + day * 86400000).toISOString().slice(0, 10);
    const row = byKey.get(`hubdoc:${date}:scheduled`);
    const count = summaryCount(row);
    if (count === null) continue;
    recordedDays++;
    total += count;
    if (row?.outcome === "complete") completeDays++;
  }
  return { forwarded: recordedDays ? total : null, recordedDays, expectedDays: 5,
    coverage: completeDays === 5 ? "complete" as const : recordedDays ? "partial" as const : "missing" as const,
    ingestion: "unverified" as const };
}
