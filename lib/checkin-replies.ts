import { defaultCheckinConfig } from "@/lib/checkins";
import { sendCheckinReplyEmail } from "@/lib/email-templates";
import { getEnv } from "@/lib/env";
import { sendPushToUser } from "@/lib/push";
import { getQuestionAnswerLabel } from "@/lib/questionnaires";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CheckinFormConfig, FormQuestion } from "@/lib/types";

const SUMMARY_QUESTION_LABELS: Record<string, string> = {
  overall_week_rating: "Week rating",
  business_feeling: "Feeling",
  what_went_well: "Went well",
  what_didnt_go_well: "Needs attention",
  headline_goal_next_week: "Next focus",
  need_anything_from_marc: "Needs from Marc",
};

const SUMMARY_QUESTION_ORDER = [
  "overall_week_rating",
  "business_feeling",
  "what_went_well",
  "what_didnt_go_well",
  "headline_goal_next_week",
  "need_anything_from_marc",
];

type CheckinForReply = {
  id: string;
  client_id: string;
  week_number: number;
  wins: string | null;
  challenges: string | null;
  questions: string | null;
  responses: Record<string, unknown> | null;
  admin_reply: string | null;
};

type AdminSender = {
  id: string;
  full_name: string;
  role: string;
};

type SendCheckinReplyOptions = {
  checkinId: string;
  replyText: string;
  senderUserId: string;
  overwrite?: boolean;
  approvalId?: string;
  approvedBy?: string;
};

type SendCheckinReplyResult = {
  success: true;
  checkinId: string;
  clientId: string;
  senderUserId: string;
  inboxInserted: boolean;
  notificationInserted: boolean;
  pushSent: number;
  pushFailed: number;
  emailSent: boolean;
  approvalId: string | null;
  approvedBy: string | null;
  overwrittenExistingReply: boolean;
};

export async function resolveCheckinReplySender(): Promise<AdminSender> {
  const configuredSenderId = getEnv("FLOWSTATE_PORTAL_REPLY_SENDER_USER_ID");
  if (!configuredSenderId) {
    const error = new Error("flowstate_portal_reply_sender_not_configured");
    (error as Error & { status?: number }).status = 503;
    throw error;
  }

  const admin = createAdminClient();
  const { data: configuredUser } = await admin
    .from("users")
    .select("id, full_name, role")
    .eq("id", configuredSenderId)
    .eq("role", "admin")
    .maybeSingle<AdminSender>();

  if (configuredUser) return configuredUser;

  const error = new Error("flowstate_portal_reply_sender_not_found");
  (error as Error & { status?: number }).status = 403;
  throw error;
}

