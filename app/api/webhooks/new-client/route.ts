import { createAdminClient } from "@/lib/supabase/admin";
import { createOrReplaceClientInvite } from "@/lib/client-invites";
import { sendWelcomeEmail } from "@/lib/email-templates";
import { NextResponse } from "next/server";

function generateTemporaryPassword(): string {
  const entropy = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
  return `Tmp!${entropy.slice(0, 24)}aA1`;
}

export async function POST(request: Request) {
  // Validate webhook secret
  const secret = request.headers.get("x-webhook-secret")?.trim();
  if (!secret || secret !== process.env.WEBHOOK_SECRET?.trim()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  console.log("[WEBHOOK] Raw body:", JSON.stringify(body));

  // GHL sends various field names — handle them all
  const name = (body.name || body.full_name || body.contact_name || body.fullName || body.contactName || [body.first_name || body.firstName, body.last_name || body.lastName].filter(Boolean).join(" "))?.trim();
  const email = (body.email || body.contact_email || body.contactEmail)?.trim()?.toLowerCase();

  if (!name || !email) {
    return NextResponse.json({ error: "name and email are required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Check if user already exists - don't error, just return success (idempotent)
  const { data: existing } = await admin
    .from("users")
    .select("id")
    .eq("email", email)
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ success: true, message: "Client already exists", alreadyExisted: true });
  }

  // Create user in Supabase Auth (triggers handle_new_user + handle_new_client)
  const { data: newUser, error: authError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password: generateTemporaryPassword(),
    user_metadata: {
      full_name: name,
      role: "client",
      app_name: "marc-watters-portal",
      requires_password_setup: true,
    },
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  // Wait for DB triggers to create profile
  await new Promise((r) => setTimeout(r, 1000));

  // Get the client profile
  const { data: profile } = await admin
    .from("client_profiles")
    .select("id")
    .eq("user_id", newUser.user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Client profile was not created" }, { status: 500 });
  }

  // The published "Welcome & Onboarding" module is auto-assigned by the DB trigger on client_profiles.

  // Create welcome notification
  await admin.from("notifications").insert({
    user_id: newUser.user.id,
    title: "Welcome to the Blueprint",
    message: `Welcome ${name.split(" ")[0]}! Your portal is set up and ready. Start by exploring your training modules and completing your first check-in.`,
    link: "/portal",
  });

  const { activationUrl: setupUrl } = await createOrReplaceClientInvite({
    userId: newUser.user.id,
    email,
    fullName: name,
  });

  // Send welcome email
  let emailSent = false;
  try {
    if (setupUrl) {
      await sendWelcomeEmail(email, name, setupUrl);
      emailSent = true;
    }
  } catch (e) {
    console.log("[WEBHOOK] Welcome email failed:", e instanceof Error ? e.message : e);
  }

  return NextResponse.json({
    success: true,
    userId: newUser.user.id,
    profileId: profile.id,
    emailSent,
    setupUrl: emailSent ? null : setupUrl,
  });
}
