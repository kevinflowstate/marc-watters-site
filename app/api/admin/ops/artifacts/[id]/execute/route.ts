import { adminActor, respond } from "@/lib/ops/http";
import { executePreparedArtifact } from "@/lib/ops/artifact-execution";
export const maxDuration = 300;
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) {
  return respond(async () => {
    const actor = await adminActor();
    return executePreparedArtifact(
      (await context.params).id,
      await request.json(),
      actor,
    );
  });
}
