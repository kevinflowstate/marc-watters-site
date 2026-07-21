import { requireAdmin } from "@/lib/admin-auth";
import { getClients, savePlan, completePlan } from "@/lib/admin-data";
import { notifyPortalUsers } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { isClientActive } from "@/lib/client-lifecycle";
import { NextResponse } from "next/server";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const clients = await getClients();

  const plans = clients.flatMap(client =>
    client.business_plan.map(plan => ({
      ...plan,
      client_name: client.name,
      client_id_profile: client.id,
      client_business: client.business_name,
      client_status: client.status,
    }))
  );

  const clientsWithoutPlan = clients
    .filter(c => !c.business_plan.some(p => p.status === "active"))
    .map(c => ({ id: c.id, name: c.name, business_name: c.business_name, status: c.status }));

  const allClients = clients.map(c => ({ id: c.id, name: c.name, business_name: c.business_name }));

  return NextResponse.json({ plans, clientsWithoutPlan, allClients });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();

  // If action is "complete", mark a plan as completed
  if (body.action === "complete" && body.plan_id) {
    const admin = createAdminClient();
    const { data: plan } = await admin.from("business_plans").select("client_id").eq("id", body.plan_id).maybeSingle();
    if (!plan || !(await isClientActive(plan.client_id))) {
      return NextResponse.json({ error: "Archived client records are read-only." }, { status: 409 });
    }
    const result = await completePlan(body.plan_id);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  // Otherwise, save/update a full plan
  if (!body.plan) {
    return NextResponse.json({ error: "plan is required" }, { status: 400 });
  }

  if (!(await isClientActive(body.plan.client_id))) {
    return NextResponse.json({ error: "Archived client records are read-only." }, { status: 409 });
  }

  const admin = createAdminClient();
  const { data: existingPlan } = await admin
    .from("business_plans")
    .select("id")
    .eq("id", body.plan.id)
    .maybeSingle<{ id: string }>();

  const result = await savePlan(body.plan);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  const { data: clientProfile } = await admin
    .from("client_profiles")
    .select("user_id")
    .eq("id", body.plan.client_id)
    .single<{ user_id: string }>();

  if (clientProfile?.user_id) {
    const created = !existingPlan;
    const title = created ? "Business plan issued" : "Business plan updated";
    await notifyPortalUsers(admin, [{
      userId: clientProfile.user_id,
      title,
      message: created
        ? "Marc has issued your business plan. Open the portal to review it."
        : "Marc has updated your business plan. Open the portal to review the latest version.",
      link: "/portal/plan",
      pushTag: `business-plan-${body.plan.id}`,
    }]);
  }

  return NextResponse.json({
    success: true,
    planId: result.planId,
    phaseCount: result.phaseCount,
    itemCount: result.itemCount,
    trainingLinkCount: result.trainingLinkCount,
  });
}
