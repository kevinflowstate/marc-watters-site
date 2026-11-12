// Phase 2: tell opted-in admins a draft is waiting. Recipients are only ever users with role 'admin'.
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendPushToUser } from "@/lib/push";
import { replyDraftPushEnabled } from "./config";
import { pushCopy } from "./rules";

export async function adminPushRecipients(admin: SupabaseClient): Promise<string[]> {
  const [{ data: admins }, { data: prefs }] = await Promise.all([
    admin.from("users").select("id").eq("role", "admin"),
    admin.from("reply_draft_push_prefs").select("user_id, enabled"),
  ]);
  const off = new Set(((prefs || []) as Array<{ user_id: string; enabled: boolean }>).filter((p) => !p.enabled).map((p) => p.user_id));
  return ((admins || []) as Array<{ id: string }>).map((a) => a.id).filter((id) => !off.has(id));
}

export async function notifyAdminsOfDraft(
  admin: SupabaseClient,
  draft: { draftId: string; clientId: string; status: "ready" | "needs_marc"; draftText: string | null; reason: string | null },
) {
  if (!replyDraftPushEnabled()) return { sent: 0 };
  try {
    const { data: profile } = await admin.from("client_profiles").select("user_id, business_name").eq("id", draft.clientId).maybeSingle();
    const { data: user } = profile?.user_id
      ? await admin.from("users").select("full_name").eq("id", profile.user_id).maybeSingle()
      : { data: null };
    const name = (user?.full_name as string | undefined)?.trim() || profile?.business_name || "a client";
    const copy = pushCopy(name, draft.status, draft.draftText, draft.reason);
    let sent = 0;
    for (const userId of await adminPushRecipients(admin)) {
      try {
        const res = await sendPushToUser(userId, { ...copy, url: `/admin/approve/${draft.draftId}`, tag: `reply-draft-${draft.clientId}` });
        sent += res.sent;
      } catch (error) {
        console.error("reply_drafts_push_failed", error instanceof Error ? error.message : String(error));
      }
    }
    return { sent };
  } catch (error) {
    console.error("reply_drafts_push_failed", error instanceof Error ? error.message : String(error));
    return { sent: 0 };
  }
}
