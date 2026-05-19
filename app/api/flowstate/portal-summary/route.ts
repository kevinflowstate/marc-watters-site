import { requireFlowstateAccess } from "@/lib/flowstate/auth";
import { buildPortalSummary } from "@/lib/flowstate/portal";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const auth = requireFlowstateAccess(request);
  if (auth) return auth;

  try {
    const summary = await buildPortalSummary();
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "portal_summary_failed" },
      { status: 500 },
    );
  }
}
