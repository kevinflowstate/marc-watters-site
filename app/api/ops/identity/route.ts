import { getEnv } from "@/lib/env";
import { respond } from "@/lib/ops/http";
import { portalActionSwitches } from "@/lib/ops/portal-controls";
import { requireOpsScope } from "@/lib/ops/scoped-auth";

export const dynamic = "force-dynamic";

/** Read-only destination proof before a scoped cloud helper submits a draft. */
export async function GET(request: Request) {
  const response = await respond(async () => {
    requireOpsScope(request, "portal:read");
    let databaseRef: string | null = null;
    try {
      const url = new URL(getEnv("NEXT_PUBLIC_SUPABASE_URL") ?? "");
      if (url.protocol === "https:" && !url.username && !url.password && !url.port && /^\w{20}\.supabase\.co$/.test(url.hostname)) {
        databaseRef = url.hostname.split(".")[0];
      }
    } catch { /* An unrecognised database must not masquerade as the preview. */ }
    const deployment = getEnv("VERCEL_ENV");
    const environment = deployment === "production" ? "production"
      : databaseRef === "abmmlybdqwzujcysagvf" ? "isolated_preview" : "unknown";
    const revision = getEnv("VERCEL_GIT_COMMIT_SHA") ?? "";
    return {
      identity: {
        application: "cbb-ops",
        environment,
        database_ref: databaseRef,
        revision: /^[a-f0-9]{40}$/.test(revision) ? revision : null,
      },
      controls: portalActionSwitches(),
    };
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
