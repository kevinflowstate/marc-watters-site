import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CBB_GROWTH_ENGINE_KEY, requireGrowthManager } from "@/lib/growth-engine";
import { notifyPortalUsers } from "@/lib/notifications";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const viewer = await requireGrowthManager();
  if (!viewer.authorized) {
    return NextResponse.json({ error: viewer.error }, { status: viewer.status });
  }

  const { clientId } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be a boolean." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: client } = await admin
    .from("client_profiles")
    .select("id, user_id, archived_at")
    .eq("id", clientId)
    .maybeSingle();
  if (!client || client.archived_at) {
    return NextResponse.json({ error: "Active client not found." }, { status: 404 });
  }

  const { data: existing } = await admin.from("client_entitlements")
    .select("status")
    .eq("client_id", clientId)
    .eq("entitlement_key", CBB_GROWTH_ENGINE_KEY)
    .maybeSingle();
  const wasEnabled = existing?.status === "active";
  const now = new Date().toISOString();
  const { error: entitlementError } = await admin.from("client_entitlements").upsert(
    {
      client_id: clientId,
      entitlement_key: CBB_GROWTH_ENGINE_KEY,
      status: body.enabled ? "active" : "inactive",
      enabled_at: body.enabled ? now : null,
      disabled_at: body.enabled ? null : now,
      granted_by: viewer.userId,
      updated_at: now,
    },
    { onConflict: "client_id,entitlement_key" },
  );
  if (entitlementError) {
    return NextResponse.json({ error: "Could not update Growth Engine access." }, { status: 500 });
  }

  if (body.enabled) {
    const { error: workspaceError } = await admin.from("cbb_growth_workspaces").upsert(
      {
        client_id: clientId,
        created_by: viewer.userId,
        updated_by: viewer.userId,
        updated_at: now,
      },
      { onConflict: "client_id", ignoreDuplicates: true },
    );
    if (workspaceError) {
      return NextResponse.json(
        { error: "Access was enabled, but the workspace could not be prepared." },
        { status: 500 },
      );
    }
  }

  let notified = false;
  if (body.enabled && !wasEnabled) {
    const notification = await notifyPortalUsers(admin, [{
      userId: client.user_id,
      title: "Welcome to CBB Growth Engine",
      message: "Your done-for-you lead generation and AI implementation workspace is ready.",
      link: "/portal/growth-engine",
      pushTag: `cbb-growth-welcome-${clientId}`,
      dedupeKey: `cbb-growth-welcome-${clientId}`,
    }]);
    notified = notification.created > 0 || notification.duplicates > 0;
  }

  return NextResponse.json({ success: true, enabled: body.enabled, notified });
}
