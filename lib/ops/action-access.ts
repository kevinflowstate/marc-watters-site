import { getEnv } from "@/lib/env";
import { requireOps, secretMatches } from "./auth";
import {
  authenticateOpsScoped,
  requireOpsScope,
  type OpsScope,
} from "./scoped-auth";
import { OpsError, record } from "./tasks";

export type OpsAccess =
  | { kind: "legacy"; actor: "ops-token"; scopes: null }
  | { kind: "scoped"; actor: string; scopes: OpsScope[] };
export function opsAccess(request: Request, scope?: OpsScope): OpsAccess {
  // Existing trusted-admin access remains explicit. Do not distribute that token
  // when installing a draft-only connection.
  const expected = getEnv("OPS_API_TOKEN");
  if (
    expected &&
    secretMatches(request.headers.get("authorization"), `Bearer ${expected}`)
  ) {
    requireOps(request);
    return { kind: "legacy", actor: "ops-token", scopes: null };
  }
  const identity = scope
    ? requireOpsScope(request, scope)
    : authenticateOpsScoped(request);
  return { kind: "scoped", actor: identity.actor, scopes: identity.scopes };
}
export function hasOpsScope(access: OpsAccess, scope: OpsScope) {
  return access.kind === "legacy" || access.scopes.includes(scope);
}
export function scopedTaskInput(input: unknown, create = false) {
  const b = record(input);
  const allowed = [
    "title",
    "detail",
    "area",
    "assignee",
    "priority",
    "client_id",
    "links",
    "payload",
    "due_at",
    ...(create ? ["kind", "external_ref", "source", "status"] : []),
  ];
  for (const key of Object.keys(b))
    if (!allowed.includes(key))
      throw new OpsError(
        "This connection can prepare work but cannot decide, complete or replace action results",
        403,
      );
  if (
    create &&
    b.status != null &&
    !["open", "awaiting_approval"].includes(String(b.status))
  )
    throw new OpsError(
      "New prepared work must remain open or awaiting approval",
      403,
    );
  if (create && b.source != null && b.source !== "ai")
    throw new OpsError("Integration work must identify its AI source", 403);
  return { ...b, ...(create ? { source: "ai" } : {}) };
}
export function scopedOutputInput(input: unknown) {
  const b = record(input);
  if (Object.keys(b).some((key) => key !== "output") || !b.output)
    throw new OpsError(
      "This connection can attach an output but cannot approve or reject work",
      403,
    );
  return b.output;
}
