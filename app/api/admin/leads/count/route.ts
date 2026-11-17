import { requireAdmin } from "@/lib/admin-auth";
import { leadDmsAllowed } from "@/lib/lead-dms/config";
import { OPEN_STATUSES } from "@/lib/lead-dms/rules";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

/** For the sidebar: can this admin see the Leads tab, and how many DMs are waiting (not left for Marc). */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authorized || !leadDmsAllowed(auth.userId)) return NextResponse.json({ access: false, waiting: 0 });
  const { count } = await createAdminClient()
    .from("lead_dm_drafts")
    .select("id", { count: "exact", head: true })
    .in("status", [...OPEN_STATUSES])
    .eq("for_marc", false)
    .gt("inbound_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  return NextResponse.json({ access: true, waiting: count ?? 0 });
}
