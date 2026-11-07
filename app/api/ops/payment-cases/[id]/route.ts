import { respond } from "@/lib/ops/http";
import { requireOpsScope } from "@/lib/ops/scoped-auth";
import { getPaymentCase } from "@/lib/ops/payment-cases";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return respond(async () => {
    requireOpsScope(request, "payments:read");
    return getPaymentCase((await context.params).id);
  });
}
