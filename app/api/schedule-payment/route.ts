import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const webhookUrl = process.env.N8N_SPLIT_PAYMENT_WEBHOOK;

  try {
    const body = await req.json();
    const {
      customerId,
      paymentIntentId,
      secondPaymentAmount,
      scheduledDate,
      customerName,
      customerEmail,
      description,
    } = body;

    if (!webhookUrl) {
      console.log("[SPLIT PAYMENT] No N8N_SPLIT_PAYMENT_WEBHOOK configured. Payload:", JSON.stringify(body));
      return NextResponse.json({
        scheduled: false,
        message: "Webhook not configured - payment logged but not scheduled",
        demo: true,
      });
    }

    // Send to n8n for scheduling
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stripe_customer_id: customerId,
        first_payment_intent_id: paymentIntentId,
        second_payment_amount: secondPaymentAmount,
        second_payment_currency: "gbp",
        scheduled_date: scheduledDate,
        customer_name: customerName,
        customer_email: customerEmail,
        description,
        source: "cbb-closer-terminal",
      }),
    });

    if (!res.ok) {
      throw new Error(`n8n webhook returned ${res.status}`);
    }

    return NextResponse.json({ scheduled: true, scheduledDate });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to schedule payment";
    console.error("[SPLIT PAYMENT ERROR]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
