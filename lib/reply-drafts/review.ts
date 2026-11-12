import type { SupabaseClient } from "@supabase/supabase-js";
import { checkinAnswers } from "./context";
import { DRAFT_PUBLIC_COLUMNS, type PublicDraft } from "./store";
import { defaultCheckinConfig } from "@/lib/checkins";
import type { CheckinFormConfig } from "@/lib/types";

export type DraftReview = {
  draft: PublicDraft;
  clientName: string;
  businessName: string | null;
  clientMessages: Array<{ id: string; text: string; at: string }>;
  checkin: null | { id: string; weekNumber: number; answers: Array<{ label: string; answer: string }> };
};

/** Everything the approve page needs. No token or money columns. */
export async function loadDraftReview(admin: SupabaseClient, draftId: string): Promise<DraftReview | null> {
  const { data } = await admin.from("reply_drafts").select(DRAFT_PUBLIC_COLUMNS).eq("id", draftId).maybeSingle();
  const draft = data as PublicDraft | null;
  if (!draft) return null;

  const { data: profile } = await admin
    .from("client_profiles")
    .select("business_name, user:users!client_profiles_user_id_fkey(full_name)")
    .eq("id", draft.client_id)
    .maybeSingle();
  const user = Array.isArray(profile?.user) ? profile?.user[0] : profile?.user;
  const clientName = (user as { full_name?: string } | undefined)?.full_name || profile?.business_name || "Client";

  let clientMessages: DraftReview["clientMessages"] = [];
  if (draft.source_message_ids?.length) {
    const { data: msgs } = await admin
      .from("inbox_messages")
      .select("id, message, created_at")
      .in("id", draft.source_message_ids)
      .order("created_at", { ascending: true });
    clientMessages = ((msgs || []) as Array<{ id: string; message: string; created_at: string }>).map((m) => ({
      id: m.id,
      text: m.message || "(attachment)",
      at: m.created_at,
    }));
  }

  let checkin: DraftReview["checkin"] = null;
  if (draft.checkin_id) {
    const [{ data: ck }, { data: cfg }] = await Promise.all([
      admin.from("checkins").select("id, week_number, responses, wins, challenges, questions").eq("id", draft.checkin_id).maybeSingle(),
      admin.from("form_config").select("config").eq("form_type", "checkin").maybeSingle(),
    ]);
    if (ck) {
      const questions = (cfg?.config as CheckinFormConfig | null)?.questions?.length
        ? (cfg!.config as CheckinFormConfig).questions
        : defaultCheckinConfig.questions;
      checkin = { id: ck.id, weekNumber: ck.week_number, answers: checkinAnswers(ck.responses, questions, ck) };
    }
  }

  return { draft, clientName, businessName: profile?.business_name ?? null, clientMessages, checkin };
}
