import { respond } from "@/lib/ops/http";
import { receiveStripePaymentEvent } from "@/lib/ops/payment-cases";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  context: { params: Promise<{ account: string }> },
) {
  return respond(async () =>
    receiveStripePaymentEvent(
      (await context.params).account,
      await request.text(),
      request.headers.get("stripe-signature"),
    ),
  );
}
