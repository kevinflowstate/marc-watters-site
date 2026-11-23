import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GROWTH_ENGINE_CALENDAR_ID, isCancelledStatus, parseBookingPayload } from "@/lib/growth-engine-pipeline";
import { exactIlike, matchClientByEmail } from "@/lib/growth-engine-pipeline-server";

/**
 * CBB Growth Engine bookings from the Flowstate CRM workflow
 * ("CBB Growth Engine - Pipeline sync"). Lands each booking in "Call booked".
 * Auth: x-growth-engine-secret header matching GROWTH_ENGINE_PIPELINE_SECRET.
 */
function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const configured = process.env.GROWTH_ENGINE_PIPELINE_SECRET?.trim();
  const supplied = (request.headers.get("x-growth-engine-secret") || "").trim();
  if (!configured || !supplied || !safeEqual(configured, supplied)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const booking = parseBookingPayload(body);
  if (booking.calendarId && booking.calendarId !== GROWTH_ENGINE_CALENDAR_ID) {
    return NextResponse.json({ accepted: true, ignored: "calendar" });
  }
  if (!booking.name && !booking.email) return NextResponse.json({ error: "Contact name or email required" }, { status: 400 });

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const cancelled = isCancelledStatus(booking.status);

  // Same appointment again (update, reschedule, cancel): refresh the card in place.
  let existing: { id: string; stage: string } | null = null;
  if (booking.appointmentId) {
    const { data } = await admin.from("cbb_growth_pipeline").select("id, stage").eq("ghl_appointment_id", booking.appointmentId).maybeSingle();
    existing = data;
  }
  // A new booking from someone already open in the pipeline moves their existing card.
  if (!existing && (booking.contactId || booking.email)) {
    let query = admin.from("cbb_growth_pipeline").select("id, stage").in("stage", ["call_booked", "proposal", "follow_up"]);
    query = booking.contactId ? query.eq("ghl_contact_id", booking.contactId) : query.ilike("email", exactIlike(booking.email));
    const { data } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
    existing = data;
  }

  const fields = {
    ghl_contact_id: booking.contactId || null,
    ghl_appointment_id: booking.appointmentId || null,
    appointment_at: booking.startsAt,
    appointment_status: cancelled ? "cancelled" : booking.status || "booked",
    payload: body,
    updated_at: now,
  };

  if (existing) {
    const { error } = await admin.from("cbb_growth_pipeline").update(fields).eq("id", existing.id);
    if (error) return NextResponse.json({ error: "Booking could not be recorded" }, { status: 500 });
    return NextResponse.json({ accepted: true, id: existing.id, updated: true });
  }
  if (cancelled) return NextResponse.json({ accepted: true, ignored: "cancelled-unknown" });

  const { data: top } = await admin.from("cbb_growth_pipeline").select("position").eq("stage", "call_booked")
    .order("position", { ascending: true }).limit(1).maybeSingle();
  const { data, error } = await admin.from("cbb_growth_pipeline").insert({
    ...fields,
    stage: "call_booked",
    position: (top ? Number(top.position) : 0) - 1,
    contact_name: booking.name || booking.email,
    email: booking.email || null,
    phone: booking.phone || null,
    business_name: booking.businessName || null,
    client_id: await matchClientByEmail(admin, booking.email),
    source: "calendar",
  }).select("id").single();
  if (error || !data) return NextResponse.json({ error: "Booking could not be recorded" }, { status: 500 });
  return NextResponse.json({ accepted: true, id: data.id, created: true });
}
