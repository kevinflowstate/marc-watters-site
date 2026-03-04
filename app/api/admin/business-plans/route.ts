import { createClient } from "@/lib/supabase/server";
import { savePlan, completePlan } from "@/lib/admin-data";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

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
