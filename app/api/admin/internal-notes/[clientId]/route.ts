import { requireAdmin } from "@/lib/admin-auth";
import { getInternalNotes, saveInternalNotes } from "@/lib/admin-data";
import { NextResponse } from "next/server";
import { isClientActive } from "@/lib/client-lifecycle";

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
  if (!(await isClientActive(clientId))) {
    return NextResponse.json({ error: "Archived client records are read-only." }, { status: 409 });
  }
  const { content } = await request.json();

  const result = await saveInternalNotes(clientId, content || "");
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
