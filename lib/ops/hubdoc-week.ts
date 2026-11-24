type HubdocResult = { run_key: string; summary: string; outcome: string };
type Basis = "codex_run" | "sent_reconciliation" | "mixed" | "missing";
type Coverage = "complete" | "partial" | "missing";

function receipt(row?: HubdocResult) {
  if (!row || !["complete", "partial"].includes(row.outcome)) return null;
  const match = /^Hubdoc forwards: (\d{1,6})\.(?:\s|$)/i.exec(row.summary);
  return match
    ? { count: Number(match[1]), complete: row.outcome === "complete" }
    : null;
}

/** Sources for the same window can overlap. Only actual scheduled-run receipts establish Codex attribution. */
export function summariseHubdocWeek(
  rows: HubdocResult[],
  weekStart: string,
  throughDate?: string,
) {
  const start = new Date(weekStart + "T12:00:00Z");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(weekStart) ||
    !Number.isFinite(start.getTime()) ||
    start.getUTCDay() !== 1 ||
    start.toISOString().slice(0, 10) !== weekStart
  )
    throw new Error("Hubdoc week must start on a Monday");
  const byKey = new Map(rows.map((row) => [row.run_key, row]));
  const weekly = receipt(byKey.get(`hubdoc:${weekStart}:week-reconciled`));
  let expectedDays = 0,
    recordedDays = 0,
    completeDays = 0;
  let dailyTotal = 0,
    codexTotal = 0,
    codexRecordedDays = 0;
  let hasSentAudit = weekly !== null;
  for (let i = 0; i < 5; i++) {
    const date = new Date(start.getTime() + i * 86400000)
      .toISOString()
      .slice(0, 10);
    if (throughDate && date > throughDate) break;
    expectedDays++;
    const run = receipt(byKey.get(`hubdoc:${date}:scheduled`));
    const audit = receipt(byKey.get(`hubdoc:${date}:sent-reconciled`));
    if (!run && !audit) continue;
    recordedDays++;
    if (run) {
      codexTotal += run.count;
      codexRecordedDays++;
    }
    if (audit) hasSentAudit = true;
    const count = Math.max(run?.count ?? 0, audit?.count ?? 0);
    dailyTotal += count;
    if (audit ? audit.complete && audit.count === count : run?.complete)
      completeDays++;
  }
  const anyReceipts = recordedDays > 0 || weekly !== null;
  const forwarded = anyReceipts
    ? Math.max(dailyTotal, weekly?.count ?? 0)
    : null;
  const basis: Basis = hasSentAudit
    ? codexRecordedDays
      ? "mixed"
      : "sent_reconciliation"
    : codexRecordedDays
      ? "codex_run"
      : "missing";
  const complete = weekly
    ? weekly.complete && weekly.count === forwarded
    : expectedDays > 0 && completeDays === expectedDays;
  const coverage: Coverage = complete
    ? "complete"
    : anyReceipts
      ? "partial"
      : "missing";
  return {
    forwarded,
    basis,
    codexForwarded: codexRecordedDays ? codexTotal : null,
    codexRecordedDays,
    recordedDays: weekly ? null : recordedDays,
    expectedDays,
    coverage,
    ingestion: "unverified" as const,
  };
}
