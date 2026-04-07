import { createAdminClient } from "@/lib/supabase/admin";
import { sendWeeklySummaryEmail } from "@/lib/email-templates";
import { NextResponse } from "next/server";

const MARC_EMAIL = "marc@marcwatters.com";

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Get all clients
  const { data: profiles } = await admin
    .from("client_profiles")
    .select("id, user_id, business_name, last_login, last_checkin, created_at, users!inner(full_name, email)")
    .order("status");

  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ sent: false, reason: "No clients" });
  }

  // Get check-ins from the past 7 days
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { data: recentCheckins } = await admin
    .from("checkins")
    .select("client_id, week_number")
    .gte("created_at", weekAgo.toISOString());

  const checkedInClientIds = new Set((recentCheckins || []).map((c: { client_id: string }) => c.client_id));

  // Get plan items completed in the past 7 days
  const { data: recentCompletions } = await admin
    .from("business_plan_items")
    .select("title, completed_at")
    .eq("completed", true)
    .gte("completed_at", weekAgo.toISOString());

  // Build summary
  const checkedIn: string[] = [];
  const missed: string[] = [];
  const redClients: string[] = [];
  const now = Date.now();
  const DAY = 1000 * 60 * 60 * 24;

  for (const p of profiles) {
    const user = Array.isArray(p.users) ? p.users[0] : p.users;
    const name = (user as { full_name: string })?.full_name || "Unknown";

    if (checkedInClientIds.has(p.id)) {
      checkedIn.push(name);
    } else {
      missed.push(name);
    }

    // Mirror app status logic so weekly summary matches dashboard/client list.
    const loginRef = p.last_login || p.created_at;
    const checkinRef = p.last_checkin || p.created_at;
    const loginDays = loginRef ? (now - new Date(loginRef).getTime()) / DAY : Infinity;
    const checkinDays = checkinRef ? (now - new Date(checkinRef).getTime()) / DAY : Infinity;
    if (loginDays > 10 || checkinDays > 14) {
      redClients.push(name);
    }
  }

  const planCompletions = (recentCompletions || []).map((c: { title: string }) => c.title);

  try {
    await sendWeeklySummaryEmail(MARC_EMAIL, {
      totalClients: profiles.length,
      checkedIn,
      missed,
      redClients,
      planCompletions,
    });

    return NextResponse.json({ sent: true, clients: profiles.length });
  } catch (e) {
    console.error("[WEEKLY SUMMARY] Email failed:", e);
    return NextResponse.json({ sent: false, error: "Email failed" }, { status: 500 });
  }
}
