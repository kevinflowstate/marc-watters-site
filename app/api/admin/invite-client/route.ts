import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWelcomeEmail } from "@/lib/email-templates";
import { getSiteUrl } from "@/lib/site-url";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { name, email, password } = await request.json();

  if (!name?.trim() || !email?.trim()) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }

  if (password && password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Check if user already exists
  const { data: existing } = await admin
    .from("users")
    .select("id")
    .eq("email", email.trim().toLowerCase())
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: "A client with this email already exists" }, { status: 409 });
  }

  // Create user in Supabase Auth (triggers handle_new_user + handle_new_client)
  const { data: newUser, error: authError } = await admin.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    email_confirm: true,
    ...(password ? { password } : {}),
    user_metadata: {
      full_name: name.trim(),
      role: "client",
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
    email: email.trim().toLowerCase(),
  });

  const setupUrl = linkData?.properties?.hashed_token
    ? `${getSiteUrl()}/auth/callback?token_hash=${linkData.properties.hashed_token}&type=recovery&redirect=/portal`
    : null;

  // Send welcome email via unified template
  let emailSent = false;
  try {
    if (setupUrl) {
      await sendWelcomeEmail(email.trim().toLowerCase(), name, setupUrl);
      emailSent = true;
    }
  } catch (e) {
    console.log("[INVITE] Email send failed (likely domain not verified):", e instanceof Error ? e.message : e);
  }

  return NextResponse.json({
    success: true,
    userId: newUser.user.id,
    profileId: profile.id,
    emailSent,
    passwordSet: !!password,
    setupUrl: emailSent ? null : setupUrl, // Return URL if email didn't send, so Marc can share manually
  });
}
