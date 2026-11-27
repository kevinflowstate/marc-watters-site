import { adminActor, respondPrivate } from "@/lib/ops/http";
import { saveManualSale } from "@/lib/ops/manual-sales";
import { isBusinessManager } from "@/lib/ops/team-identities";
import { OpsError } from "@/lib/ops/tasks";

export function POST(request: Request) {
  return respondPrivate(async () => {
    const actor = await adminActor();
    if (!isBusinessManager(actor)) throw new OpsError("Manager access required", 403);
    await saveManualSale(await request.json(), actor);
    return { saved: true };
  });
}
