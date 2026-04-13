import { requireAdmin } from "@/lib/admin-auth";
import { createOrReplaceClientInvite } from "@/lib/client-invites";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWelcomeEmail } from "@/lib/email-templates";
import { NextResponse } from "next/server";

function generateTemporaryPassword(): string {
  const entropy = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
  return `Tmp!${entropy.slice(0, 24)}aA1`;
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { name, email, password } = await request.json();
  const normalizedName = name?.trim();
  const normalizedEmail = email?.trim()?.toLowerCase();
  const providedPassword = typeof password === "string" ? password.trim() : "";
  const mustSetPasswordOnFirstLogin = !providedPassword;

  if (!normalizedName || !normalizedEmail) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }

  if (providedPassword && providedPassword.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Check if user already exists
  const { data: existing } = await admin
    .from("users")
    .select("id")
    .eq("email", normalizedEmail)
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: "A client with this email already exists" }, { status: 409 });
  }

  // Create user in Supabase Auth (triggers handle_new_user + handle_new_client)
  const { data: newUser, error: authError } = await admin.auth.admin.createUser({
    email: normalizedEmail,
    email_confirm: true,
    password: providedPassword || generateTemporaryPassword(),
    user_metadata: {
      full_name: normalizedName,
      role: "client",
      app_name: "marc-watters-portal",
      requires_password_setup: mustSetPasswordOnFirstLogin,
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
    message: `Welcome ${normalizedName.split(" ")[0]}! Your portal is set up and ready. Start by exploring your training modules and completing your first check-in.`,
    link: "/portal",
  });

  const setupUrl = mustSetPasswordOnFirstLogin
    ? (await createOrReplaceClientInvite({
        userId: newUser.user.id,
        email: normalizedEmail,
        fullName: normalizedName,
      })).activationUrl
    : null;

  // Send welcome email via unified template
  let emailSent = false;
  try {
    if (setupUrl) {
      await sendWelcomeEmail(normalizedEmail, normalizedName, setupUrl);
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
    passwordSet: !mustSetPasswordOnFirstLogin,
    setupUrl: emailSent ? null : setupUrl, // Return URL if email didn't send, so Marc can share manually
  });
}
