import { requireAdmin } from "@/lib/admin-auth";
import { sendCheckinReply } from "@/lib/checkin-replies";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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

  try {
    await sendCheckinReply({
      checkinId: checkin_id,
      replyText: reply_text,
      senderUserId: user.id,
      overwrite: true,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const status = (error as Error & { status?: number }).status || 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "send_checkin_reply_failed" },
      { status },
    );
  }
}
