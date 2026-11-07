import { respond } from "@/lib/ops/http";
import { secretMatches } from "@/lib/ops/auth";
import { getEnv } from "@/lib/env";
import { OpsError } from "@/lib/ops/tasks";
import { recordPayment } from "@/lib/ops/payments";
import { recordGhlPaymentCaseEvent } from "@/lib/ops/payment-cases";
export async function POST(request: Request) {
  return respond(async () => {
    const body = await request.json();
    if (body?.schema_version === 2) {
      if (
        !secretMatches(
          request.headers.get("x-payment-workflow-secret"),
          getEnv("OPS_PAYMENT_WORKFLOW_SECRET"),
        )
      )
        throw new OpsError("Unauthorized", 401);
      return recordGhlPaymentCaseEvent(body);
    }
    if (getEnv("OPS_LEGACY_PAYMENT_EVENTS_ENABLED") !== "true")
      throw new OpsError(
        "Use signed Stripe invoice events and the invoice-scoped CRM handoff; legacy payment events are disabled",
        409,
      );
    if (
      !secretMatches(
        request.headers.get("x-webhook-secret"),
        getEnv("OPS_WEBHOOK_SECRET"),
      )
    )
      throw new OpsError("Unauthorized", 401);
    return recordPayment(body);
  });
}
