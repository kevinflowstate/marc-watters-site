import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("client_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Client profile not found" }, { status: 404 });
  }

  const { mood, responses } = await request.json();

  if (!mood) {
    return NextResponse.json({ error: "Mood is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Get next week number
  const { data: lastCheckin } = await admin
    .from("checkins")
    .select("week_number")
    .eq("client_id", profile.id)
    .order("week_number", { ascending: false })
    .limit(1)
    .single();

  const weekNumber = (lastCheckin?.week_number || 0) + 1;

  // Insert check-in with both legacy columns and new responses JSONB
  const { error: insertError } = await admin.from("checkins").insert({
    client_id: profile.id,
    week_number: weekNumber,
    mood,
    // Populate legacy columns for backward compatibility
    wins: responses?.wins || null,
    challenges: responses?.challenges || null,
    questions: responses?.questions || null,
    // Store full responses in JSONB
    responses: responses || null,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Update last checkin timestamp
  await admin
    .from("client_profiles")
    .update({ last_checkin: new Date().toISOString() })
    .eq("id", profile.id);

  return NextResponse.json({ success: true, week_number: weekNumber });
}
