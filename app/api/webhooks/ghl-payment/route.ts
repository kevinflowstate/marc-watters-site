import { respond } from "@/lib/ops/http";
import { secretMatches } from "@/lib/ops/auth";
import { getEnv } from "@/lib/env";
import { OpsError } from "@/lib/ops/tasks";
import { recordGhlPaymentProgress } from "@/lib/ops/payment-cases";

// Progress from the CRM reminder workflow (Custom Webhook actions).
export async function POST(request: Request) {
  return respond(async () => {
    if (
      !secretMatches(
        request.headers.get("x-payment-workflow-secret"),
        getEnv("OPS_PAYMENT_WORKFLOW_SECRET"),
      )
    )
      throw new OpsError("Unauthorized", 401);
    return recordGhlPaymentProgress(await request.json());
  });
}
