import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { defaultCheckinConfig, deriveCheckinMood } from "@/lib/checkins";
import { checkinErrors, sameResponses, submissionIdPattern, validReceipt, validResponses } from "@/lib/checkin-submission";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const requestId = randomUUID();
  const started = Date.now();
  let stage = "authentication";
  let clientId: string | undefined;
  let submissionId: string | undefined;
  function failure(status: number, error: string, code: string) {
    console.error("checkin_submission", { requestId, clientId, submissionId, stage, code, status, durationMs: Date.now() - started });
    return NextResponse.json({ error, requestId }, { status });
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return failure(401, "Please sign in again. Your check-in has been kept on this device.", "unauthenticated");

    const admin = createAdminClient();
    stage = "profile";
    const { data: profile, error: profileError } = await admin.from("client_profiles")
      .select("id, archived_at").eq("user_id", user.id).maybeSingle();
    if (profileError) return failure(503, "We could not check your account. Please try again.", profileError.code);
    if (!profile) return failure(404, "Client profile not found. Please contact Marc.", "client_not_found");
    clientId = profile.id;
    if (profile.archived_at) return failure(403, "This client account is archived. Please contact Marc.", "client_archived");

    stage = "request";
    const body = await request.json().catch(() => null);
    if (body?.userId !== undefined && body.userId !== user.id) return failure(401, "Your signed-in account changed. Sign in to the original account to submit this draft.", "account_changed");
    if (!body || !validResponses(body.responses)) return failure(400, "Please check your answers and try again.", "invalid_responses");
    // Older already-open forms receive the atomic save too, but cannot deduplicate a lost-response retry.
    submissionId = body.submissionId === undefined ? randomUUID() : body.submissionId;
    if (typeof submissionId !== "string" || !submissionIdPattern.test(submissionId)) return failure(400, "Invalid submission reference. Please contact Marc.", "invalid_submission_id");

    // Reconcile an earlier save before applying a possibly updated form configuration.
    stage = "receipt_lookup";
    const { data: existing, error: existingError } = await admin.from("checkins")
      .select("id, client_id, week_number, created_at, responses, mood").eq("id", submissionId).maybeSingle();
    if (existingError) return failure(503, "We could not confirm your check-in yet. Please retry safely below.", existingError.code);
    if (existing) {
      if (existing.client_id !== clientId || !validResponses(existing.responses) ||
        !sameResponses(existing.responses, body.responses) || existing.mood !== body.mood) {
        return failure(409, "This submission reference has different saved answers. Your current answers are kept; please contact Marc.", "submission_conflict");
      }
      if (!validReceipt(existing, submissionId)) return failure(503, "The saved check-in could not be confirmed. Please retry.", "invalid_receipt");
      return NextResponse.json({ success: true, receipt: { id: existing.id, week_number: existing.week_number, created_at: existing.created_at }, week_number: existing.week_number, duplicate: true });
    }

    stage = "configuration";
    const { data: configRow, error: configError } = await admin.from("form_config")
      .select("config").eq("form_type", "checkin").maybeSingle();
    if (configError) return failure(503, "We could not load the check-in questions. Please try again.", configError.code);
    const config = configRow?.config || defaultCheckinConfig;
    const validation = checkinErrors(config, body.responses, body.mood);
    const firstError = Object.values(validation)[0];
    if (firstError) {
      stage = "validation_reconciliation";
      const { data: settled, error: settleError } = await admin.rpc("submit_checkin_atomic", {
        p_client_id: clientId, p_submission_id: submissionId,
        p_mood: typeof body.mood === "string" && body.mood.trim() ? body.mood : deriveCheckinMood(body.responses),
        p_responses: body.responses, p_cancel: true,
      });
      if (settleError) return failure(503, "We could not safely unlock this submission yet. Please retry.", settleError.code);
      if (validReceipt(settled, submissionId)) return NextResponse.json({ success: true, receipt: settled, week_number: settled.week_number });
      if (settled?.cancelled === true) {
        return NextResponse.json({ error: firstError, requestId, cancelled: true, config }, { status: 400 });
      }
      return failure(503, "We could not safely unlock this submission yet. Please retry.", "invalid_reconciliation");
    }
    // A stable-ID request freezes its effective mood too. Do not rewrite it if the form configuration changed in another tab.
    const mood = body.submissionId !== undefined
      ? body.mood
      : config.mood_enabled && config.mood_options.length ? body.mood : deriveCheckinMood(body.responses);
    if (typeof mood !== "string" || !mood.trim()) return failure(400, "Please choose how you are feeling and try again.", "invalid_mood");

    stage = "atomic_save";
    const { data: receipt, error: saveError } = await admin.rpc("submit_checkin_atomic", {
      p_client_id: clientId, p_submission_id: submissionId, p_mood: mood, p_responses: body.responses,
    });
    if (saveError) {
      const status = saveError.message === "client_archived" ? 403 : saveError.message === "submission_conflict" ? 409 : 503;
      return failure(status, "Your check-in has not been confirmed. Your answers are kept; please retry or contact Marc with the reference below.", saveError.code);
    }
    if (receipt?.cancelled === true) return NextResponse.json({ error: "The earlier attempt was safely cancelled. Review your answers and submit again.", cancelled: true, config }, { status: 409 });
    if (!validReceipt(receipt, submissionId)) return failure(503, "Your check-in has not been confirmed yet. Please retry safely below.", "invalid_receipt");
    console.info("checkin_submission", { requestId, clientId, submissionId, stage: "saved", receiptId: receipt.id, durationMs: Date.now() - started });
    return NextResponse.json({ success: true, receipt, week_number: receipt.week_number });
  } catch {
    return failure(503, "We could not confirm your check-in. Your answers are kept; please retry.", "unexpected_error");
  }
}
