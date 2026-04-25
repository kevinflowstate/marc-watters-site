import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { checkin_id, reply_text } = await request.json().catch(() => ({}));
  const replyText = typeof reply_text === "string" ? reply_text.trim() : "";

  if (!checkin_id || !replyText) {
    return NextResponse.json(
      { error: "checkin_id and reply_text are required" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { data: clientProfile } = await admin
    .from("client_profiles")
    .select("id, business_name")
    .eq("user_id", user.id)
    .single<{ id: string; business_name: string | null }>();

  if (!clientProfile) {
    return NextResponse.json({ error: "Client profile not found" }, { status: 404 });
  }

  const { data: clientUser } = await admin
    .from("users")
    .select("full_name")
    .eq("id", user.id)
    .single<{ full_name: string }>();

  const { data: checkin } = await admin
    .from("checkins")
    .select("id, client_id, week_number")
    .eq("id", checkin_id)
    .eq("client_id", clientProfile.id)
    .single<{ id: string; client_id: string; week_number: number }>();

  if (!checkin) {
    return NextResponse.json({ error: "Check-in not found" }, { status: 404 });
  }

  const repliedAt = new Date().toISOString();
  const { error: updateError } = await admin
    .from("checkins")
    .update({
      client_reply: replyText,
      client_replied_at: repliedAt,
    })
    .eq("id", checkin.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const { data: adminUsers } = await admin
    .from("users")
    .select("id")
    .eq("role", "admin")
    .order("created_at", { ascending: true })
    .returns<Array<{ id: string }>>();

  const clientName =
    clientProfile.business_name ||
    clientUser?.full_name ||
    "A client";
  const title = `${clientName} replied to Week ${checkin.week_number} check-in`;
  const link = `/admin/clients/${clientProfile.id}`;

  const recipientIds = (adminUsers ?? []).map((adminUser) => adminUser.id);
  if (recipientIds.length > 0) {
    await admin.from("notifications").insert(
      recipientIds.map((userId) => ({
        user_id: userId,
        title,
        message: replyText.slice(0, 200),
        link,
      })),
    );

    await Promise.all(
      recipientIds.map(async (userId) => {
        try {
          await sendPushToUser(userId, {
            title,
            body: replyText.slice(0, 140),
            url: link,
            tag: `checkin-client-reply-${checkin.id}`,
          });
        } catch (pushError) {
          console.error("Failed to send check-in reply push notification:", pushError);
        }
      }),
    );
  }

  return NextResponse.json({
    success: true,
    reply: {
      client_reply: replyText,
      client_replied_at: repliedAt,
    },
  });
}
