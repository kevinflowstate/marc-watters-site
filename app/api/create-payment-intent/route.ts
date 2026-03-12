import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    // Demo mode - return a fake client secret
    return NextResponse.json({
      clientSecret: "demo_mode",
      amount: 0,
      demo: true,
    });
  }

  const stripe = new Stripe(secretKey);

  try {
    const { amount, description, customerEmail, customerName } = await req.json();

    if (!amount || amount < 100) {
      return NextResponse.json({ error: "Amount must be at least £1.00" }, { status: 400 });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount, // already in pence
      currency: "gbp",
      description,
      receipt_email: customerEmail || undefined,
      metadata: {
        customer_name: customerName || "",
        customer_email: customerEmail || "",
        source: "cbb-closer-terminal",
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      amount: paymentIntent.amount,
      demo: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payment failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
