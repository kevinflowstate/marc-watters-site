export const areas = [
  "content",
  "lessons",
  "payments",
  "onboarding",
  "engagement",
  "inbox",
  "finance",
  "events",
  "reporting",
  "other",
] as const;
export const assignees = ["marc", "eimear", "flowstate", "system"] as const;
export const statuses = [
  "open",
  "in_progress",
  "awaiting_approval",
  "approved",
  "rejected",
  "done",
  "cancelled",
] as const;
export type OpsLink = {
  label: string;
  url: string;
  type?: "video" | "image" | "doc" | "json";
};
export type OpsTask = {
  id: string;
  kind: "task" | "approval" | "flag";
  status: (typeof statuses)[number];
  title: string;
  detail: string | null;
  area: (typeof areas)[number];
  assignee: (typeof assignees)[number];
  priority: number;
  client_id: string | null;
  source: string;
  external_ref: string | null;
  proposal_revision: number;
  links: OpsLink[];
  outputs: OpsLink[];
  payload: Record<string, unknown>;
  due_at: string | null;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  /** When the task last became done (from its activity history); set by the workspace feed. */
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
  client_profiles?: { users: { full_name: string } | null } | null;
};
