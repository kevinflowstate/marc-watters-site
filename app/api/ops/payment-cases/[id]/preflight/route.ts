import { respond } from "@/lib/ops/http";
import { secretMatches } from "@/lib/ops/auth";
import { getEnv } from "@/lib/env";
import { OpsError } from "@/lib/ops/tasks";
import { paymentReminderPreflight } from "@/lib/ops/payment-cases";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return respond(async () => {
    if (
      !secretMatches(
        request.headers.get("x-payment-workflow-secret"),
        getEnv("OPS_PAYMENT_WORKFLOW_SECRET"),
      )
    )
      throw new OpsError("Unauthorized", 401);
    return paymentReminderPreflight(
      (await context.params).id,
      await request.json(),
    );
  });
}
