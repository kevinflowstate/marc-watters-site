import { createHash, timingSafeEqual } from "node:crypto";
import { getEnv } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { OpsError } from "./tasks";

export const opsScopes = [
  "artifacts:read",
  "artifacts:write",
  "reports:read",
  "reports:write",
  "tasks:read",
  "tasks:write",
  "payments:read",
  "portal:read",
  "workspace:read",
  "workspace:write",
] as const;
export type OpsScope = (typeof opsScopes)[number];
type Credential = { id: string; sha256: string; scopes: OpsScope[] };
export function readScopedCredentials(raw: string | undefined): Credential[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new OpsError("Scoped access is not configured correctly", 503);
  }
  if (!Array.isArray(parsed) || parsed.length > 50)
    throw new OpsError("Scoped access is not configured correctly", 503);
  const credentials: Credential[] = [];
  const ids = new Set<string>(),
    hashes = new Set<string>();
  for (const value of parsed) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new OpsError("Scoped access is not configured correctly", 503);
    const v = value as Record<string, unknown>;
    if (
      Object.keys(v).some((k) => !["id", "sha256", "scopes"].includes(k)) ||
      typeof v.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,80}$/.test(v.id) ||
      typeof v.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(v.sha256) ||
      !Array.isArray(v.scopes) ||
      !v.scopes.length ||
      v.scopes.some((s) => !opsScopes.includes(s as OpsScope)) ||
      ids.has(v.id) ||
      hashes.has(v.sha256)
    )
      throw new OpsError("Scoped access is not configured correctly", 503);
    ids.add(v.id);
    hashes.add(v.sha256);
    credentials.push({
      id: v.id,
      sha256: v.sha256,
      scopes: [...new Set(v.scopes)] as OpsScope[],
    });
  }
  return credentials;
}
export function authenticateOpsScoped(request: Request) {
  const authorization = request.headers.get("authorization");
  if (
    !authorization?.startsWith("Bearer ") ||
    authorization.length < 40 ||
    authorization.length > 4096
  )
    throw new OpsError("Unauthorized", 401);
  const token = authorization.slice(7);
  if (!token || token.trim() !== token || /\s/.test(token))
    throw new OpsError("Unauthorized", 401);
  const digest = createHash("sha256").update(token).digest();
  let matched: Credential | undefined;
  for (const credential of readScopedCredentials(
    getEnv("OPS_SCOPED_TOKENS_JSON"),
  )) {
    if (timingSafeEqual(digest, Buffer.from(credential.sha256, "hex")))
      matched = credential;
  }
  if (!matched) throw new OpsError("Unauthorized", 401);
  if (!rateLimit(`ops-scoped:${matched.id}`, 120, 60000).success)
    throw new OpsError("Too many requests", 429);
  return {
    id: matched.id,
    actor: `integration:${matched.id}`,
    scopes: matched.scopes,
  };
}
export function requireOpsScope(request: Request, scope: OpsScope) {
  const identity = authenticateOpsScoped(request);
  if (!identity.scopes.includes(scope))
    throw new OpsError("This connection cannot perform that action", 403);
  return identity;
}
