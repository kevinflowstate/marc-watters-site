import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  getQuestionnaireConfig,
  isSupportedQuestionnaireType,
} from "@/lib/questionnaires";
import { NextResponse } from "next/server";

function normalizeResponses(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => typeof entry === "string")
    .map(([key, entry]) => [key, (entry as string).trim()]);

  return Object.fromEntries(entries);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ type: string }> },
) {
  const { type } = await params;
  if (!isSupportedQuestionnaireType(type)) {
    return NextResponse.json({ error: "Invalid questionnaire type" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  const { data: configRow } = await admin
    .from("form_config")
    .select("config")
    .eq("form_type", type)
    .maybeSingle();

  const { data: submission } = await admin
    .from("client_questionnaires")
    .select("id, client_id, questionnaire_type, responses, submitted_at, updated_at")
    .eq("client_id", profile.id)
    .eq("questionnaire_type", type)
    .maybeSingle();

  return NextResponse.json({
    config: configRow?.config || getQuestionnaireConfig(type),
    submission: submission
      ? {
          ...submission,
          responses: normalizeResponses(submission.responses),
        }
      : null,
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ type: string }> },
) {
  const { type } = await params;
  if (!isSupportedQuestionnaireType(type)) {
    return NextResponse.json({ error: "Invalid questionnaire type" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  const payload = await request.json().catch(() => ({}));
  const responses = normalizeResponses(payload.responses);

  const { data: configRow } = await admin
    .from("form_config")
    .select("config")
    .eq("form_type", type)
    .maybeSingle();

  const config = configRow?.config || getQuestionnaireConfig(type);
  const questions = Array.isArray(config?.questions) ? config.questions : [];

  for (const question of questions) {
    if (!question?.required) continue;

    const answer = responses[question.id];
    if (!answer) {
      return NextResponse.json({ error: `Please complete "${question.label}"` }, { status: 400 });
    }

    if (question.allow_other && answer === "other" && !responses[`${question.id}__other`]) {
      return NextResponse.json({ error: `Please complete "${question.label}"` }, { status: 400 });
    }
  }

  const timestamp = new Date().toISOString();
  const { data: existingSubmission } = await admin
    .from("client_questionnaires")
    .select("submitted_at")
    .eq("client_id", profile.id)
    .eq("questionnaire_type", type)
    .maybeSingle();

  const { error } = await admin
    .from("client_questionnaires")
    .upsert(
      {
        client_id: profile.id,
        questionnaire_type: type,
        responses,
        submitted_at: existingSubmission?.submitted_at || timestamp,
        updated_at: timestamp,
      },
      { onConflict: "client_id,questionnaire_type" },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, submitted_at: timestamp });
}
