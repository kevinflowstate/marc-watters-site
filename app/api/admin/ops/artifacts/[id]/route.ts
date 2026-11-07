import { adminActor, respond } from "@/lib/ops/http";
import { getArtifactDetail } from "@/lib/ops/artifact-execution";
import { getArtifactHistory } from "@/lib/ops/actions";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  return respond(async () => {
    await adminActor();
    const { id } = await context.params;
    const [detail, decisions] = await Promise.all([
      getArtifactDetail(id),
      getArtifactHistory(id),
    ]);
    return { ...detail, decisions };
  });
}
