import { requireAdmin } from "@/lib/admin-auth";
import { restoreClient } from "@/lib/client-lifecycle";
import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const result = await restoreClient(id, auth.userId);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({ success: true, ...result });
}
