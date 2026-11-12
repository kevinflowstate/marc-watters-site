// Server-only context for a reply draft. Uses the service-role client; never import from client components.
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientHealth, loadCheckinDay, loadClientActivity } from "@/lib/client-health";
import { defaultCheckinConfig } from "@/lib/checkins";
import { getQuestionAnswerLabel } from "@/lib/questionnaires";
import type { CheckinFormConfig, FormQuestion } from "@/lib/types";
import type { ThreadMessage } from "./rules";

export type CheckinForDraft = {
  id: string;
  week_number: number;
  mood: string | null;
  created_at: string;
  answers: Array<{ label: string; answer: string }>;
  admin_reply: string | null;
  client_reply: string | null;
};

export type DraftContext = {
  client: {
    fullName: string;
    firstName: string;
    businessName: string | null;
    businessType: string | null;
    goals: string | null;
    programmeWeek: number | null;
    health: { status: string; label: string; reason: string };
  };
  thread: Array<{ from: "client" | "Marc" | "admin"; text: string; at: string; id: string }>;
  clientMessages: string[];
  checkin: CheckinForDraft | null;
  recentCheckins: CheckinForDraft[];
  plan: null | {
    summary: string | null;
    done: number;
    total: number;
    phases: Array<{ name: string; done: number; total: number }>;
    nextOpenItems: string[];
  };
  lessons: Array<{ module: string; title: string; description: string | null }>;
};

const DAY = 24 * 60 * 60 * 1000;

function clip(text: string | null | undefined, max: number) {
  const t = (text || "").replace(/\s+\n/g, "\n").trim();
  return t.length > max ? `${t.slice(0, max - 3)}...` : t;
}

export function checkinAnswers(responses: unknown, questions: FormQuestion[], legacy: { wins?: string | null; challenges?: string | null; questions?: string | null }) {
  const answers: Array<{ label: string; answer: string }> = [];
  const r = responses && typeof responses === "object" && !Array.isArray(responses) ? (responses as Record<string, string>) : null;
  if (r) {
    for (const q of questions) {
      const answer = getQuestionAnswerLabel(q, r);
      if (answer) answers.push({ label: q.label, answer: clip(answer, 1200) });
    }
  }
  if (!answers.length) {
    if (legacy.wins) answers.push({ label: "Wins", answer: clip(legacy.wins, 1200) });
    if (legacy.challenges) answers.push({ label: "Challenges", answer: clip(legacy.challenges, 1200) });
    if (legacy.questions) answers.push({ label: "Questions", answer: clip(legacy.questions, 1200) });
  }
  return answers;
}

