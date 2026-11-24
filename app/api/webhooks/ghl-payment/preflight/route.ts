import { getEnv } from "@/lib/env";
import { secretMatches } from "@/lib/ops/auth";
import { respond } from "@/lib/ops/http";
import { reserveNativeReminder } from "@/lib/ops/payment-preflight";
import { OpsError } from "@/lib/ops/tasks";

export async function POST(request: Request) {
  return respond(async () => {
    if (
      !secretMatches(
        request.headers.get("x-payment-workflow-secret"),
        getEnv("OPS_PAYMENT_WORKFLOW_SECRET"),
      )
    )
      throw new OpsError("Unauthorized", 401);
    return reserveNativeReminder(await request.json());
  });
}
