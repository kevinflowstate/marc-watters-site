import { requireLeadsAccess } from "@/lib/lead-dms/access";
import { LeadDecisionError, sendLeadDraft, setLeadDraftState } from "@/lib/lead-dms/send";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

/** Send (as is or edited), leave for Marc, move back, or mark no reply needed. The only way a DM is sent. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireLeadsAccess();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { action?: string; text?: unknown };
  const admin = createAdminClient();
  try {
    if (body.action === "send") {
      return NextResponse.json(await sendLeadDraft(admin, id, access.userId, typeof body.text === "string" ? body.text : null));
    }
    if (body.action === "for_marc" || body.action === "unassign" || body.action === "dismiss") {
      return NextResponse.json(await setLeadDraftState(admin, id, access.userId, body.action));
    }
    return NextResponse.json({ error: "action must be send, for_marc, unassign or dismiss" }, { status: 400 });
  } catch (error) {
    const status = error instanceof LeadDecisionError ? error.status : 500;
    if (status === 500) console.error("lead_dms_decide_failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Something went wrong" }, { status });
  }
}
