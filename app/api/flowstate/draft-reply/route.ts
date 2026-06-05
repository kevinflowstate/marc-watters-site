import { requireFlowstateAccess } from "@/lib/flowstate/auth";
import { buildDraftReply } from "@/lib/flowstate/portal";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const auth = requireFlowstateAccess(request);
  if (auth) return auth;

  const body = await request.json().catch(() => ({}));
  const checkinId = String(body.checkin_id || body.checkinId || "").trim();
  if (!checkinId) return NextResponse.json({ ok: false, error: "checkin_id_required" }, { status: 400 });

  try {
    const result = await buildDraftReply(checkinId, String(body.guidance || ""));
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const status = (error as Error & { status?: number }).status || 500;
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "draft_reply_failed" },
      { status },
    );
  }
}
