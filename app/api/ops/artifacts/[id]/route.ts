import { respond } from "@/lib/ops/http";
import { requireOpsScope } from "@/lib/ops/scoped-auth";
import {
  getArtifact,
  listArtifactItems,
  getArtifactHistory,
} from "@/lib/ops/actions";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  return respond(async () => {
    requireOpsScope(request, "artifacts:read");
    const { id } = await context.params;
    const [artifact, items, decisions] = await Promise.all([
      getArtifact(id),
      listArtifactItems(id),
      getArtifactHistory(id),
    ]);
    return { artifact, items, decisions };
  });
}
