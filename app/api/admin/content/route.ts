import { adminActor } from "@/lib/ops/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { allVideos, intake } from "@/lib/content/intake";
import { accounts, accountWarnings } from "@/lib/content/crm";
import { inboxFolder, schedulingEnabled } from "@/lib/content/config";
import { contentResponse } from "@/lib/content/http";
export const maxDuration = 300;
export async function GET() {
  return contentResponse(async () => {
    await adminActor();
    const videos = await allVideos();
    const state = await createAdminClient()
      .from("content_intake_state")
      .select("checked_at,warnings")
      .eq("id", true)
      .single();
    if (state.error) throw new Error("State unavailable");
    let connectionWarnings: string[] = [];
    try {
      const connected = await accounts();
      connectionWarnings = accountWarnings(connected);
    } catch {
      connectionWarnings = [
        "CRM accounts could not be checked. Scheduling will stay blocked until the connection is verified.",
      ];
    }
    return {
      videos,
      configured: !!inboxFolder(),
      enabled: schedulingEnabled(),
      ...state.data,
      connectionWarnings,
    };
  });
}
export async function POST() {
  return contentResponse(async () => {
    await adminActor();
    return intake();
  });
}
