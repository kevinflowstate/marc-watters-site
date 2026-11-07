import { respond } from "@/lib/ops/http";
import { requireOpsScope } from "@/lib/ops/scoped-auth";
import { listPaymentCases } from "@/lib/ops/payment-cases";
export async function GET(request: Request) {
  return respond(async () => {
    requireOpsScope(request, "payments:read");
    return { payment_cases: await listPaymentCases() };
  });
}
