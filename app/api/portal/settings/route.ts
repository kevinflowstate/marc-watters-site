import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createAdminClient();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userId = user.id;

  const { fullName, phone, businessName, businessType, goals } = await request.json();

  await admin.from("users").update({ full_name: fullName }).eq("id", userId);
  await admin
    .from("client_profiles")
    .update({ phone, business_name: businessName, business_type: businessType, goals })
    .eq("user_id", userId);

  return NextResponse.json({ success: true });
}
