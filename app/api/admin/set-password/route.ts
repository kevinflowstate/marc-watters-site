import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { user_id, password } = await request.json();

  if (!user_id || !password) {
    return NextResponse.json({ error: "user_id and password are required" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  // Only allow setting password for client-role users, not other admins
  const admin = createAdminClient();
  const { data: targetUser } = await admin
    .from("users")
    .select("role")
    .eq("id", user_id)
    .single();

  if (!targetUser || targetUser.role !== "client") {
    return NextResponse.json({ error: "Can only set password for client users" }, { status: 403 });
  }

  const { data: authUser } = await admin.auth.admin.getUserById(user_id);
  const existingMetadata = authUser?.user?.user_metadata || {};

  const { error } = await admin.auth.admin.updateUserById(user_id, {
    password,
    user_metadata: {
      ...existingMetadata,
      requires_password_setup: false,
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
