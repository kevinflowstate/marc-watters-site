import { adminActor, respond } from "@/lib/ops/http";
import { reconcilePreparedArtifact } from "@/lib/ops/artifact-execution";
type Context = { params: Promise<{ id: string; key: string }> };
export async function POST(request: Request, context: Context) {
  return respond(async () => {
    const actor = await adminActor();
    const { id, key } = await context.params;
    return reconcilePreparedArtifact(id, key, await request.json(), actor);
  });
}
