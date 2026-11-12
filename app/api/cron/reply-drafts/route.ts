import { getEnv } from "@/lib/env";
import { replyDraftsEnabled } from "@/lib/reply-drafts/config";
import { processDueDrafts } from "@/lib/reply-drafts/generate";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const maxDuration = 300;

/** Every minute: write drafts whose 2-minute debounce has passed. Writes drafts only; never sends. */
export async function GET(request: Request) {
  const cronSecret = getEnv("CRON_SECRET");
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!replyDraftsEnabled()) return NextResponse.json({ enabled: false, processed: 0 });

  try {
    const result = await processDueDrafts(createAdminClient(), 4);
    return NextResponse.json({ enabled: true, ...result });
  } catch (error) {
    console.error("reply_drafts_cron_failed", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "reply_drafts_cron_failed" }, { status: 500 });
  }
}
