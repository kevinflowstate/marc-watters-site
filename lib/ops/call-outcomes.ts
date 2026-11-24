export const outcomeLabels = {
  won: "Converted",
  lost: "Did not convert",
  follow_up: "Follow-up",
  unqualified: "Not qualified",
  no_show: "No-show",
} as const;
export type CallOutcome = keyof typeof outcomeLabels;

export function validOutcome(value: unknown): value is CallOutcome {
  return typeof value === "string" && Object.hasOwn(outcomeLabels, value);
}

export function outcomeStats(
  calls: { outcome: CallOutcome | null; status?: string }[],
) {
  const counts = {
    won: 0,
    lost: 0,
    follow_up: 0,
    unqualified: 0,
    no_show: 0,
    unmarked: 0,
  };
  for (const call of calls)
    if (call.status !== "cancelled") counts[call.outcome ?? "unmarked"]++;
  const decided = counts.won + counts.lost;
  return {
    ...counts,
    qualified_decisions: decided,
    close_rate: decided ? Math.round((1000 * counts.won) / decided) / 10 : null,
  };
}

/** Saved reports before the scheduled-call tile already stored total slots and cancellations. */
export function scheduledStrategyCalls(period?: { scheduled?: number; cancelled?: number; non_cancelled_scheduled?: number }) {
  if (typeof period?.non_cancelled_scheduled === "number") return period.non_cancelled_scheduled;
  if (typeof period?.scheduled !== "number" || typeof period.cancelled !== "number") return null;
  return period.scheduled - period.cancelled;
}
