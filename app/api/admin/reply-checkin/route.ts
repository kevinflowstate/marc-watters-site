import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { sendCheckinReplyEmail } from "@/lib/email-templates";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function summarizeCheckin(checkin: {
  wins?: string | null;
  challenges?: string | null;
  questions?: string | null;
  responses?: Record<string, unknown> | null;
}) {
  const responseSummary =
    checkin.responses && typeof checkin.responses === "object"
      ? Object.values(checkin.responses)
          .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
          .slice(0, 3)
          .join(" ")
      : "";

  const summary =
    responseSummary ||
    checkin.questions ||
    checkin.challenges ||
    checkin.wins ||
    "Open the check-in for the full context.";

  return summary.length > 260 ? `${summary.slice(0, 257)}...` : summary;
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { checkin_id, reply_text } = await request.json();

  if (!checkin_id || !reply_text?.trim()) {
    return NextResponse.json(
      { error: "checkin_id and reply_text are required" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Update the checkin with the reply
  const { error: updateError } = await admin
    .from("checkins")
    .update({
      admin_reply: reply_text.trim(),
      replied_at: new Date().toISOString(),
    })
    .eq("id", checkin_id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Look up the client's email: checkin -> client_profile -> user
  const { data: checkin } = await admin
    .from("checkins")
    .select("client_id, week_number, wins, challenges, questions, responses")
    .eq("id", checkin_id)
    .single<{
      client_id: string;
      week_number: number;
      wins: string | null;
      challenges: string | null;
      questions: string | null;
      responses: Record<string, unknown> | null;
    }>();

  if (!checkin) {
    return NextResponse.json({ error: "Checkin not found" }, { status: 404 });
  }

  const { data: clientProfile } = await admin
    .from("client_profiles")
    .select("user_id")
    .eq("id", checkin.client_id)
    .single();

  let clientEmail = "";
  let clientName = "";

  if (clientProfile) {
    const { data: clientUser } = await admin
      .from("users")
      .select("email, full_name")
      .eq("id", clientProfile.user_id)
      .single();

    if (clientUser) {
      clientEmail = clientUser.email;
      clientName = clientUser.full_name;

      const { error: inboxError } = await admin.from("inbox_messages").insert({
        client_id: checkin.client_id,
        sender_user_id: user.id,
        sender_role: "admin",
        message: reply_text.trim(),
        attachments: [],
        reply_context: {
          type: "checkin",
          title: `Week ${checkin.week_number} check-in`,
          body: summarizeCheckin(checkin),
          href: `/portal/checkins/${checkin_id}`,
        },
        read_by_admin: true,
        read_by_client: false,
      });

      if (inboxError) {
        return NextResponse.json({ error: inboxError.message }, { status: 500 });
      }

      // Insert notification for the client
      await admin.from("notifications").insert({
        user_id: clientProfile.user_id,
        title: `Marc replied to your Week ${checkin.week_number} check-in`,
        message: reply_text.trim().slice(0, 200),
        link: "/portal/inbox",
      });

      // Send email
      try {
        await sendCheckinReplyEmail(clientEmail, clientName, reply_text.trim());
      } catch (emailErr) {
        // Log but don't fail the request - reply is already saved
        console.error("Failed to send reply email:", emailErr);
      }
    }
  }

  return NextResponse.json({ success: true });
}
