import type { OpsTask } from "./types";

export const ownerLabels = {
  marc: "Marc",
  eimear: "Eimear",
  flowstate: "Flowstate",
  system: "Automation",
};
export const areaLabels = {
  content: "Content",
  lessons: "Lessons",
  payments: "Payments",
  onboarding: "New clients",
  engagement: "Client check-ins",
  inbox: "Inbox & diary",
  finance: "Money records",
  events: "Events",
  reporting: "Reports",
  other: "Other",
};
export const statusLabels = {
  open: "To do",
  in_progress: "In progress",
  awaiting_approval: "Needs approval",
  approved: "Approved · action pending",
  rejected: "Changes requested",
  done: "Completed",
  cancelled: "Cancelled",
};
export function isClosed(task: Pick<OpsTask, "status">) {
  return ["done", "cancelled", "rejected"].includes(task.status);
}
export function needsApproval(task: Pick<OpsTask, "kind" | "status">) {
  return (
    task.kind === "approval" &&
    ["open", "in_progress", "awaiting_approval"].includes(task.status)
  );
}
export function workViews(tasks: OpsTask[]) {
  return {
    "All current": tasks.filter((t) => !isClosed(t)),
    "Needs approval": tasks.filter(needsApproval),
    "Needs attention": tasks.filter((t) => t.kind === "flag" && !isClosed(t)),
    History: tasks.filter(isClosed),
  };
}
