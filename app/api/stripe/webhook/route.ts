import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secretKey || !webhookSecret) {
    console.log("[STRIPE WEBHOOK] Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  const stripe = new Stripe(secretKey);
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    console.error("[STRIPE WEBHOOK] Signature verification failed:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    await handleCheckoutCompleted(session);
  }

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object as Stripe.PaymentIntent;
    // Log for tracking - main onboarding is via checkout.session.completed
    console.log(`[STRIPE WEBHOOK] Payment succeeded: ${intent.id} - ${intent.amount / 100} ${intent.currency}`);
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const email = session.customer_email || session.customer_details?.email;
  const name = session.customer_details?.name || "";
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;

  if (!email) {
    console.error("[STRIPE WEBHOOK] No email on checkout session:", session.id);
    return;
  }

  console.log(`[STRIPE WEBHOOK] Processing checkout for ${email} (${name})`);

  const admin = createAdminClient();

  // Check if user already exists
  const { data: existingUsers } = await admin
    .from("users")
    .select("id")
    .eq("email", email)
    .limit(1);

  if (existingUsers && existingUsers.length > 0) {
    console.log(`[STRIPE WEBHOOK] User ${email} already exists, skipping creation`);
    return;
  }

  // Create user in Supabase Auth (triggers handle_new_user + handle_new_client)
  const { data: newUser, error: authError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      full_name: name,
      role: "client",
      stripe_customer_id: customerId || null,
    },
  });

  if (authError) {
    console.error("[STRIPE WEBHOOK] Failed to create user:", authError.message);
    return;
  }

  console.log(`[STRIPE WEBHOOK] Created user ${newUser.user.id} for ${email}`);

  // Wait briefly for triggers to fire
  await new Promise((r) => setTimeout(r, 1000));

  // Get the client profile that was auto-created by the trigger
  const { data: profile } = await admin
    .from("client_profiles")
    .select("id")
    .eq("user_id", newUser.user.id)
    .single();

  if (!profile) {
    console.error("[STRIPE WEBHOOK] No client profile found for user:", newUser.user.id);
    return;
  }

  // Auto-assign default training modules
  const { data: defaultModules } = await admin
    .from("training_modules")
    .select("id")
    .eq("is_published", true);

  if (defaultModules && defaultModules.length > 0) {
    const assignments = defaultModules.map((mod) => ({
      client_id: profile.id,
      module_id: mod.id,
      status: "locked" as const,
    }));

    await admin.from("client_modules").insert(assignments);
    console.log(`[STRIPE WEBHOOK] Assigned ${assignments.length} modules to ${email}`);
  }

  // Create welcome notification
  await admin.from("notifications").insert({
    user_id: newUser.user.id,
    title: "Welcome to the Blueprint",
    message: "Your portal is set up and ready. Start by watching the onboarding video and completing your business profile.",
    link: "/portal",
  });

  // Generate password reset link so client can set their password
  const { data: linkData } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
  });

  if (linkData) {
    console.log(`[STRIPE WEBHOOK] Password reset link generated for ${email}`);
    // TODO: Send via email when domain is configured
  }

  console.log(`[STRIPE WEBHOOK] Onboarding complete for ${email}`);
}
