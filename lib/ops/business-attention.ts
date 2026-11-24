import type { Booking } from "@/lib/lead-dms/crm";
import type { CallOutcome } from "./call-outcomes";
import { londonDate } from "./task-weeks";
import type { WorkspaceData } from "./workspace-types";
import { needsApproval, isClosed, statusLabels } from "./workspace";

export type AttentionItem = {
  id: string;
  title: string;
  reason: string;
  href: string;
};
export type AttentionResult = { items: AttentionItem[]; unavailable: string[] };

type Source = Pick<WorkspaceData, "tasks" | "coaching" | "checks">;
type Call = Pick<
  Booking,
  "id" | "name" | "startTime" | "endTime" | "status"
> & { outcome: CallOutcome | null };
const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "short",
  });

export function businessAttention(
  workspace: Source | null,
  calls: Call[] | null,
  finance: boolean,
  now = new Date(),
): AttentionResult {
  const entries: (AttentionItem & { rank: number; when: string })[] = [];
  const unavailable: string[] = [];
  const today = londonDate(now);
  if (!workspace || workspace.checks.some((c) => c.key === "tasks" && !c.ok))
    unavailable.push("Workspace tasks");
  if (
    !workspace ||
    workspace.checks.some(
      (c) => ["clients", "messages", "checkins"].includes(c.key) && !c.ok,
    )
  )
    unavailable.push("Coaching replies");
  if (!calls) unavailable.push("Sales calls");
  for (const task of workspace?.tasks ?? []) {
    if (isClosed(task) || task.status === "approved") continue;
    if (!finance && (task.area === "finance" || task.area === "payments"))
      continue;
    const board =
      task.area === "events" &&
      typeof task.payload?.event_board_id === "string" &&
      task.payload.event_board_id;
    const question = board && task.status === "awaiting_approval";
    if (!question && task.assignee !== "marc") continue;
    if (
      task.source === "system" &&
      task.external_ref?.startsWith("engagement:")
    )
      continue;
    const due = task.due_at ? londonDate(new Date(task.due_at)) : null;
    const decision =
      question ||
      needsApproval(task) ||
      task.kind === "flag" ||
      task.status === "rejected";
    if (!decision && due && due > today) continue;
    const reason = question
      ? "Event question for Marc"
      : needsApproval(task)
        ? "Approval requested"
        : task.kind === "flag"
          ? "Flagged for Marc"
          : statusLabels[task.status];
    entries.push({
      id: "task:" + task.id,
      title: task.title,
      reason: reason + (due ? " · Due " + dateLabel(task.due_at!) : ""),
      href: board
        ? "/admin/events?board=" +
          encodeURIComponent(board) +
          "#step-" +
          encodeURIComponent(task.id)
        : "/admin/work?task=" + encodeURIComponent(task.id),
      rank: (due && due < today) || decision || task.priority === 1 ? 0 : 3,
      when: task.due_at || task.created_at,
    });
  }
  for (const call of calls ?? []) {
    if (
      call.status === "cancelled" ||
      Date.parse(call.endTime || call.startTime) > now.getTime() ||
      (call.outcome && call.outcome !== "follow_up")
    )
      continue;
    entries.push({
      id: "call:" + call.id,
      title: call.name,
      reason:
        (call.outcome === "follow_up"
          ? "Follow up after strategy call"
          : "Record strategy call outcome") +
        " · " +
        dateLabel(call.startTime),
      href: "/admin/sales-calls#call-" + encodeURIComponent(call.id),
      rank: 1,
      when: call.startTime,
    });
  }
  for (const card of workspace?.coaching ?? []) {
    const client = card.url.split("/").at(-1);
    const name = card.title.split(" · ")[0];
    if (card.signal_ids?.some((id) => id.startsWith("message:")))
      entries.push({
        id: card.id + ":message",
        title: name,
        reason: "Review client conversation",
        href: "/admin/inbox?client=" + encodeURIComponent(client || ""),
        rank: 2,
        when: card.observed_at || "",
      });
    if (card.signal_ids?.some((id) => id.startsWith("checkin:")))
      entries.push({
        id: card.id + ":checkin",
        title: name,
        reason: "Review client check-in",
        href: card.url,
        rank: 2,
        when: card.observed_at || "",
      });
  }
  return {
    items: entries
      .sort(
        (a, b) =>
          a.rank - b.rank ||
          a.when.localeCompare(b.when) ||
          a.title.localeCompare(b.title),
      )
      .map(({ id, title, reason, href }) => ({ id, title, reason, href })),
    unavailable,
  };
}
