import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { email, full_name, password } = await request.json();

  if (!email || !full_name) {
    return NextResponse.json({ error: "Email and full name are required" }, { status: 400 });
  }

  if (password && password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Create user in Supabase Auth
  const { data: newUser, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    ...(password ? { password } : {}),
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
