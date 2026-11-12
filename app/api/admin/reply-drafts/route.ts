import { requireAdmin } from "@/lib/admin-auth";
import { replyDraftsEnabled } from "@/lib/reply-drafts/config";
import { generateIfDue } from "@/lib/reply-drafts/generate";
import { checkinKey, inboxKey } from "@/lib/reply-drafts/rules";
import { getOpenDraft } from "@/lib/reply-drafts/store";
import { createAdminClient } from "@/lib/supabase/admin";
import { after, NextResponse } from "next/server";

export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The open draft for one inbox conversation (?client_id=) or one check-in (?checkin_id=). Admins only. */
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!replyDraftsEnabled()) return NextResponse.json({ enabled: false, draft: null });

  const url = new URL(request.url);
  const clientId = url.searchParams.get("client_id");
  const checkinId = url.searchParams.get("checkin_id");
  const key = clientId && UUID.test(clientId) ? inboxKey(clientId) : checkinId && UUID.test(checkinId) ? checkinKey(checkinId) : null;
  if (!key) return NextResponse.json({ error: "client_id or checkin_id is required" }, { status: 400 });

  const admin = createAdminClient();
  const draft = await getOpenDraft(admin, key);

  // Lazy generation: the admin is looking at a conversation whose draft is due but not written yet.
  if (draft?.status === "pending" && Date.parse(draft.due_at) <= Date.now()) {
    const draftId = draft.id;
    after(() => generateIfDue(createAdminClient(), draftId));
  }

  return NextResponse.json({ enabled: true, draft });
}
