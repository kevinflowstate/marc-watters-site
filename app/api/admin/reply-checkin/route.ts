import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { sendCheckinReplyEmail } from "@/lib/resend";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

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
    .select("client_id")
    .eq("id", checkin_id)
    .single();

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

      // Insert notification for the client
      await admin.from("notifications").insert({
        user_id: clientProfile.user_id,
        title: "New reply from Marc",
        message: reply_text.trim().slice(0, 200),
        link: "/portal",
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
