import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  // Verify caller is admin
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

  const { email, full_name } = await request.json();

  if (!email || !full_name) {
    return NextResponse.json({ error: "Email and full name are required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Create user in Supabase Auth
  const { data: newUser, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name, role: "client" },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Send password reset so they can set their password
  await admin.auth.admin.generateLink({
    type: "recovery",
    email,
  });

  return NextResponse.json({ user: newUser.user });
}
