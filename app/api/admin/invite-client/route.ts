import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { name, email } = await request.json();

  if (!name?.trim() || !email?.trim()) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
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
    ? `https://marc-watters-site.vercel.app/auth/callback?token_hash=${linkData.properties.hashed_token}&type=recovery&redirect=/portal`
    : null;

  // Send welcome email via Resend (will fail gracefully if domain not verified yet)
  let emailSent = false;
  try {
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey && setupUrl) {
      const resend = new Resend(resendKey);
      const firstName = name.split(" ")[0];
      await resend.emails.send({
        from: "Marc Watters <marc@marcwatters.com>",
        to: email.trim().toLowerCase(),
        subject: "Your Construction Business Blueprint portal is ready",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
            <h2 style="margin: 0 0 8px; font-size: 20px; color: #111;">Welcome ${firstName},</h2>
            <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
              Your client portal for the Construction Business Blueprint is set up and ready to go.
            </p>
            <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
              Click the button below to set your password and access your portal, training modules, and business plan.
            </p>
            <a href="${setupUrl}" style="display: inline-block; background: #2272de; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-size: 15px; font-weight: 600;">
              Set Up Your Account
            </a>
            <p style="color: #999; font-size: 12px; margin: 32px 0 0;">
              Construction Business Blueprint - Client Portal
            </p>
          </div>
        `,
      });
      emailSent = true;
    }
  } catch (e) {
    // Resend domain not verified yet - that's fine
    console.log("[INVITE] Email send failed (likely domain not verified):", e instanceof Error ? e.message : e);
  }

  return NextResponse.json({
    success: true,
    userId: newUser.user.id,
    profileId: profile.id,
    emailSent,
    setupUrl: emailSent ? null : setupUrl, // Return URL if email didn't send, so Marc can share manually
  });
}
