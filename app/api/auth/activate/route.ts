import { getClientInviteByToken } from "@/lib/client-invites";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

function getRequestIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || null;
  }

  return request.headers.get("x-real-ip");
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim();
  if (!token) {
    return NextResponse.json({ error: "Missing activation token" }, { status: 400 });
  }

  try {
    const invite = await getClientInviteByToken(token);
    if (!invite) {
      return NextResponse.json({ error: "Activation link is invalid" }, { status: 404 });
    }

    if (invite.used_at) {
      return NextResponse.json({ error: "Activation link has already been used" }, { status: 410 });
    }

    return NextResponse.json({
      valid: true,
      email: invite.email,
      fullName: invite.full_name,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not validate activation link" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const password = typeof body.password === "string" ? body.password.trim() : "";

  if (!token) {
    return NextResponse.json({ error: "Missing activation token" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  try {
    const invite = await getClientInviteByToken(token);
    if (!invite) {
      return NextResponse.json({ error: "Activation link is invalid" }, { status: 404 });
    }

    if (invite.used_at) {
      return NextResponse.json({ error: "Activation link has already been used" }, { status: 410 });
    }

    const admin = createAdminClient();
    const { data: authUserData, error: authUserError } = await admin.auth.admin.getUserById(invite.user_id);
    if (authUserError || !authUserData.user) {
      return NextResponse.json({ error: authUserError?.message || "User not found" }, { status: 404 });
    }

    const existingMetadata = authUserData.user.user_metadata || {};
    const { error: updateError } = await admin.auth.admin.updateUserById(invite.user_id, {
      password,
      user_metadata: {
        ...existingMetadata,
        requires_password_setup: false,
      },
    });

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const { error: inviteUpdateError } = await admin
      .from("client_invites")
      .update({
        used_at: new Date().toISOString(),
        used_ip: getRequestIp(request),
      })
      .eq("id", invite.id)
      .is("used_at", null);

    if (inviteUpdateError) {
      return NextResponse.json({ error: inviteUpdateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      email: invite.email,
      redirect: "/portal",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not activate account" },
      { status: 500 },
    );
  }
}
