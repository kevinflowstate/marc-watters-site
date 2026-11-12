import { requireAdmin } from "@/lib/admin-auth";
import { replyDraftPushEnabled, replyDraftsEnabled } from "@/lib/reply-drafts/config";
import { draftStats } from "@/lib/reply-drafts/rules";
import { buildStyleGuide } from "@/lib/reply-drafts/style-guide";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const maxDuration = 300;

function monthStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/** Style guide, this month's draft stats (counts only, never money) and my push preference. Admins only. */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!replyDraftsEnabled()) return NextResponse.json({ enabled: false });

  const admin = createAdminClient();
  const [{ data: guide }, { data: rows }, { data: pref }] = await Promise.all([
    admin.from("reply_style_guides").select("content, generated_at, generated_from, approved_at, updated_at").eq("id", "marc").maybeSingle(),
    admin.from("reply_drafts").select("status").gte("created_at", monthStart()),
    admin.from("reply_draft_push_prefs").select("enabled").eq("user_id", auth.userId).maybeSingle(),
  ]);

  return NextResponse.json({
    enabled: true,
    pushAvailable: replyDraftPushEnabled(),
    pushOptIn: pref ? Boolean(pref.enabled) : true,
    guide: guide ?? null,
    stats: draftStats((rows || []) as Array<{ status: string }>),
  });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!replyDraftsEnabled()) return NextResponse.json({ error: "Reply drafts are switched off." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const admin = createAdminClient();
  const now = new Date().toISOString();

  if (body?.action === "build") {
    try {
      const result = await buildStyleGuide(admin, { adminUserId: auth.userId });
      return NextResponse.json({ ok: true, content: result.content, pairs: result.pairs });
    } catch (error) {
      const status = (error as { status?: number }).status || 500;
      return NextResponse.json({ error: error instanceof Error ? error.message : "Could not build the style guide" }, { status });
    }
  }

  if (body?.action === "save") {
    const content = typeof body.content === "string" ? body.content.trim() : "";
    if (content.length < 40) return NextResponse.json({ error: "The style guide is too short to draft from." }, { status: 400 });
    const { error } = await admin.from("reply_style_guides").upsert({
      id: "marc",
      content: content.slice(0, 40_000),
      approved_at: now,
      approved_by: auth.userId,
      updated_at: now,
      updated_by: auth.userId,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, approved_at: now });
  }

  if (body?.action === "push") {
    const { error } = await admin
      .from("reply_draft_push_prefs")
      .upsert({ user_id: auth.userId, enabled: Boolean(body.enabled), updated_at: now });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, pushOptIn: Boolean(body.enabled) });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
