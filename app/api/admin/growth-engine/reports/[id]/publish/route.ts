import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CBB_GROWTH_ENGINE_KEY, requireGrowthManager } from "@/lib/growth-engine";
import { notifyPortalUsers } from "@/lib/notifications";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await requireGrowthManager();
  if (!viewer.authorized) {
    return NextResponse.json({ error: viewer.error }, { status: viewer.status });
  }

  const { id } = await params;
  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin.from("cbb_growth_reports")
    .select("id, title, status, published_at, notification_sent_at, workspace_id")
    .eq("id", id).maybeSingle();
  if (existingError) return NextResponse.json({ error: "Could not load the report." }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "Report not found." }, { status: 404 });
  if (existing.status === "withdrawn") {
    return NextResponse.json(
      { error: "Withdrawn reports cannot be republished. Create a new draft instead." },
      { status: 409 },
    );
  }

  const newlyPublished = existing.status === "draft";
  let report = existing;
  if (existing.status === "draft") {
    const now = new Date().toISOString();
    const { data: published, error: publishError } = await admin.from("cbb_growth_reports")
      .update({
        status: "published",
        published_at: now,
        published_by: viewer.userId,
        updated_by: viewer.userId,
        updated_at: now,
      })
      .eq("id", id).eq("status", "draft")
      .select("id, title, status, published_at, notification_sent_at, workspace_id")
      .maybeSingle();
    if (publishError) {
      return NextResponse.json({ error: "Could not publish the report." }, { status: 500 });
    }
    if (published) report = published;
  }

  const { data: workspace } = await admin.from("cbb_growth_workspaces")
    .select("client_id").eq("id", report.workspace_id).single();
  if (!workspace) {
    return NextResponse.json({ error: "Report workspace not found." }, { status: 500 });
  }

  const [clientResult, entitlementResult] = await Promise.all([
    admin.from("client_profiles").select("user_id, archived_at").eq("id", workspace.client_id).single(),
    admin.from("client_entitlements").select("status")
      .eq("client_id", workspace.client_id)
      .eq("entitlement_key", CBB_GROWTH_ENGINE_KEY)
      .maybeSingle(),
  ]);

  let notificationSent = Boolean(report.notification_sent_at);
  if (
    !notificationSent &&
    clientResult.data &&
    !clientResult.data.archived_at &&
    entitlementResult.data?.status === "active"
  ) {
    const notificationResult = await notifyPortalUsers(admin, [{
      userId: clientResult.data.user_id,
      title: "Your CBB Growth Engine report is ready",
      message: report.title,
      link: `/portal/growth-engine/reports/${report.id}`,
      pushTag: `cbb-growth-report-${report.id}`,
      dedupeKey: `cbb-growth-report-${report.id}`,
    }]);

    if (notificationResult.failed === 0) {
      const { error: notificationUpdateError } = await admin.from("cbb_growth_reports")
        .update({ notification_sent_at: new Date().toISOString() })
        .eq("id", report.id).is("notification_sent_at", null);
      notificationSent = !notificationUpdateError;
    }
  }

  if (newlyPublished) {
    await admin.from("cbb_growth_report_events").insert({
      report_id: report.id,
      event_type: "published",
      actor_user_id: viewer.userId,
    });
  }

  return NextResponse.json({
    report: { ...report, status: "published" },
    notified: notificationSent,
  });
}