export async function sendCheckinReply({
  checkinId,
  replyText,
  senderUserId,
  overwrite = false,
  approvalId,
  approvedBy,
}: SendCheckinReplyOptions): Promise<SendCheckinReplyResult> {
  const cleanCheckinId = checkinId.trim();
  const cleanReply = replyText.trim();

  if (!cleanCheckinId || !cleanReply) {
    const error = new Error("checkin_id_and_reply_text_required");
    (error as Error & { status?: number }).status = 400;
    throw error;
  }

  const admin = createAdminClient();
  const { data: checkin, error: checkinError } = await admin
    .from("checkins")
    .select("id, client_id, week_number, wins, challenges, questions, responses, admin_reply")
    .eq("id", cleanCheckinId)
    .single<CheckinForReply>();

  if (checkinError || !checkin) {
    const error = new Error("checkin_not_found");
    (error as Error & { status?: number }).status = 404;
    throw error;
  }

  const overwrittenExistingReply = Boolean(checkin.admin_reply);
  if (overwrittenExistingReply && !overwrite) {
    const error = new Error("checkin_already_replied");
    (error as Error & { status?: number }).status = 409;
    throw error;
  }

  let updateQuery = admin
    .from("checkins")
    .update({
      admin_reply: cleanReply,
      replied_at: new Date().toISOString(),
    })
    .eq("id", cleanCheckinId);

  if (!overwrite) {
    updateQuery = updateQuery.is("admin_reply", null);
  }

  const { data: updatedRows, error: updateError } = await updateQuery.select("id");

  if (updateError) throw new Error(updateError.message);

  if (!updatedRows || updatedRows.length === 0) {
    const error = new Error("checkin_already_replied");
    (error as Error & { status?: number }).status = 409;
    throw error;
  }

  const { data: configRow } = await admin
    .from("form_config")
    .select("config")
    .eq("form_type", "checkin")
    .maybeSingle<{ config: CheckinFormConfig | null }>();

  const checkinQuestions = configRow?.config?.questions?.length
    ? configRow.config.questions
    : defaultCheckinConfig.questions;

  const { data: clientProfile } = await admin
    .from("client_profiles")
    .select("user_id")
    .eq("id", checkin.client_id)
    .single<{ user_id: string }>();

  if (!clientProfile) {
    const error = new Error("client_profile_not_found");
    (error as Error & { status?: number }).status = 404;
    throw error;
  }

  const { data: clientUser } = await admin
    .from("users")
    .select("email, full_name")
    .eq("id", clientProfile.user_id)
    .single<{ email: string; full_name: string }>();

  if (!clientUser) {
    const error = new Error("client_user_not_found");
    (error as Error & { status?: number }).status = 404;
    throw error;
  }

  const { error: inboxError } = await admin.from("inbox_messages").insert({
    client_id: checkin.client_id,
    sender_user_id: senderUserId,
    sender_role: "admin",
    message: cleanReply,
    attachments: [],
    reply_context: {
      type: "checkin",
      title: `Week ${checkin.week_number} check-in`,
      body: summarizeCheckin(checkin, checkinQuestions),
      href: `/portal/checkins/${cleanCheckinId}`,
    },
    read_by_admin: true,
    read_by_client: false,
  });

  if (inboxError) throw new Error(inboxError.message);

  const { error: notificationError } = await admin.from("notifications").insert({
    user_id: clientProfile.user_id,
    title: `Marc replied to your Week ${checkin.week_number} check-in`,
    message: cleanReply.slice(0, 200),
    link: "/portal/inbox",
  });

  let pushSent = 0;
  let pushFailed = 0;
  try {
    const pushResult = await sendPushToUser(clientProfile.user_id, {
      title: `Marc replied to your Week ${checkin.week_number} check-in`,
      body: cleanReply.slice(0, 140),
      url: "/portal/inbox",
      tag: `checkin-reply-${cleanCheckinId}`,
    });
    pushSent = pushResult.sent;
    pushFailed = pushResult.failed;
  } catch (pushErr) {
    console.error("Failed to send check-in reply push:", pushErr);
    pushFailed = 1;
  }

  let emailSent = false;
  try {
    await sendCheckinReplyEmail(clientUser.email, clientUser.full_name, cleanReply);
    emailSent = true;
  } catch (emailErr) {
    console.error("Failed to send reply email:", emailErr);
  }

  return {
    success: true,
    checkinId: cleanCheckinId,
    clientId: checkin.client_id,
    senderUserId,
    inboxInserted: true,
    notificationInserted: !notificationError,
    pushSent,
    pushFailed,
    emailSent,
    approvalId: approvalId || null,
    approvedBy: approvedBy || null,
    overwrittenExistingReply,
  };
}

function summarizeCheckin(checkin: CheckinForReply, questions: FormQuestion[]) {
  const responses = normalizeResponses(checkin.responses);
  const questionMap = new Map(questions.map((question) => [question.id, question]));
  const responseSummary = responses ? buildResponseSummary(responses, questionMap) : "";

  const summary =
    responseSummary ||
    checkin.questions ||
    checkin.challenges ||
    checkin.wins ||
    "Open the check-in for the full context.";

  return summary.length > 260 ? `${summary.slice(0, 257)}...` : summary;
}

function normalizeResponses(raw: Record<string, unknown> | null | undefined): Record<string, string> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const entries = Object.entries(raw).flatMap(([key, value]) => {
    if (typeof value !== "string") return [];
    const trimmed = value.trim();
    return trimmed ? [[key, trimmed] as [string, string]] : [];
  });

  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

function buildResponseSummary(responses: Record<string, string>, questionMap: Map<string, FormQuestion>) {
  const orderedQuestions = [
    ...SUMMARY_QUESTION_ORDER.map((id) => questionMap.get(id)).filter((question): question is FormQuestion => Boolean(question)),
    ...Array.from(questionMap.values()).filter((question) => !SUMMARY_QUESTION_ORDER.includes(question.id)),
  ];

  const parts = orderedQuestions
    .map((question) => {
      const answer = getQuestionAnswerLabel(question, responses);
      if (!answer) return null;

      const label = SUMMARY_QUESTION_LABELS[question.id] || question.label;
      return `${label}: ${answer}`;
    })
    .filter((value): value is string => Boolean(value))
    .slice(0, 4);

  return parts.join("; ");
}
