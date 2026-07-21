import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

function safeFileName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "client";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderSection(title: string, value: unknown): string {
  return `<section><h2>${escapeHtml(title)}</h2><pre>${escapeHtml(JSON.stringify(value, null, 2))}</pre></section>`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("client_profiles")
    .select("*, user:users!client_profiles_user_id_fkey(id, email, full_name, avatar_url, created_at)")
    .eq("id", id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const [plansResult, checkinsResult, assignmentsResult, progressResult, questionnairesResult,
    metricsResult, messagesResult, notificationsResult, notesResult, usageResult,
    attemptsResult, invitesResult, lifecycleResult] = await Promise.all([
    admin.from("business_plans").select("*").eq("client_id", id).order("created_at"),
    admin.from("checkins").select("*").eq("client_id", id).order("created_at"),
    admin.from("client_modules").select("*, module:training_modules(*)").eq("client_id", id),
    admin.from("content_progress").select("*, content:module_content(*)").eq("client_id", id),
    admin.from("client_questionnaires").select("*").eq("client_id", id).order("submitted_at"),
    admin.from("client_monthly_metrics").select("*").eq("client_id", id).order("month_start"),
    admin.from("inbox_messages").select("*").eq("client_id", id).order("created_at"),
    admin.from("notifications").select("*").eq("user_id", profile.user_id).order("created_at"),
    admin.from("internal_notes").select("*").eq("client_id", id).maybeSingle(),
    admin.from("ai_usage").select("*").eq("user_id", profile.user_id).order("created_at"),
    admin.from("push_notification_attempts").select("id, notification_type, notification_tag, status, error_status, error_message, created_at").eq("user_id", profile.user_id).order("created_at"),
    admin.from("client_invites").select("id, email, full_name, created_at, last_sent_at, used_at, used_ip, revoked_at").eq("user_id", profile.user_id),
    admin.from("client_lifecycle_events").select("*").eq("client_id", id).order("created_at"),
  ]);

  const plans = plansResult.data || [];
  const planIds = plans.map((plan) => plan.id);
  const { data: phases } = planIds.length
    ? await admin.from("business_plan_phases").select("*").in("plan_id", planIds).order("order_index")
    : { data: [] };
  const phaseIds = (phases || []).map((phase) => phase.id);
  const [{ data: items }, { data: trainingLinks }] = phaseIds.length
    ? await Promise.all([
        admin.from("business_plan_items").select("*").in("phase_id", phaseIds).order("order_index"),
        admin.from("phase_training_links").select("*, content:module_content(id, title, content_type)").in("phase_id", phaseIds),
      ])
    : [{ data: [] }, { data: [] }];

  const messageIds = (messagesResult.data || []).map((message) => message.id);
  const { data: reactions } = messageIds.length
    ? await admin.from("inbox_message_reactions").select("*").in("message_id", messageIds).order("created_at")
    : { data: [] };

  const exportedAt = new Date().toISOString();
  const archive = {
    manifest: {
      exported_at: exportedAt,
      exported_by: auth.userId,
      client_id: id,
      format_version: 1,
    },
    client: profile,
    business_plans: { plans, phases: phases || [], items: items || [], training_links: trainingLinks || [] },
    checkins: checkinsResult.data || [],
    training: { assignments: assignmentsResult.data || [], progress: progressResult.data || [] },
    questionnaires: questionnairesResult.data || [],
    monthly_metrics: metricsResult.data || [],
    inbox: { messages: messagesResult.data || [], reactions: reactions || [] },
    notifications: notificationsResult.data || [],
    internal_notes: notesResult.data || null,
    ai_usage: usageResult.data || [],
    push_delivery_history: attemptsResult.data || [],
    activation_history: invitesResult.data || [],
    lifecycle_history: lifecycleResult.data || [],
  };

  await admin.from("client_lifecycle_events").insert({
    client_id: id,
    event_type: "export",
    actor_user_id: auth.userId,
    metadata: { format: new URL(request.url).searchParams.get("format") === "json" ? "json" : "html" },
  });

  const user = Array.isArray(profile.user) ? profile.user[0] : profile.user;
  const clientName = user?.full_name || profile.business_name || "client";
  const fileBase = `${safeFileName(clientName)}-archive-${exportedAt.slice(0, 10)}`;
  const wantsJson = new URL(request.url).searchParams.get("format") === "json";

  if (wantsJson) {
    return new NextResponse(JSON.stringify(archive, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileBase}.json"`,
      },
    });
  }

  const sections = Object.entries(archive)
    .map(([title, value]) => renderSection(title.replaceAll("_", " "), value))
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(clientName)} client archive</title><style>body{font:14px/1.5 system-ui,sans-serif;max-width:1100px;margin:40px auto;padding:0 24px;color:#18212f}h1{margin-bottom:4px}h2{text-transform:capitalize;border-bottom:1px solid #d8dee8;padding-bottom:8px;margin-top:32px}p{color:#5b6574}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f5f7fa;border:1px solid #dfe4ec;border-radius:8px;padding:16px;font-size:12px}@media print{body{margin:0;max-width:none}section{break-inside:avoid}pre{background:white}}</style></head><body><h1>${escapeHtml(clientName)} — client archive</h1><p>Exported ${escapeHtml(exportedAt)}. This report is read-only evidence of the client record retained in the portal.</p>${sections}</body></html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileBase}.html"`,
    },
  });
}
