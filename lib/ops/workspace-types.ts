import type { OpsLink, OpsTask } from "./types";
export const resultKinds = [
  "daily_brief",
  "payments",
  "sales_review",
  "content",
  "weekly_report",
  "portal_check",
] as const;
export type WorkspaceResult = {
  id: string;
  run_key: string;
  kind: (typeof resultKinds)[number];
  title: string;
  summary: string;
  body: string;
  outcome: "complete" | "partial" | "failed";
  coverage: string;
  observed_at: string;
  received_at: string;
  links: OpsLink[];
};
export const resultLabels: Record<WorkspaceResult["kind"], string> = {
  daily_brief: "Daily brief",
  payments: "Payment check",
  sales_review: "Sales-call review",
  content: "Content preparation",
  weekly_report: "Weekly report",
  portal_check: "Client activity check",
};

export type WorkspaceCard = {
  id: string;
  title: string;
  detail: string;
  next: string;
  owner: "marc" | "eimear" | "flowstate" | "system";
  area: OpsTask["area"];
  areas?: OpsTask["area"][];
  signal_ids?: string[];
  state: string;
  priority: number;
  url: string;
  source: string;
  observed_at: string | null;
  task_id?: string;
  history?: boolean;
  approval?: boolean;
  attention?: boolean;
};
export type SourceCheck = {
  key: string;
  label: string;
  ok: boolean;
  checked_at: string;
  count: number | null;
};
export type WorkspaceData = {
  checked_at: string;
  cards: WorkspaceCard[];
  tasks: OpsTask[];
  results: WorkspaceResult[];
  checks: SourceCheck[];
  controls: {
    content_scheduling: boolean;
    lesson_publication: boolean;
    payment_reminders: boolean;
    report_sending: boolean;
    notifications: boolean;
  };
  mode: "preview" | "production";
  scheduler: "paused" | "not_verified";
};
