import { respond } from "@/lib/ops/http";
import { requireOpsScope } from "@/lib/ops/scoped-auth";
import {
  getWorkspaceResult,
  listWorkspaceResults,
  submitWorkspaceResult,
} from "@/lib/ops/workspace-results";
import { OpsError } from "@/lib/ops/tasks";
export async function GET(request: Request) {
  return respond(async () => {
    requireOpsScope(request, "workspace:read");
    const id = new URL(request.url).searchParams.get("id");
    if (id) return { result: await getWorkspaceResult(id) };
    return { results: await listWorkspaceResults() };
  });
}
export async function POST(request: Request) {
  return respond(async () => {
    const actor = requireOpsScope(request, "workspace:write");
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 65536)
      throw new OpsError("Result is too large", 413);
    return {
      result: await submitWorkspaceResult(JSON.parse(raw), actor.actor),
    };
  });
}
