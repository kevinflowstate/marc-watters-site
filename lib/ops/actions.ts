import { createAdminClient } from "@/lib/supabase/admin";
import { OpsError, record, uuid } from "./tasks";
import {
  artifactSnapshot,
  jsonObject,
  prepareArtifact,
  receiptObject,
} from "./action-validation";
import type {
  ArtifactDecision,
  ArtifactItem,
  ArtifactSnapshot,
  OpsArtifact,
} from "./action-types";
export * from "./action-types";

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const result = await createAdminClient().rpc(name, args);
  if (result.error)
    throw new OpsError(
      result.error.message,
      result.error.code === "P0002" ? 404 : 409,
    );
  return result.data as T;
}
export async function submitArtifact(input: unknown, actor: string) {
  if (!actor || actor.length > 200)
    throw new OpsError("Artifact submitter required");
  const prepared = prepareArtifact(input);
  const { expected, ...document } = prepared;
  return rpc<OpsArtifact>("ops_submit_artifact", {
    p_document: document,
    p_actor: actor,
    p_expected_version: expected?.version ?? null,
    p_expected_hash: expected?.manifest_hash ?? null,
  });
}
export async function listArtifacts() {
  const result = await createAdminClient()
    .from("ops_artifacts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (result.error) throw new OpsError("Unable to load prepared work", 503);
  return result.data as OpsArtifact[];
}
export async function getArtifact(id: string) {
  const result = await createAdminClient()
    .from("ops_artifacts")
    .select("*")
    .eq("id", uuid(id))
    .maybeSingle();
  if (result.error) throw new OpsError("Unable to load prepared work", 503);
  if (!result.data) throw new OpsError("Artifact not found", 404);
  return result.data as OpsArtifact;
}
export async function listArtifactItems(id: string) {
  const result = await createAdminClient()
    .from("ops_artifact_items")
    .select("*")
    .eq("artifact_id", uuid(id))
    .order("item_key");
  if (result.error) throw new OpsError("Unable to load action results", 503);
  return result.data as ArtifactItem[];
}
export async function getArtifactHistory(id: string) {
  const result = await createAdminClient()
    .from("ops_artifact_decisions")
    .select(
      "id,artifact_id,version,manifest_hash,action,destination,decision,actor_id,note,created_at",
    )
    .eq("artifact_id", uuid(id))
    .order("created_at", { ascending: false });
  if (result.error) throw new OpsError("Unable to load approval history", 503);
  return result.data as ArtifactDecision[];
}
export function decideArtifact(
  id: string,
  input: unknown,
  authenticatedAdminUserId: string,
) {
  const b = record(input),
    snapshot = artifactSnapshot(b);
  if (
    Object.keys(b).some(
      (key) => !["version", "manifest_hash", "decision", "note"].includes(key),
    )
  )
    throw new OpsError("Unsupported decision field");
  if (b.decision !== "approved" && b.decision !== "rejected")
    throw new OpsError("Invalid artifact decision");
  if (b.note != null && (typeof b.note !== "string" || b.note.length > 20000))
    throw new OpsError("Invalid decision note");
  if (b.decision === "rejected" && !String(b.note ?? "").trim())
    throw new OpsError("Add a change request note");
  return rpc<OpsArtifact>("ops_decide_artifact", {
    p_id: uuid(id),
    p_version: snapshot.version,
    p_hash: snapshot.manifest_hash,
    p_decision: b.decision,
    p_actor: uuid(authenticatedAdminUserId),
    p_note: b.note ?? null,
  });
}
export function claimArtifact(
  id: string,
  snapshot: ArtifactSnapshot,
  authenticatedAdminUserId: string,
) {
  const expected = artifactSnapshot(snapshot);
  return rpc<{
    artifact: OpsArtifact;
    claim_id: string | null;
    reused: boolean;
  }>("ops_claim_artifact", {
    p_id: uuid(id),
    p_version: expected.version,
    p_hash: expected.manifest_hash,
    p_actor: uuid(authenticatedAdminUserId),
  });
}
function itemKey(key: string) {
  if (typeof key !== "string" || !key.trim() || key.length > 200)
    throw new OpsError("Invalid action item key");
  return key;
}
export function claimArtifactItem(id: string, claimId: string, key: string) {
  return rpc<{ item: ArtifactItem; claimed: boolean }>(
    "ops_claim_artifact_item",
    { p_id: uuid(id), p_claim: uuid(claimId), p_item: itemKey(key) },
  );
}
export function recordArtifactItem(
  id: string,
  claimId: string,
  key: string,
  input: unknown,
) {
  const b = record(input);
  if (
    Object.keys(b).some(
      (name) => !["status", "receipt", "error"].includes(name),
    ) ||
    !["succeeded", "failed", "unknown"].includes(String(b.status))
  )
    throw new OpsError("Invalid execution outcome");
  if (
    b.error != null &&
    (typeof b.error !== "string" || b.error.length > 20000)
  )
    throw new OpsError("Invalid action error");
  const receipt =
    b.status === "succeeded"
      ? receiptObject(b.receipt)
      : b.receipt == null
        ? null
        : jsonObject(b.receipt);
  return rpc<ArtifactItem>("ops_record_artifact_item", {
    p_id: uuid(id),
    p_claim: uuid(claimId),
    p_item: itemKey(key),
    p_status: b.status,
    p_receipt: receipt,
    p_error: b.error ?? null,
  });
}
export function finishArtifact(id: string, claimId: string) {
  return rpc<OpsArtifact>("ops_finish_artifact", {
    p_id: uuid(id),
    p_claim: uuid(claimId),
  });
}
export function reconcileArtifactItem(
  id: string,
  key: string,
  input: unknown,
  authenticatedAdminUserId: string,
) {
  const b = record(input);
  if (
    Object.keys(b).some(
      (name) =>
        ![
          "expected_updated_at",
          "resolution",
          "receipt",
          "note",
          "executor_stopped",
        ].includes(name),
    ) ||
    !["succeeded", "retryable_failure"].includes(String(b.resolution))
  )
    throw new OpsError("Invalid reconciliation");
  if (b.executor_stopped != null && typeof b.executor_stopped !== "boolean")
    throw new OpsError("Invalid executor confirmation");
  if (
    typeof b.expected_updated_at !== "string" ||
    !Number.isFinite(Date.parse(b.expected_updated_at))
  )
    throw new OpsError("Current item revision required");
  if (typeof b.note !== "string" || !b.note.trim() || b.note.length > 20000)
    throw new OpsError("Add evidence for the reconciliation");
  const receipt =
    b.resolution === "succeeded"
      ? receiptObject(b.receipt)
      : b.receipt == null
        ? null
        : jsonObject(b.receipt);
  return rpc<OpsArtifact>("ops_reconcile_artifact_item", {
    p_id: uuid(id),
    p_item: itemKey(key),
    p_expected_updated_at: b.expected_updated_at,
    p_resolution: b.resolution,
    p_receipt: receipt,
    p_note: b.note,
    p_actor: uuid(authenticatedAdminUserId),
    p_executor_stopped: b.executor_stopped === true,
  });
}
export function recordArtifactImport(
  id: string,
  input: unknown,
  authenticatedAdminUserId: string,
) {
  const b = record(input);
  if (
    Object.keys(b).some(
      (key) => !["provider", "file_id", "version", "sha256"].includes(key),
    ) ||
    b.provider !== "google_drive" ||
    typeof b.file_id !== "string" ||
    !/^[A-Za-z0-9_-]{1,200}$/.test(b.file_id) ||
    typeof b.version !== "string" ||
    !b.version.trim() ||
    b.version.length > 200 ||
    typeof b.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(b.sha256)
  )
    throw new OpsError("Verified pinned Drive source required");
  return rpc<{
    artifact_id: string;
    manifest_hash: string;
    provider: "google_drive";
    file_id: string;
    version: string;
    sha256: string;
    actor_id: string;
    created_at: string;
  }>("ops_record_artifact_import", {
    p_artifact: uuid(id),
    p_source: {
      provider: b.provider,
      file_id: b.file_id,
      version: b.version,
      sha256: b.sha256,
    },
    p_actor: uuid(authenticatedAdminUserId),
  });
}