export async function gatherDraftContext(
  admin: SupabaseClient,
  draft: { client_id: string; kind: string; checkin_id: string | null; source_message_ids: string[] | null },
  voiceUserId: string | null,
  now = new Date(),
): Promise<DraftContext> {
  const { data: profile, error: profileError } = await admin
    .from("client_profiles")
    .select("id, user_id, business_name, business_type, goals, start_date, created_at, last_login, last_checkin, archived_at")
    .eq("id", draft.client_id)
    .single();
  if (profileError || !profile) throw new Error("client_not_found");

  const [userRes, configRes, threadRes, checkinsRes, planRes, modulesRes, activity, checkinDay] = await Promise.all([
    admin.from("users").select("full_name").eq("id", profile.user_id).maybeSingle(),
    admin.from("form_config").select("config").eq("form_type", "checkin").maybeSingle(),
    admin
      .from("inbox_messages")
      .select("id, sender_role, sender_user_id, message, created_at, reply_context")
      .eq("client_id", draft.client_id)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("checkins")
      .select("id, week_number, mood, created_at, responses, wins, challenges, questions, admin_reply, client_reply")
      .eq("client_id", draft.client_id)
      .order("created_at", { ascending: false })
      .limit(4),
    admin
      .from("business_plans")
      .select("id, summary, status, phases:business_plan_phases(name, order_index, items:business_plan_items(title, completed, order_index))")
      .eq("client_id", draft.client_id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1),
    admin
      .from("training_modules")
      .select("id, title, order_index, lessons:module_content(title, content_text, order_index)")
      .eq("is_published", true)
      .order("order_index", { ascending: true }),
    loadClientActivity(admin, [{ id: profile.id, user_id: profile.user_id }], now),
    loadCheckinDay(admin),
  ]);

  const fullName = (userRes.data?.full_name as string | undefined)?.trim() || profile.business_name || "Client";
  const questions: FormQuestion[] = ((configRes.data?.config as CheckinFormConfig | null)?.questions?.length
    ? (configRes.data!.config as CheckinFormConfig).questions
    : defaultCheckinConfig.questions);

  const health = clientHealth(
    { lastLogin: profile.last_login, lastCheckin: profile.last_checkin, createdAt: profile.created_at, activity: activity.get(profile.id) },
    now,
    checkinDay,
  );
  const startMs = Date.parse(profile.start_date || profile.created_at || "");
  const programmeWeek = Number.isFinite(startMs) ? Math.max(1, Math.floor((now.getTime() - startMs) / (7 * DAY)) + 1) : null;

  type Row = ThreadMessage & { sender_user_id: string };
  const rows = ((threadRes.data || []) as Row[]).reverse();
  const thread = rows.map((m) => ({
    id: m.id,
    from: m.sender_role === "client" ? ("client" as const) : m.sender_user_id === voiceUserId ? ("Marc" as const) : ("admin" as const),
    text: clip(m.message || "(attachment)", 2000),
    at: m.created_at,
  }));
  const sourceIds = new Set(draft.source_message_ids || []);
  const clientMessages = rows.filter((m) => sourceIds.has(m.id)).map((m) => clip(m.message || "(attachment)", 3000));

  const toCheckin = (c: Record<string, unknown>): CheckinForDraft => ({
    id: c.id as string,
    week_number: c.week_number as number,
    mood: (c.mood as string | null) ?? null,
    created_at: c.created_at as string,
    answers: checkinAnswers(c.responses, questions, c as { wins?: string; challenges?: string; questions?: string }),
    admin_reply: c.admin_reply ? clip(c.admin_reply as string, 2000) : null,
    client_reply: c.client_reply ? clip(c.client_reply as string, 1500) : null,
  });
  const allCheckins = ((checkinsRes.data || []) as Array<Record<string, unknown>>).map(toCheckin);
  let checkin = draft.checkin_id ? allCheckins.find((c) => c.id === draft.checkin_id) ?? null : null;
  if (draft.checkin_id && !checkin) {
    const { data } = await admin
      .from("checkins")
      .select("id, week_number, mood, created_at, responses, wins, challenges, questions, admin_reply, client_reply")
      .eq("id", draft.checkin_id)
      .maybeSingle();
    checkin = data ? toCheckin(data as Record<string, unknown>) : null;
  }
  const recentCheckins = allCheckins.filter((c) => c.id !== checkin?.id).slice(0, 3);

  type PlanRow = { summary: string | null; phases?: Array<{ name: string; order_index: number; items?: Array<{ title: string; completed: boolean; order_index: number }> }> };
  const planRow = ((planRes.data || []) as PlanRow[])[0];
  let plan: DraftContext["plan"] = null;
  if (planRow) {
    const phases = [...(planRow.phases || [])].sort((a, b) => a.order_index - b.order_index);
    const items = phases.flatMap((p) => [...(p.items || [])].sort((a, b) => a.order_index - b.order_index));
    plan = {
      summary: planRow.summary ? clip(planRow.summary, 800) : null,
      done: items.filter((i) => i.completed).length,
      total: items.length,
      phases: phases.map((p) => ({ name: p.name, done: (p.items || []).filter((i) => i.completed).length, total: (p.items || []).length })),
      nextOpenItems: items.filter((i) => !i.completed).slice(0, 5).map((i) => i.title),
    };
  }

  type ModuleRow = { title: string; lessons?: Array<{ title: string; content_text: string | null; order_index: number }> };
  const lessons = ((modulesRes.data || []) as ModuleRow[]).flatMap((m) =>
    [...(m.lessons || [])]
      .sort((a, b) => a.order_index - b.order_index)
      .map((l) => ({ module: m.title, title: l.title, description: l.content_text ? clip(l.content_text, 140) : null })),
  );

  return {
    client: {
      fullName,
      firstName: fullName.split(/\s+/)[0] || fullName,
      businessName: profile.business_name,
      businessType: profile.business_type,
      goals: profile.goals ? clip(profile.goals, 600) : null,
      programmeWeek,
      health: { status: health.status, label: health.label, reason: health.reason },
    },
    thread,
    clientMessages,
    checkin,
    recentCheckins,
    plan,
    lessons: lessons.slice(0, 150),
  };
}
