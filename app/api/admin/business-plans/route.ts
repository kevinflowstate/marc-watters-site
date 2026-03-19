import { requireAdmin } from "@/lib/admin-auth";
import { getClients, savePlan, completePlan } from "@/lib/admin-data";
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

  const result = await savePlan(body.plan);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
