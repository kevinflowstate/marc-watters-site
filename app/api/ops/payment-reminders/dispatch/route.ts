import { getEnv } from "@/lib/env";
import { secretMatches } from "@/lib/ops/auth";
import { respond } from "@/lib/ops/http";
import { claimPaymentDelivery } from "@/lib/ops/payment-delivery";
import { OpsError } from "@/lib/ops/tasks";

export async function POST(request: Request) {
  return respond(async () => {
    if (!secretMatches(request.headers.get("x-payment-workflow-secret"), getEnv("OPS_PAYMENT_WORKFLOW_SECRET")))
      throw new OpsError("Unauthorized", 401);
    return claimPaymentDelivery(await request.json());
  });
}
