import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getClientGrowthAccess } from "@/lib/growth-engine";

const outcomes = new Set(["won", "lost", "follow_up", "no_show"]);

async function viewer() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const access = await getClientGrowthAccess(user.id);
  return access.activeClient && access.entitled && access.clientId ? { userId: user.id, clientId: access.clientId } : null;
}

export async function GET() {
  const access = await viewer();
  if (!access) return NextResponse.json({ error: "Growth Engine access is not enabled." }, { status: 403 });
  const admin = createAdminClient();
  const since = new Date();
  since.setDate(since.getDate() - 90);
  const [{ data: appointments, error }, { data: sales }] = await Promise.all([
    admin.from("cbb_growth_appointments")
      .select("id, client_id, ghl_event_id, ghl_contact_id, contact_name, appointment_status, starts_at, ends_at, source")
      .eq("client_id", access.clientId)
      .gte("starts_at", since.toISOString())
      .order("starts_at", { ascending: false })
      .limit(100),
    admin.from("cbb_growth_sales_outcomes")
      .select("id, appointment_id, outcome, sale_value, notes, updated_at")
      .eq("client_id", access.clientId),
  ]);
  if (error) return NextResponse.json({ error: "Consultations could not be loaded." }, { status: 500 });
  const byAppointment = new Map((sales || []).map((item) => [item.appointment_id, item]));
  return NextResponse.json({
    appointments: (appointments || []).map((appointment) => ({ ...appointment, outcome: byAppointment.get(appointment.id) || null })),
  });
}

export async function POST(request: NextRequest) {
  const access = await viewer();
  if (!access) return NextResponse.json({ error: "Growth Engine access is not enabled." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const appointmentId = typeof body?.appointmentId === "string" ? body.appointmentId : "";
  const outcome = typeof body?.outcome === "string" && outcomes.has(body.outcome) ? body.outcome : "";
  const saleValue = Number(body?.saleValue || 0);
  const notes = typeof body?.notes === "string" ? body.notes.trim().slice(0, 2000) : "";
  if (!appointmentId || !outcome || !Number.isFinite(saleValue) || saleValue < 0) {
    return NextResponse.json({ error: "A valid appointment, outcome and sale value are required." }, { status: 400 });
  }
  const admin = createAdminClient();
  const { data: appointment } = await admin.from("cbb_growth_appointments")
    .select("id").eq("id", appointmentId).eq("client_id", access.clientId).maybeSingle();
  if (!appointment) return NextResponse.json({ error: "Consultation not found." }, { status: 404 });
  const now = new Date().toISOString();
  const { data: saved, error } = await admin.from("cbb_growth_sales_outcomes").upsert({
    client_id: access.clientId,
    appointment_id: appointmentId,
    outcome,
    sale_value: outcome === "won" ? saleValue : 0,
    notes: notes || null,
    submitted_by: access.userId,
    updated_at: now,
  }, { onConflict: "appointment_id" }).select("*").single();
  if (error || !saved) return NextResponse.json({ error: "Consultation outcome could not be saved." }, { status: 500 });
  return NextResponse.json({ outcome: saved });
}
