import { requireAdmin } from "@/lib/admin-auth";
import { getTrainingModules } from "@/lib/admin-data";
import { NextResponse } from "next/server";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const modules = await getTrainingModules();
  return NextResponse.json({ modules });
}
