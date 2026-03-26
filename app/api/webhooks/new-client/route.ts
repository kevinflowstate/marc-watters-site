import { createAdminClient } from "@/lib/supabase/admin";
import { sendWelcomeEmail } from "@/lib/email-templates";
import { getSiteUrl } from "@/lib/site-url";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  // Validate webhook secret
  const secret = request.headers.get("x-webhook-secret");
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const name = body.name?.trim();
  const email = body.email?.trim()?.toLowerCase();

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
    user_metadata: {
      full_name: name,
      role: "client",
      app_name: "marc-watters-portal",
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

  // Auto-assign published training modules
  const { data: modules } = await admin
    .from("training_modules")
    .select("id")
    .eq("is_published", true);

  if (modules && modules.length > 0) {
    await admin.from("client_modules").insert(
      modules.map((mod) => ({
        client_id: profile.id,
        module_id: mod.id,
        status: "locked" as const,
      }))
    );
  }

  // Create welcome notification
  await admin.from("notifications").insert({
    user_id: newUser.user.id,
    title: "Welcome to the Blueprint",
    message: `Welcome ${name.split(" ")[0]}! Your portal is set up and ready. Start by exploring your training modules and completing your first check-in.`,
    link: "/portal",
  });

  // Generate password setup link
  const { data: linkData } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
  });

  const setupUrl = linkData?.properties?.hashed_token
    ? `${getSiteUrl()}/auth/callback?token_hash=${linkData.properties.hashed_token}&type=recovery&redirect=/portal`
    : null;

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
