import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function value(record: Record<string, unknown>, key: string) {
  return typeof record[key] === "string" ? record[key] as string : "";
}

export async function POST(request: NextRequest) {
  const configuredSecret = process.env.GROWTH_ENGINE_GHL_WEBHOOK_SECRET?.trim();
  const suppliedSecret = request.headers.get("x-growth-engine-secret")?.trim() || "";
  if (!configuredSecret || !suppliedSecret || !safeEqual(configuredSecret, suppliedSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const nested = body.appointment && typeof body.appointment === "object" && !Array.isArray(body.appointment)
    ? body.appointment as Record<string, unknown>
    : body;
  const locationId = value(body, "locationId") || value(nested, "locationId");
  const eventId = value(nested, "id") || value(nested, "appointmentId");
  if (!locationId || !eventId) return NextResponse.json({ error: "locationId and appointment id are required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: connection } = await admin.from("cbb_growth_connections")
    .select("client_id, ghl_calendar_ids").eq("ghl_location_id", locationId).maybeSingle();
  if (!connection) return NextResponse.json({ accepted: true, mapped: false });
  const calendarId = value(nested, "calendarId");
  const configuredCalendars = Array.isArray(connection.ghl_calendar_ids) ? connection.ghl_calendar_ids : [];
  if (configuredCalendars.length && calendarId && !configuredCalendars.includes(calendarId)) {
    return NextResponse.json({ accepted: true, mapped: true, ignored: "calendar" });
  }

  const type = value(body, "type").toLowerCase();
  const firstName = value(nested, "firstName");
  const lastName = value(nested, "lastName");
  const now = new Date().toISOString();
  const { error } = await admin.from("cbb_growth_appointments").upsert({
    client_id: connection.client_id,
    ghl_event_id: eventId,
    ghl_contact_id: value(nested, "contactId") || null,
    contact_name: value(nested, "contactName") || [firstName, lastName].filter(Boolean).join(" ") || value(nested, "title") || null,
    appointment_status: type.includes("delete") ? "deleted" : value(nested, "appointmentStatus") || value(nested, "status") || "booked",
    starts_at: value(nested, "startTime") || null,
    ends_at: value(nested, "endTime") || null,
    source: value(nested, "source") || null,
    payload: body,
    updated_at: now,
  }, { onConflict: "client_id,ghl_event_id" });
  if (error) return NextResponse.json({ error: "Appointment could not be recorded" }, { status: 500 });
  await admin.from("cbb_growth_connections").update({ last_event_at: now, updated_at: now }).eq("client_id", connection.client_id);
  return NextResponse.json({ accepted: true, mapped: true });
}
