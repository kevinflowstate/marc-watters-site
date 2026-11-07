import { adminActor, respond } from "@/lib/ops/http";
import { bindPaymentContact } from "@/lib/ops/payment-cases";
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) {
  return respond(async () => {
    const actor = await adminActor();
    return {
      payment_case: await bindPaymentContact(
        (await context.params).id,
        await request.json(),
        actor,
      ),
    };
  });
}
