import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { module_ids, client_ids } = await req.json();

  if (!module_ids?.length || !client_ids?.length) {
    return NextResponse.json({ error: "module_ids and client_ids required" }, { status: 400 });
  }

  const admin = createAdminClient();
  let assigned = 0;
  let skipped = 0;

  for (const clientId of client_ids) {
    for (const moduleId of module_ids) {
      // Check if already assigned
      const { data: existing } = await admin
        .from("client_modules")
        .select("id")
        .eq("client_id", clientId)
        .eq("module_id", moduleId)
        .single();

      if (existing) {
        skipped++;
        continue;
      }

      const { error } = await admin
        .from("client_modules")
        .insert({
          client_id: clientId,
          module_id: moduleId,
          status: "locked",
        });

      if (!error) assigned++;
    }
  }

  return NextResponse.json({ assigned, skipped });
}
