import { requireAdmin } from "@/lib/admin-auth";
import { createOrReplaceClientInvite } from "@/lib/client-invites";
import { sendPasswordResetEmail, sendWelcomeEmail } from "@/lib/email-templates";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

function generateTemporaryPassword(): string {
  const entropy = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
  return `Tmp!${entropy.slice(0, 24)}aA1`;
}

async function findAuthUserIdByEmail(admin: ReturnType<typeof createAdminClient>, email: string): Promise<string | null> {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) return null;
  return data.users.find((user) => user.email?.toLowerCase() === email)?.id || null;
}

async function ensureClientProfile(admin: ReturnType<typeof createAdminClient>, userId: string): Promise<{ id: string; created: boolean } | null> {
  const { data: existingProfile } = await admin
    .from("client_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingProfile?.id) return { id: existingProfile.id, created: false };

  const { data: profile, error } = await admin
    .from("client_profiles")
    .insert({ user_id: userId })
    .select("id")
    .single();

  if (error) return null;
  return { id: profile.id, created: true };
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
  let userId: string | null = null;
  let clientAlreadyExisted = false;

  const { data: existingUser } = await admin
    .from("users")
    .select("id, role, full_name")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (existingUser) {
    if (existingUser.role !== "client") {
      return NextResponse.json({ error: "This email belongs to an admin user" }, { status: 409 });
    }

    userId = existingUser.id;
    clientAlreadyExisted = true;

    if (existingUser.full_name !== normalizedName) {
      await admin.from("users").update({ full_name: normalizedName }).eq("id", userId);
    }
  }

  if (!userId) {
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
      const authUserId = await findAuthUserIdByEmail(admin, normalizedEmail);
      if (!authUserId) {
        return NextResponse.json({ error: authError.message }, { status: 500 });
      }

      userId = authUserId;
      clientAlreadyExisted = true;

      await admin.from("users").upsert({
        id: userId,
        email: normalizedEmail,
        full_name: normalizedName,
        role: "client",
      });
    } else {
      userId = newUser.user.id;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  const profile = await ensureClientProfile(admin, userId);
  if (!profile) {
    return NextResponse.json({ error: "Client profile was not created" }, { status: 500 });
  }

  const { data: lifecycle } = await admin
    .from("client_profiles")
    .select("archived_at")
    .eq("id", profile.id)
    .single();
  if (lifecycle?.archived_at) {
    return NextResponse.json(
      { error: "This client is archived. Restore access before sending a new invite." },
      { status: 409 },
    );
  }

  if (providedPassword && clientAlreadyExisted) {
    const { data: authUser } = await admin.auth.admin.getUserById(userId);
    const existingMetadata = authUser?.user?.user_metadata || {};
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password: providedPassword,
      user_metadata: {
        ...existingMetadata,
        full_name: normalizedName,
        role: "client",
        app_name: "marc-watters-portal",
        requires_password_setup: false,
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (!clientAlreadyExisted) {
    await admin.from("notifications").insert({
      user_id: userId,
      title: "Welcome to the Blueprint",
      message: `Welcome ${normalizedName.split(" ")[0]}! Your portal is set up and ready. Start by exploring your training modules and completing your first check-in.`,
      link: "/portal",
    });
  }

  const setupUrl = mustSetPasswordOnFirstLogin
    ? (await createOrReplaceClientInvite({
        userId,
        email: normalizedEmail,
        fullName: normalizedName,
      })).activationUrl
    : null;

  let emailSent = false;
  try {
    if (setupUrl && clientAlreadyExisted) {
      await sendPasswordResetEmail(normalizedEmail, normalizedName, setupUrl);
      emailSent = true;
    } else if (setupUrl) {
      await sendWelcomeEmail(normalizedEmail, normalizedName, setupUrl);
      emailSent = true;
    }
  } catch (e) {
    console.log("[INVITE] Email send failed (likely domain not verified):", e instanceof Error ? e.message : e);
  }

  return NextResponse.json({
    success: true,
    userId,
    profileId: profile.id,
    alreadyExisted: clientAlreadyExisted,
    profileWasRepaired: clientAlreadyExisted && profile.created,
    emailSent,
    passwordSet: !mustSetPasswordOnFirstLogin,
    setupUrl: emailSent ? null : setupUrl,
  });
}
