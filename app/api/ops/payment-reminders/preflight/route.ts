import { respond } from "@/lib/ops/http";
import { secretMatches } from "@/lib/ops/auth";
import { getEnv } from "@/lib/env";
import { OpsError, record } from "@/lib/ops/tasks";
import { paymentReminderPreflightForContact } from "@/lib/ops/payment-cases";
import { MARC_PAYMENT_LOCATION } from "@/lib/ops/payment-policy";

// The contact-triggered first reminder holds when more than one invoice needs attention.
// This endpoint reserves permission only. It never sends a message.
export async function POST(request: Request) {
  return respond(async () => {
    if (!secretMatches(request.headers.get("x-payment-workflow-secret"), getEnv("OPS_PAYMENT_WORKFLOW_SECRET")))
      throw new OpsError("Unauthorized", 401);
    const body = record(await request.json());
    if (Object.keys(body).some(key => !["location_id", "contact_id", "step_key", "workflow_run_id"].includes(key)) || body.location_id !== MARC_PAYMENT_LOCATION || typeof body.contact_id !== "string")
      throw new OpsError("Marc's location and contact are required");
    return paymentReminderPreflightForContact(body.contact_id, {
      step_key: body.step_key,
      ...(body.workflow_run_id === undefined ? {} : { workflow_run_id: body.workflow_run_id }),
    });
  });
}
