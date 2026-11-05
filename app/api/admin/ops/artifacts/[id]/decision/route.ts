import { adminActor, respond } from "@/lib/ops/http";
import { decidePreparedArtifact } from "@/lib/ops/artifact-execution";
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) {
  return respond(async () => {
    const actor = await adminActor();
    return {
      artifact: await decidePreparedArtifact(
        (await context.params).id,
        await request.json(),
        actor,
      ),
    };
  });
}
