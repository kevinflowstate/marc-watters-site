import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireGrowthManager } from "@/lib/growth-engine";

function calendars(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => typeof item === "string" ? item.trim().slice(0, 120) : "").filter(Boolean).slice(0, 20);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const viewer = await requireGrowthManager();
  if (!viewer.authorized) return NextResponse.json({ error: viewer.error }, { status: viewer.status });
  const { clientId } = await params;
  const body = await request.json().catch(() => null);
  const locationId = typeof body?.ghlLocationId === "string" ? body.ghlLocationId.trim().slice(0, 120) : "";
  const timezone = typeof body?.timezone === "string" ? body.timezone.trim().slice(0, 80) : "Europe/London";
  const reportDay = Number.isInteger(body?.reportDay) && body.reportDay >= 0 && body.reportDay <= 6 ? body.reportDay : 1;
  const automationEnabled = body?.automationEnabled !== false;
  const now = new Date().toISOString();
  const admin = createAdminClient();

  const [{ data: entitlement }, { data: client }] = await Promise.all([
    admin.from("client_entitlements")
      .select("status").eq("client_id", clientId).eq("entitlement_key", "cbb_growth_engine").maybeSingle(),
    admin.from("client_profiles").select("id").eq("id", clientId).is("archived_at", null).maybeSingle(),
  ]);
  if (!client || entitlement?.status !== "active") {
    return NextResponse.json({ error: "Enable Growth Engine access before connecting data." }, { status: 409 });
  }

  const { data: connection, error } = await admin.from("cbb_growth_connections").upsert({
    client_id: clientId,
    ghl_location_id: locationId || null,
    ghl_calendar_ids: calendars(body?.ghlCalendarIds),
    timezone,
    report_day: reportDay,
    automation_enabled: automationEnabled,
    created_by: viewer.userId,
    updated_by: viewer.userId,
    updated_at: now,
  }, { onConflict: "client_id" }).select("*").single();
  if (error || !connection) return NextResponse.json({ error: "Data connection could not be saved." }, { status: 500 });
  return NextResponse.json({ connection });
}
