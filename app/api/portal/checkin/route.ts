import { createAdminClient } from "@/lib/supabase/admin";
import { defaultCheckinConfig, deriveCheckinMood } from "@/lib/checkins";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("client_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Client profile not found" }, { status: 404 });
  }

  const requestBody = await request.json().catch(() => ({}));
  const responses =
    requestBody.responses && typeof requestBody.responses === "object" && !Array.isArray(requestBody.responses)
      ? requestBody.responses
      : {};

  const { data: configRow } = await admin
    .from("form_config")
    .select("config")
    .eq("form_type", "checkin")
    .maybeSingle();

  const config = configRow?.config || defaultCheckinConfig;

  for (const question of config.questions || []) {
    if (!question?.required) continue;

    const answer = responses[question.id];
    if (!answer) {
      return NextResponse.json({ error: `Please complete "${question.label}"` }, { status: 400 });
    }

    if (question.allow_other && answer === "other" && !responses[`${question.id}__other`]) {
      return NextResponse.json({ error: `Please complete "${question.label}"` }, { status: 400 });
    }
  }

  // Get next week number
  const { data: lastCheckin } = await admin
    .from("checkins")
    .select("week_number")
    .eq("client_id", profile.id)
    .order("week_number", { ascending: false })
    .limit(1)
    .single();

  const weekNumber = (lastCheckin?.week_number || 0) + 1;

  const payload = {
    client_id: profile.id,
    week_number: weekNumber,
    mood: config.mood_enabled ? requestBody.mood || "good" : deriveCheckinMood(responses),
    // Populate legacy columns for backward compatibility
    wins: responses?.what_went_well_detail || responses?.wins || null,
    challenges: responses?.what_didnt_go_well_detail || responses?.challenges || null,
    questions: responses?.need_anything_from_marc || responses?.questions || null,
    // Store full responses in JSONB
    responses: responses || null,
  };

  // Insert check-in with both legacy columns and new responses JSONB
  const { error: insertError } = await admin.from("checkins").insert({
    ...payload,
  });

  if (insertError) {
    const duplicateWeek =
      insertError.code === "23505" ||
      insertError.message?.includes("checkins_client_week_unique");

    if (duplicateWeek) {
      const { data: existing } = await admin
        .from("checkins")
        .select("week_number")
        .eq("client_id", profile.id)
        .eq("week_number", weekNumber)
        .single();

      await admin
        .from("client_profiles")
        .update({ last_checkin: new Date().toISOString() })
        .eq("id", profile.id);

      return NextResponse.json({ success: true, week_number: existing?.week_number || weekNumber, duplicate: true });
    }

    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Update last checkin timestamp
  await admin
    .from("client_profiles")
    .update({ last_checkin: new Date().toISOString() })
    .eq("id", profile.id);

  return NextResponse.json({ success: true, week_number: weekNumber });
}
