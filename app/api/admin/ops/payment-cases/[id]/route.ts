import { adminActor, respond } from "@/lib/ops/http";
import { getPaymentCase } from "@/lib/ops/payment-cases";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  return respond(async () => {
    await adminActor();
    return getPaymentCase((await context.params).id);
  });
}
