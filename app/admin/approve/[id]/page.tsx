import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { replyDraftsEnabled } from "@/lib/reply-drafts/config";
import { loadDraftReview } from "@/lib/reply-drafts/review";
import { createAdminClient } from "@/lib/supabase/admin";
import ApproveDraftClient from "@/components/reply-drafts/ApproveDraftClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Approve reply - Marc Watters" };

/** Opened from the "Reply to approve" push. Admins only (middleware and this check). */
export default async function ApproveDraftPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.authorized || !replyDraftsEnabled()) notFound();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const review = await loadDraftReview(createAdminClient(), id);
  if (!review) notFound();
  return <ApproveDraftClient review={review} />;
}
