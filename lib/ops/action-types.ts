export type ArtifactKind = "content" | "lesson";
export type ArtifactAction = "schedule_content" | "publish_lesson";
export type ArtifactStatus =
  | "draft"
  | "approved"
  | "rejected"
  | "superseded"
  | "running"
  | "completed"
  | "needs_attention";
export type ArtifactItemStatus =
  "pending" | "running" | "succeeded" | "failed" | "unknown";
export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };
export type OpsArtifact = {
  id: string;
  external_ref: string;
  version: number;
  kind: ArtifactKind;
  action: ArtifactAction;
  title: string;
  payload: JsonObject;
  destination: JsonObject;
  item_keys: string[];
  manifest_hash: string;
  status: ArtifactStatus;
  submitted_by: string;
  approved_by: string | null;
  approved_at: string | null;
  claim_id: string | null;
  execution_started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};
export type ArtifactItem = {
  id: string;
  artifact_id: string;
  item_key: string;
  status: ArtifactItemStatus;
  receipt: JsonObject | null;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
};
export type ArtifactSnapshot = { version: number; manifest_hash: string };
export type ArtifactDecision = {
  id: string;
  artifact_id: string;
  version: number;
  manifest_hash: string;
  action: ArtifactAction;
  destination: JsonObject;
  decision: "approved" | "rejected";
  actor_id: string;
  note: string | null;
  created_at: string;
};
