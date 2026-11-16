import { createAdminClient } from "@/lib/supabase/admin";
import { createOrReplaceClientInvite } from "@/lib/client-invites";
import { sendWelcomeEmail } from "@/lib/email-templates";

/**
 * Creates a portal client the same way the CRM "new client" webhook does: account, welcome
 * notification, password-setup invite and welcome email. Used for clients who pay their first
 * invoice directly in Stripe (Kevin, 16 Nov 2026).
 *
 * Never throws after the account exists: it reports what landed so the caller can tell Eimear.
 */
export type Activation =
  | { status: "created"; userId: string; profileId: string; emailSent: boolean; setupUrl: string | null }
  | { status: "exists" }
  | { status: "failed"; error: string; userId?: string };

function temporaryPassword(): string {
  const entropy = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
  return `Tmp!${entropy.slice(0, 24)}aA1`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function activateClient(name: string, email: string): Promise<Activation> {
  const admin = createAdminClient();
  const existing = await admin.from("users").select("id").eq("email", email).limit(1);
  if (existing.error) return { status: "failed", error: "client lookup failed" };
  if (existing.data?.length) return { status: "exists" };

  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password: temporaryPassword(),
    user_metadata: { full_name: name, role: "client", app_name: "marc-watters-portal", requires_password_setup: true },
  });
  if (created.error || !created.data.user) {
    // Another intake (the CRM webhook) may have created the same client a moment ago.
    if (/already/i.test(created.error?.message ?? "")) return { status: "exists" };
    return { status: "failed", error: created.error?.message ?? "account not created" };
  }
  const userId = created.data.user.id;

  // DB triggers create the client profile and assign the welcome module.
  let profileId: string | null = null;
  for (let attempt = 0; attempt < 6 && !profileId; attempt += 1) {
    await sleep(500);
    const profile = await admin.from("client_profiles").select("id").eq("user_id", userId).maybeSingle();
    profileId = (profile.data as { id: string } | null)?.id ?? null;
  }
  if (!profileId) return { status: "failed", error: "account created but the client profile did not appear", userId };

  await admin.from("notifications").insert({
    user_id: userId,
    title: "Welcome to the Blueprint",
    message: `Welcome ${name.split(" ")[0]}! Your portal is set up and ready. Start by exploring your training modules and completing your first check-in.`,
    link: "/portal",
  });

  let setupUrl: string | null = null;
  let emailSent = false;
  try {
    setupUrl = (await createOrReplaceClientInvite({ userId, email, fullName: name })).activationUrl ?? null;
    if (setupUrl) {
      await sendWelcomeEmail(email, name, setupUrl);
      emailSent = true;
    }
  } catch (e) {
    console.error("[STRIPE INTAKE] Welcome email failed:", e instanceof Error ? e.message : e);
  }
  return { status: "created", userId, profileId, emailSent, setupUrl: emailSent ? null : setupUrl };
}
