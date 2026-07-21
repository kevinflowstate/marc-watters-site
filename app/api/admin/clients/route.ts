import { requireAdmin } from "@/lib/admin-auth";
import { getClients } from "@/lib/admin-data";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const includeArchived = new URL(request.url).searchParams.get("includeArchived") === "true";
  const clients = await getClients({ includeArchived });
  return NextResponse.json({ clients });
}
