import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  if (!type || !["checkin", "business_plan"].includes(type)) {
    return NextResponse.json({ error: "Invalid form type" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("form_config")
    .select("config")
    .eq("form_type", type)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ config: data.config });
}

export async function PUT(request: Request) {
  // Verify caller is admin
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

  const { type, config } = await request.json();

  if (!type || !["checkin", "business_plan"].includes(type)) {
    return NextResponse.json({ error: "Invalid form type" }, { status: 400 });
  }

  if (!config) {
    return NextResponse.json({ error: "Config is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("form_config")
    .update({ config, updated_at: new Date().toISOString() })
    .eq("form_type", type)
    .select("config")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ config: data.config });
}
