import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseClientIntake } from "@/lib/client-intake";

export async function POST(request: Request) {
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  if (!user)
    return NextResponse.json(
      { error: "Sign in to complete your profile." },
      { status: 401 },
    );
  let fields;
  try {
    fields = parseClientIntake(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid profile." },
      { status: 400 },
    );
  }
  const result = await createAdminClient().rpc("cbb_complete_client_intake", {
    p_user: user.id,
    p_fields: fields,
  });
  if (result.error)
    return NextResponse.json(
      { error: "Your profile could not be saved. Please try again." },
      { status: 409 },
    );
  return NextResponse.json({ success: true });
}
