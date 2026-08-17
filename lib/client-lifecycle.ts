import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

const LONG_BAN_DURATION = "876000h";

export async function getClientAccess(userId: string): Promise<{
  active: boolean;
  clientId?: string;
  archivedAt?: string | null;
}> {
  const admin = createAdminClient();
  const { data: user } = await admin.from("users").select("role").eq("id", userId).maybeSingle();
  if (user?.role === "admin" || user?.role === "growth_operator") return { active: true };

  const { data } = await admin
    .from("client_profiles")
    .select("id, archived_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return { active: false };
  return {
    active: data.archived_at === null,
    clientId: data.id,
    archivedAt: data.archived_at,
  };
}

export async function isClientActive(clientId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("client_profiles")
    .select("archived_at")
    .eq("id", clientId)
    .maybeSingle();
  return Boolean(data && data.archived_at === null);
}

export async function inactiveClientResponse(userId: string): Promise<NextResponse | null> {
  const access = await getClientAccess(userId);
  return access.active
    ? null
    : NextResponse.json({ error: "This client account is archived." }, { status: 403 });
}

export async function archiveClient(
  clientId: string,
  actorUserId: string,
  reason: string,
): Promise<{ alreadyArchived: boolean; warning?: string; error?: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("archive_client_atomic", {
    p_client_id: clientId,
    p_actor_user_id: actorUserId,
    p_reason: reason,
  });

  if (error) return { alreadyArchived: false, error: error.message };

  const result = data as { userId?: string; alreadyArchived?: boolean } | null;
  if (!result?.userId) {
    return { alreadyArchived: false, error: "Client archive did not return a user ID." };
  }

  const { error: banError } = await admin.auth.admin.updateUserById(result.userId, {
    ban_duration: LONG_BAN_DURATION,
  });

  return {
    alreadyArchived: Boolean(result.alreadyArchived),
    ...(banError
      ? { warning: `Client data was archived, but the auth ban must be retried: ${banError.message}` }
      : {}),
  };
}

export async function restoreClient(
  clientId: string,
  actorUserId: string,
): Promise<{ alreadyActive: boolean; error?: string }> {
  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("client_profiles")
    .select("user_id, archived_at")
    .eq("id", clientId)
    .single();

  if (profileError || !profile) {
    return { alreadyActive: false, error: profileError?.message || "Client not found" };
  }
  if (!profile.archived_at) return { alreadyActive: true };

  // Keep the database access flag in place until the auth account is ready.
  const { error: unbanError } = await admin.auth.admin.updateUserById(profile.user_id, {
    ban_duration: "none",
  });
  if (unbanError) {
    return { alreadyActive: false, error: `Could not restore login access: ${unbanError.message}` };
  }

  const { error } = await admin.rpc("restore_client_atomic", {
    p_client_id: clientId,
    p_actor_user_id: actorUserId,
  });

  return error ? { alreadyActive: false, error: error.message } : { alreadyActive: false };
}
