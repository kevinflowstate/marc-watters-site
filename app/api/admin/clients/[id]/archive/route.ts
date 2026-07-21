import { requireAdmin } from "@/lib/admin-auth";
import { archiveClient } from "@/lib/client-lifecycle";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  if (!reason) {
    return NextResponse.json({ error: "Please record a reason for archiving this client." }, { status: 400 });
  }
  if (reason.length > 500) {
    return NextResponse.json({ error: "Archive reason must be 500 characters or fewer." }, { status: 400 });
  }

  const result = await archiveClient(id, auth.userId, reason);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({ success: true, ...result });
}
