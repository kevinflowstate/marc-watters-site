import { getEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import webpush from "web-push";

export async function sendPushToUser(
  userId: string,
  notification: { title: string; body?: string; url?: string; tag?: string }
): Promise<{ sent: number; failed: number }> {
  const vapidPublicKey = getEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY") || getEnv("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = getEnv("VAPID_PRIVATE_KEY");

  if (!vapidPublicKey || !vapidPrivateKey) {
    console.error("Push notification skipped because VAPID keys are not configured.");
    return { sent: 0, failed: 0 };
  }

  webpush.setVapidDetails(
    "mailto:marc@marcwatters.com",
    vapidPublicKey,
    vapidPrivateKey
  );

  const admin = createAdminClient();
  const { data: subscriptions } = await admin
    .from("push_subscriptions")
    .select("endpoint, keys")
    .eq("user_id", userId);

  if (!subscriptions || subscriptions.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const payload = JSON.stringify(notification);
  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys as webpush.PushSubscription["keys"] },
        payload
      )
    )
  );

  // Clean up expired subscriptions
  const expired = results
    .map((r, i) =>
      r.status === "rejected" && (r.reason as { statusCode?: number })?.statusCode === 410
        ? subscriptions[i].endpoint
        : null
    )
    .filter(Boolean);

  if (expired.length > 0) {
    await admin
      .from("push_subscriptions")
      .delete()
      .in("endpoint", expired);
  }

  return {
    sent: results.filter((r) => r.status === "fulfilled").length,
    failed: results.filter((r) => r.status === "rejected").length,
  };
}
