import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireGrowthManager } from "@/lib/growth-engine";
import { cleanDealPatch, DEAL_COLUMNS, isStage, toDeal } from "@/lib/growth-engine-pipeline";
import { matchClientByEmail } from "@/lib/growth-engine-pipeline-server";

export async function GET() {
  const viewer = await requireGrowthManager();
  if (!viewer.authorized) return NextResponse.json({ error: viewer.error }, { status: viewer.status });
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("cbb_growth_pipeline")
    .select(DEAL_COLUMNS)
    .order("position", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "The pipeline could not be loaded." }, { status: 500 });
  return NextResponse.json({ deals: (data || []).map((row) => toDeal(row as Record<string, unknown>)) });
}

/** Manual add, for a call booked outside the calendar. */
export async function POST(request: NextRequest) {
  const viewer = await requireGrowthManager();
  if (!viewer.authorized) return NextResponse.json({ error: viewer.error }, { status: viewer.status });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const patch = cleanDealPatch(body);
  if (!patch.contact_name) return NextResponse.json({ error: "Add a name." }, { status: 400 });
  const stage = isStage(body.stage) ? body.stage : "call_booked";
  let appointmentAt: string | null = null;
  if (typeof body.appointment_at === "string" && body.appointment_at) {
    const d = new Date(body.appointment_at);
    if (!Number.isNaN(d.getTime())) appointmentAt = d.toISOString();
  }
  const admin = createAdminClient();
  const { data: top } = await admin.from("cbb_growth_pipeline").select("position").eq("stage", stage)
    .order("position", { ascending: true }).limit(1).maybeSingle();
  const clientId = await matchClientByEmail(admin, typeof patch.email === "string" ? patch.email : "");
  const { data, error } = await admin.from("cbb_growth_pipeline").insert({
    ...patch,
    stage,
    position: (top ? Number(top.position) : 0) - 1,
    appointment_at: appointmentAt,
    client_id: clientId,
    source: "manual",
    created_by: viewer.userId,
    updated_by: viewer.userId,
  }).select(DEAL_COLUMNS).single();
  if (error || !data) return NextResponse.json({ error: "The lead could not be added." }, { status: 500 });
  return NextResponse.json({ deal: toDeal(data as Record<string, unknown>) }, { status: 201 });
}
