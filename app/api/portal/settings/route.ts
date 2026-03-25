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

  // Only update name if provided (prevents onboarding from blanking it)
  if (fullName) {
    await admin.from("users").update({ full_name: fullName }).eq("id", userId);
  }

  // Only update profile fields that were provided
  const profileUpdate: Record<string, string> = {};
  if (phone !== undefined) profileUpdate.phone = phone;
  if (businessName !== undefined) profileUpdate.business_name = businessName;
  if (businessType !== undefined) profileUpdate.business_type = businessType;
  if (goals !== undefined) profileUpdate.goals = goals;

  if (Object.keys(profileUpdate).length > 0) {
    await admin.from("client_profiles").update(profileUpdate).eq("user_id", userId);
  }

  return NextResponse.json({ success: true });
}
