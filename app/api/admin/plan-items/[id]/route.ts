import { requireAdmin } from "@/lib/admin-auth";
import { togglePlanItem } from "@/lib/admin-data";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isClientActive } from "@/lib/client-lifecycle";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const admin = createAdminClient();
  const { data: item } = await admin.from("business_plan_items").select("phase_id").eq("id", id).maybeSingle();
  const { data: phase } = item
    ? await admin.from("business_plan_phases").select("plan_id").eq("id", item.phase_id).maybeSingle()
    : { data: null };
  const { data: plan } = phase
    ? await admin.from("business_plans").select("client_id").eq("id", phase.plan_id).maybeSingle()
    : { data: null };
  if (!plan || !(await isClientActive(plan.client_id))) {
    return NextResponse.json({ error: "Archived client records are read-only." }, { status: 409 });
  }
  const result = await togglePlanItem(id);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
