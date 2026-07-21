import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { inactiveClientResponse } from "@/lib/client-lifecycle";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const inactiveResponse = await inactiveClientResponse(user.id);
  if (inactiveResponse) return inactiveResponse;

  const subscription = await request.json();
  const admin = createAdminClient();
  const userAgent =
    typeof subscription.userAgent === "string"
      ? subscription.userAgent.slice(0, 500)
      : request.headers.get("user-agent")?.slice(0, 500) ?? null;
  const platform =
    typeof subscription.platform === "string"
      ? subscription.platform.slice(0, 120)
      : null;

  let { error } = await admin
    .from("push_subscriptions")
    .upsert({
      user_id: user.id,
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      updated_at: new Date().toISOString(),
      user_agent: userAgent,
      platform: platform,
      revoked_at: null,
    }, { onConflict: "user_id,endpoint" });

  if (error?.code === "PGRST204" || error?.code === "42703") {
    const retry = await admin
      .from("push_subscriptions")
      .upsert({
        user_id: user.id,
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
      }, { onConflict: "user_id,endpoint" });
    error = retry.error;
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
