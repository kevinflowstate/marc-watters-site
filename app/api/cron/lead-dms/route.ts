import { getEnv } from "@/lib/env";
import { leadDmsEnabled } from "@/lib/lead-dms/config";
import { processDueLeadDrafts } from "@/lib/lead-dms/generate";
import { syncLeadDms } from "@/lib/lead-dms/sync";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const maxDuration = 300;

/** Every 2 minutes: read Marc's Instagram DMs from the CRM and write suggested replies. Never sends. */
export async function GET(request: Request) {
  const cronSecret = getEnv("CRON_SECRET");
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!leadDmsEnabled()) return NextResponse.json({ enabled: false });

  const admin = createAdminClient();
  try {
    const sync = await syncLeadDms(admin);
    const drafts = await processDueLeadDrafts(admin, 3);
    return NextResponse.json({ sync, drafts });
  } catch (error) {
    console.error("lead_dms_cron_failed", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "lead_dms_cron_failed" }, { status: 500 });
  }
}
