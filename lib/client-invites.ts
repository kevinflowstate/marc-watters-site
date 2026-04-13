import { createHash, randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/site-url";

export function createInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function buildActivationUrl(token: string): string {
  const url = new URL("/activate", getSiteUrl());
  url.searchParams.set("token", token);
  return url.toString();
}

export async function createOrReplaceClientInvite({
  userId,
  email,
  fullName,
}: {
  userId: string;
  email: string;
  fullName: string;
}) {
  const token = createInviteToken();
  const tokenHash = hashInviteToken(token);
  const admin = createAdminClient();

  const { error } = await admin.from("client_invites").upsert(
    {
      user_id: userId,
      email,
      full_name: fullName,
      token_hash: tokenHash,
      last_sent_at: new Date().toISOString(),
      used_at: null,
      used_ip: null,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw error;
  }

  return {
    token,
    activationUrl: buildActivationUrl(token),
  };
}

export async function getClientInviteByToken(token: string) {
  const admin = createAdminClient();
  const tokenHash = hashInviteToken(token);

  const { data, error } = await admin
    .from("client_invites")
    .select("id, user_id, email, full_name, token_hash, created_at, last_sent_at, used_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}
