import { createClient } from "@/lib/supabase/server";
import { getClientById } from "@/lib/admin-data";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { id } = await params;
  const client = await getClientById(id);

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  return NextResponse.json({ client });
}
