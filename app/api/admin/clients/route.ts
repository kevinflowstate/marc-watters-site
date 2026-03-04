import { requireAdmin } from "@/lib/admin-auth";
import { getClients } from "@/lib/admin-data";
import { NextResponse } from "next/server";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const clients = await getClients();
  return NextResponse.json({ clients });
}
