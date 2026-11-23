import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push";
import { sendCheckinReminderEmail } from "@/lib/email-templates";
import { londonDate, weekStart } from "@/lib/ops/task-weeks";
import { NextResponse } from "next/server";

type Outcome =
  | "accepted"
  | "partial"
  | "unconfirmed"
  | "no_destination"
  | "rejected";
type Channel = "push" | "email";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  const now = new Date();
  const week = londonDate(weekStart(now));
  const today = now
    .toLocaleDateString("en-GB", { weekday: "long", timeZone: "Europe/London" })
    .toLowerCase();
  const config = await admin
    .from("form_config")
    .select("config")
    .eq("form_type", "checkin")
    .single();
  if (config.error || !config.data) {
    return NextResponse.json(
      { error: "Check-in schedule unavailable" },
      { status: 503 },
    );
  }
  const day = config.data.config?.checkin_day;
  if (
    typeof day !== "string" ||
    ![
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ].includes(day)
  ) {
    return NextResponse.json(
      { error: "Check-in day unavailable" },
      { status: 503 },
    );
  }
  if (today !== day)
    return NextResponse.json({
      message: "Not check-in day",
      today,
      checkinDay: day,
    });

  const counts = { pushSent: 0, emailSent: 0, skipped: 0, needsReview: 0 };
  async function attempt(
    clientId: string,
    channel: Channel,
    send: () => Promise<Outcome>,
  ) {
    // Check live eligibility and reserve before each external call. An interrupted call
    // keeps its reservation: without a provider receipt it is unsafe to resend.
    const claim = await admin.rpc("claim_weekly_checkin_reminder", {
      p_client: clientId,
      p_week: week,
      p_channel: channel,
    });
    if (
      claim.error ||
      !["claimed", "already_attempted", "ineligible", "checked_in"].includes(
        claim.data,
      )
    )
      throw new Error("Reminder eligibility unavailable");
    if (claim.data !== "claimed") {
      counts.skipped++;
      return;
    }
    let status: Outcome;
    try {
      status = await send();
    } catch {
      status = "unconfirmed";
    }
    const saved = await admin
      .from("weekly_checkin_reminder_delivery")
      .update({ status, finished_at: new Date().toISOString() })
      .eq("client_id", clientId)
      .eq("week_start", week)
      .eq("channel", channel)
      .eq("status", "claimed");
    if (saved.error) throw new Error("Reminder result unavailable");
    if (status === "accepted" || status === "partial") {
      if (channel === "push") counts.pushSent++;
      else counts.emailSent++;
    }
    if (
      status === "unconfirmed" ||
      status === "partial" ||
      status === "rejected"
    )
      counts.needsReview++;
  }
  try {
    let lastId: string | undefined;
    for (;;) {
      let query = admin
        .from("client_profiles")
        .select(
          "id,user_id,start_date,users!client_profiles_user_id_fkey!inner(full_name,role)",
        )
        .eq("users.role", "client")
        .is("archived_at", null)
        .order("id")
        .limit(100);
      if (lastId) query = query.gt("id", lastId);
      const { data, error } = await query;
      if (error || !data) throw new Error("Client status unavailable");
      for (const profile of data) {
        await attempt(profile.id, "push", async () => {
          const result = await sendPushToUser(profile.user_id, {
            title: "Time for your weekly check-in",
            body: "Take 2 minutes to share your wins, challenges, and questions.",
            url: "/portal/checkin",
            tag: "checkin-reminder",
          });
          if (result.sent) return result.failed ? "partial" : "accepted";
          return result.skipped === "no_subscriptions"
            ? "no_destination"
            : "unconfirmed";
        });
        await attempt(profile.id, "email", async () => {
          const account = await admin.auth.admin.getUserById(profile.user_id);
          if (account.error) return "unconfirmed";
          if (!account.data.user?.email) return "no_destination";
          const user = Array.isArray(profile.users)
            ? profile.users[0]
            : profile.users;
          const weekNumber = profile.start_date
            ? Math.max(
                1,
                Math.ceil(
                  (now.getTime() - Date.parse(profile.start_date)) / 604800000,
                ),
              )
            : 1;
          const result = await sendCheckinReminderEmail(
            account.data.user.email,
            user?.full_name || "there",
            weekNumber,
          );
          return result.error
            ? "rejected"
            : result.data?.id
              ? "accepted"
              : "unconfirmed";
        });
      }
      if (data.length < 100) break;
      lastId = data[data.length - 1].id;
    }
  } catch (e) {
    console.error(
      "Weekly check-in reminder stopped",
      e instanceof Error ? e.message : "Unknown failure",
    );
    return NextResponse.json(
      { error: "Reminder run incomplete", ...counts },
      { status: 503 },
    );
  }
  return NextResponse.json({ message: "Weekly reminders checked", ...counts });
}
