import { adminActor, respond } from "@/lib/ops/http";
import { artifactSnapshot } from "@/lib/ops/action-validation";
import { prepareContentDeliveryPack } from "@/lib/ops/content-media-staging";
import { getEnv } from "@/lib/env";
import { record, OpsError } from "@/lib/ops/tasks";
type Context = { params: Promise<{ id: string }> };
export const maxDuration = 60;
export async function POST(request: Request, context: Context) {
  return respond(async () => {
    await adminActor();
    const body = record(await request.json());
    if (Object.keys(body).some((k) => !["version", "manifest_hash"].includes(k))) throw new OpsError("Only the reviewed content version is accepted");
    return prepareContentDeliveryPack((await context.params).id, artifactSnapshot(body), getEnv("OPS_CONTENT_DELIVERY_ORIGIN") || "");
  });
}
