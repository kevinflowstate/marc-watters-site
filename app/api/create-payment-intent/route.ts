import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    return NextResponse.json({
      clientSecret: "demo_mode",
      customerId: "cus_demo",
      amount: 0,
      demo: true,
    });
  }

  const stripe = new Stripe(secretKey);

  try {
    const { amount, description, customerEmail, customerName, isSplit } = await req.json();

    if (!amount || amount < 100) {
      return NextResponse.json({ error: "Amount must be at least £1.00" }, { status: 400 });
    }

    // For split payments, create a Customer so we can charge them again later
    let customerId: string | undefined;

    if (isSplit) {
      const customer = await stripe.customers.create({
        name: customerName || undefined,
        email: customerEmail || undefined,
        metadata: { source: "cbb-closer-terminal" },
      });
      customerId = customer.id;
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "gbp",
      description,
      receipt_email: customerEmail || undefined,
      customer: customerId,
      // Save card for future use on split payments
      ...(isSplit && { setup_future_usage: "off_session" as const }),
      metadata: {
        customer_name: customerName || "",
        customer_email: customerEmail || "",
        source: "cbb-closer-terminal",
        is_split: isSplit ? "true" : "false",
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      customerId: customerId || null,
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      demo: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payment failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
