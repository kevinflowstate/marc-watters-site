import { requireLeadsAccess } from "@/lib/lead-dms/access";
import { conversationMessages } from "@/lib/lead-dms/crm";
import { toLines } from "@/lib/lead-dms/rules";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

/** The live Instagram thread for one lead, read from the CRM (never stored). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireLeadsAccess();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const { id } = await params;
  const { data } = await createAdminClient().from("lead_dm_drafts").select("conversation_id").eq("id", id).maybeSingle();
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const lines = toLines(await conversationMessages(data.conversation_id as string, {}, 30));
    return NextResponse.json({ lines });
  } catch (error) {
    console.error("lead_dms_thread_failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not load the conversation from the CRM." }, { status: 502 });
  }
}
