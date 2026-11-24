import { businessCapabilities } from "./team-identities";
import { resultLabels, type WorkspaceResult } from "./workspace-types";

type Row = Record<string, unknown>;

function object(value: unknown): Row {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
}

function fields(value: unknown, names: string[]) {
  const row = object(value);
  return Object.fromEntries(names.filter(name => Object.hasOwn(row, name)).map(name => [name, row[name]]));
}

const callMetrics = ["scheduled", "cancelled", "won", "lost", "follow_up", "unqualified", "no_show", "unmarked", "qualified_decisions", "close_rate"];
const hubdocMetrics = ["basis", "codexForwarded", "codexRecordedDays", "forwarded", "recordedDays", "expectedDays", "coverage", "ingestion", "weekStart", "checkedAt"];

export function operationalOverview(value: unknown) {
  const ops = object(value);
  return {
    ...fields(ops, ["leads", "posts", "bookingsMade", "recurring"]),
    calls: ops.calls ? fields(ops.calls, callMetrics) : null,
    tasks: fields(ops.tasks, ["open", "priority", "completed"]),
    hubdoc: ops.hubdoc ? fields(ops.hubdoc, hubdocMetrics) : null,
  };
}

export function reportHeader(row: Row) {
  return fields(row, ["id", "week_start", "status", "updated_at"]);
}

export function reportForActor(row: Row, actor: string) {
  if (businessCapabilities(actor).canViewRevenue) return row;
  const data = object(row.data);
  const period = (range: unknown) => fields(range, ["range", "tasks_completed", "inbox", "checkins"]);
  return {
    ...reportHeader(row),
    shared_observations_md: row.shared_observations_md || "",
    locked: Boolean(row.send_claim_id) || row.status === "sent",
    data: {
      ...fields(data, ["generated_at", "periods", "outstanding", "clients", "lessons", "strategy_calls"]),
      current: period(data.current),
      previous: period(data.previous),
      ...(data.dashboard ? {
        dashboard: fields(data.dashboard, ["leads", "calls", "recurring", "posts", "receipts", "previousReceipts"]),
      } : {}),
    },
  };
}

/** These result writers combine operational and financial sources in a single free-text document. */
export function workspaceResultForActor(row: WorkspaceResult, actor: string): WorkspaceResult {
  if (businessCapabilities(actor).canViewRevenue || row.kind === "content" || row.kind === "portal_check") return row;
  const hubdoc = row.kind === "payments" && row.run_key.startsWith("hubdoc:");
  const forwards = hubdoc && /^Hubdoc forwards: (\d{1,6})\.(?:\s|$)/i.exec(row.summary);
  const summary = forwards ? "Hubdoc forwards: " + forwards[1] + "." : "Run status recorded.";
  return {
    id: row.id, kind: row.kind, run_key: row.run_key,
    title: hubdoc ? "Hubdoc forwarding" : resultLabels[row.kind],
    summary, body: summary, coverage: row.outcome,
    outcome: row.outcome, observed_at: row.observed_at, received_at: row.received_at, links: [],
  };
}
