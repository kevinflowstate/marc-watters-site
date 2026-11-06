import { adminActor, respond } from "@/lib/ops/http";
import { preflightPreparedContent } from "@/lib/ops/artifact-execution";

export const maxDuration = 300;
type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  return respond(async () => {
    await adminActor();
    return preflightPreparedContent(
      (await context.params).id,
      await request.json(),
    );
  });
}
