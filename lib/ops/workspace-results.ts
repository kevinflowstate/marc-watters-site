import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { canonicalJson } from "./action-validation";
import { OpsError, record, safeLink, uuid } from "./tasks";

import { resultKinds, type WorkspaceResult } from "./workspace-types";

export function validateWorkspaceResult(input: unknown, now = Date.now()) {
  const b = record(input);
  const fields = [
    "run_key",
    "kind",
    "title",
    "summary",
    "body",
    "outcome",
    "coverage",
    "observed_at",
    "links",
  ];
  if (Object.keys(b).some((k) => !fields.includes(k)))
    throw new OpsError("Unsupported result field");
  for (const [key, max] of Object.entries({
    run_key: 200,
    title: 200,
    summary: 1000,
    body: 20000,
    coverage: 2000,
  })) {
    if (
      typeof b[key] !== "string" ||
      !(b[key] as string).trim() ||
      (b[key] as string).length > max
    )
      throw new OpsError(`A bounded ${key} is required`);
  }
  if (!/^[a-zA-Z0-9:_./-]+$/.test(String(b.run_key)))
    throw new OpsError("Invalid run key");
  if (!resultKinds.includes(b.kind as WorkspaceResult["kind"]))
    throw new OpsError("Invalid result kind");
  if (!["complete", "partial", "failed"].includes(String(b.outcome)))
    throw new OpsError("Result coverage must be declared");
  const at =
    typeof b.observed_at === "string" ? Date.parse(b.observed_at) : NaN;
  if (!Number.isFinite(at) || at > now + 300000)
    throw new OpsError(
      "Valid observation time required; it cannot be in the future",
    );
  if (!Array.isArray(b.links) || b.links.length > 12)
    throw new OpsError("Up to twelve source links are allowed");
  return {
    run_key: String(b.run_key),
    kind: b.kind as WorkspaceResult["kind"],
    title: String(b.title).trim(),
    summary: String(b.summary).trim(),
    body: String(b.body).trim(),
    outcome: b.outcome as WorkspaceResult["outcome"],
    coverage: String(b.coverage).trim(),
    observed_at: new Date(at).toISOString(),
    links: b.links.map(safeLink),
  };
}
export async function submitWorkspaceResult(input: unknown, actor: string) {
  const body = validateWorkspaceResult(input);
  const hash = createHash("sha256").update(canonicalJson(body)).digest("hex");
  const r = await createAdminClient().rpc("ops_submit_workspace_result", {
    p_document: body,
    p_hash: hash,
    p_actor: actor,
  });
  if (r.error) {
    if (r.error.code === "P0001" && r.error.message === "Run key already used")
      throw new OpsError(
        "This run was already saved with different content; use a new run key for a correction",
        409,
      );
    throw new OpsError(
      "The save could not be confirmed. Retry the SAME run key and unchanged content; do not create a duplicate",
      503,
    );
  }
  return r.data as WorkspaceResult;
}
export async function getWorkspaceResult(id: string) {
  const r = await createAdminClient()
    .from("ops_workspace_results")
    .select("*")
    .eq("id", uuid(id))
    .maybeSingle();
  if (r.error) throw new OpsError("Saved result could not be checked", 503);
  if (!r.data) throw new OpsError("Saved result not found", 404);
  return r.data as WorkspaceResult;
}
export async function listWorkspaceResults() {
  // One independent query per kind prevents a busy job hiding another job's last result.
  const rows = await Promise.all(
    resultKinds.map(async (kind) => {
      const r = await createAdminClient()
        .from("ops_workspace_results")
        .select("*")
        .eq("kind", kind)
        .order("observed_at", { ascending: false })
        .order("received_at", { ascending: false })
        .limit(5);
      if (r.error)
        throw new OpsError("Codex results could not be checked", 503);
      return r.data as WorkspaceResult[];
    }),
  );
  return rows.flat();
}
