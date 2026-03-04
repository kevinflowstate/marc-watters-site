import { requireAdmin } from "@/lib/admin-auth";
import { getInternalNotes, saveInternalNotes } from "@/lib/admin-data";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { clientId } = await params;
  const content = await getInternalNotes(clientId);
  return NextResponse.json({ content });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { clientId } = await params;
  const { content } = await request.json();

  const result = await saveInternalNotes(clientId, content || "");
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
