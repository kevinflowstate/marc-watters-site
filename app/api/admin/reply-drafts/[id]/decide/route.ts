import { requireAdmin } from "@/lib/admin-auth";
import { replyDraftsEnabled } from "@/lib/reply-drafts/config";
import { DraftDecisionError, sendApprovedDraft } from "@/lib/reply-drafts/send";
import { discardDraft } from "@/lib/reply-drafts/store";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

/** An admin's decision on a draft: send it (optionally edited) or discard it. The only way a draft is sent. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!replyDraftsEnabled()) return NextResponse.json({ error: "Reply drafts are switched off." }, { status: 404 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const admin = createAdminClient();

  if (body?.action === "discard") {
    const ok = await discardDraft(admin, id, auth.userId);
    if (!ok) return NextResponse.json({ error: "This draft has already been handled." }, { status: 409 });
    return NextResponse.json({ status: "discarded" });
  }

  if (body?.action === "send") {
    const { data: me } = await admin.from("users").select("full_name").eq("id", auth.userId).maybeSingle();
    try {
      const result = await sendApprovedDraft(admin, id, { userId: auth.userId, fullName: me?.full_name || "Marc" }, typeof body.text === "string" ? body.text : null);
      return NextResponse.json({ status: result.status });
    } catch (error) {
      const status = error instanceof DraftDecisionError ? error.status : 500;
      return NextResponse.json({ error: error instanceof Error ? error.message : "Send failed" }, { status });
    }
  }

  return NextResponse.json({ error: "action must be send or discard" }, { status: 400 });
}
