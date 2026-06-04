import { requireFlowstateAccess } from "@/lib/flowstate/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const auth = requireFlowstateAccess(request);
  if (auth) return auth;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("training_modules")
    .select("id, title, description, is_published, content:module_content(id, title, content_type, duration_minutes, order_index)")
    .eq("is_published", true)
    .order("order_index", { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    modules: data || [],
  });
}
