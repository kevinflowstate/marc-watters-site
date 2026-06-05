import { requireFlowstateAccess } from "@/lib/flowstate/auth";
import { buildClientThread } from "@/lib/flowstate/portal";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const auth = requireFlowstateAccess(request);
  if (auth) return auth;

  const id = new URL(request.url).searchParams.get("id")?.trim() || "";
  if (!id) return NextResponse.json({ ok: false, error: "id_required" }, { status: 400 });

  try {
    const thread = await buildClientThread(id);
    return NextResponse.json({ ok: true, thread });
  } catch (error) {
    const status = (error as Error & { status?: number }).status || 500;
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "client_thread_failed" },
      { status },
    );
  }
}
