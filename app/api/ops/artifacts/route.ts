import { respond } from "@/lib/ops/http";
import { requireOpsScope } from "@/lib/ops/scoped-auth";
import { listArtifacts, submitArtifact } from "@/lib/ops/actions";
export async function GET(request: Request) {
  return respond(async () => {
    requireOpsScope(request, "artifacts:read");
    return { artifacts: await listArtifacts() };
  });
}
export async function POST(request: Request) {
  return respond(async () => {
    const identity = requireOpsScope(request, "artifacts:write");
    return {
      artifact: await submitArtifact(await request.json(), identity.actor),
    };
  });
}
