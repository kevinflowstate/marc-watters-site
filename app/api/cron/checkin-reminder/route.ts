import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push";
import { sendCheckinReminderEmail } from "@/lib/email-templates";
import { NextResponse } from "next/server";

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Get the configured check-in day
  const { data: formConfig } = await admin
    .from("form_config")
    .select("config")
    .eq("form_type", "checkin")
    .single();

  const checkinDay = formConfig?.config?.checkin_day || "monday";

  // Check if today matches the check-in day
  const today = DAYS[new Date().getDay()];
  if (today !== checkinDay) {
    return NextResponse.json({ message: `Not check-in day. Today: ${today}, check-in day: ${checkinDay}` });
  }

  // Get all client users (not admins)
  const { data: clients } = await admin
    .from("users")
    .select("id, full_name")
    .eq("role", "client");

  if (!clients || clients.length === 0) {
    return NextResponse.json({ message: "No clients found" });
  }

  // Check which clients have already checked in this week
  const startOfWeek = new Date();
  const dayOfWeek = startOfWeek.getDay();
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  startOfWeek.setDate(startOfWeek.getDate() - diffToMonday);
  startOfWeek.setHours(0, 0, 0, 0);

  const { data: recentCheckins } = await admin
    .from("checkins")
    .select("client_id")
    .gte("created_at", startOfWeek.toISOString());

  const checkedInClientIds = new Set(
    (recentCheckins || []).map((c) => c.client_id)
  );

  // Get client_profiles to map user_id -> client_id
  const { data: profiles } = await admin
    .from("client_profiles")
    .select("id, user_id");

  const userToClientId = new Map(
    (profiles || []).map((p) => [p.user_id, p.id])
  );

  // Send push + email to clients who haven't checked in yet
  let pushSent = 0;
  let emailSent = 0;
  let skipped = 0;

  // Get week number for email
  const { data: profilesWithStart } = await admin
    .from("client_profiles")
    .select("id, user_id, start_date");
  const clientStartDates = new Map(
    (profilesWithStart || []).map((p: { user_id: string; start_date: string }) => [p.user_id, p.start_date])
  );

  for (const client of clients) {
    const clientId = userToClientId.get(client.id);
    if (clientId && checkedInClientIds.has(clientId)) {
      skipped++;
      continue;
    }

    // Push notification
    const result = await sendPushToUser(client.id, {
      title: "Time for your weekly check-in",
      body: "Take 2 minutes to share your wins, challenges, and questions.",
      url: "/portal/checkin",
      tag: "checkin-reminder",
    });
    if (result.sent > 0) pushSent++;

    // Email fallback
    const startDate = clientStartDates.get(client.id);
    const weekNum = startDate
      ? Math.ceil((Date.now() - new Date(startDate).getTime()) / (7 * 24 * 60 * 60 * 1000))
      : 1;

    try {
      // Get client email
      const { data: userData } = await admin.auth.admin.getUserById(client.id);
      if (userData?.user?.email) {
        await sendCheckinReminderEmail(
          userData.user.email,
          client.full_name || "there",
          weekNum
        );
        emailSent++;
      }
    } catch {
      // Email send failed - push was the primary anyway
    }
  }

  return NextResponse.json({
    message: "Check-in reminders sent",
    today,
    checkinDay,
    pushSent,
    emailSent,
    skipped,
    totalClients: clients.length,
  });
}
