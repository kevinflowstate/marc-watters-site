import { requireAdmin } from "@/lib/admin-auth";
import { getClientById } from "@/lib/admin-data";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const client = await getClientById(id);

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  return NextResponse.json({ client }, { headers: NO_STORE_HEADERS });
}

export async function DELETE() {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
  return NextResponse.json(
    { error: "Permanent client deletion is disabled. Archive the client instead." },
    { status: 405, headers: { Allow: "GET" } },
  );
}
