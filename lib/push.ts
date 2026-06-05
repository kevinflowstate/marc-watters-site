import { getEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createHash } from "crypto";
import webpush from "web-push";

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  keys: webpush.PushSubscription["keys"];
};

function endpointHash(endpoint: string) {
  return createHash("sha256").update(endpoint).digest("hex");
}

function errorStatus(reason: unknown) {
  return typeof reason === "object" && reason !== null && "statusCode" in reason
    ? Number((reason as { statusCode?: number }).statusCode) || null
    : null;
}

function sanitizeErrorMessage(reason: unknown) {
  const raw =
    typeof reason === "object" && reason !== null && "message" in reason
      ? String((reason as { message?: string }).message || "")
      : String(reason || "");

  return raw
    .replace(/https?:\/\/\S+/g, "[url]")
    .replace(/[A-Za-z0-9_-]{24,}/g, "[token]")
    .slice(0, 300);
}

export async function sendPushToUser(
  userId: string,
  notification: { title: string; body?: string; url?: string; tag?: string }
): Promise<{ sent: number; failed: number }> {
  const admin = createAdminClient();
  const vapidPublicKey = getEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY") || getEnv("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = getEnv("VAPID_PRIVATE_KEY");

  if (!vapidPublicKey || !vapidPrivateKey) {
    console.error("Push notification skipped because VAPID keys are not configured.");
    await admin.from("push_notification_attempts").insert({
      user_id: userId,
      notification_type: "portal_push",
      notification_tag: notification.tag ?? null,
      status: "skipped",
      error_message: "VAPID keys are not configured",
    });
    return { sent: 0, failed: 0 };
  }

  webpush.setVapidDetails(
    "mailto:marc@marcwatters.com",
    vapidPublicKey,
    vapidPrivateKey
  );

  const { data: subscriptions } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, keys")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .returns<PushSubscriptionRow[]>();

  if (!subscriptions || subscriptions.length === 0) {
    await admin.from("push_notification_attempts").insert({
      user_id: userId,
      notification_type: "portal_push",
      notification_tag: notification.tag ?? null,
      status: "skipped",
      error_message: "No active push subscriptions",
    });
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

  const now = new Date().toISOString();
  const attempts = results.map((result, index) => {
    const sub = subscriptions[index];
    const status = result.status === "fulfilled" ? "success" : "failure";
    const statusCode = result.status === "rejected" ? errorStatus(result.reason) : null;

    return {
      user_id: userId,
      subscription_id: sub.id,
      endpoint_hash: endpointHash(sub.endpoint),
      notification_type: "portal_push",
      notification_tag: notification.tag ?? null,
      status,
      error_status: statusCode,
      error_message: result.status === "rejected" ? sanitizeErrorMessage(result.reason) : null,
    };
  });

  const { error: attemptError } = await admin.from("push_notification_attempts").insert(attempts);
  if (attemptError) {
    console.error("Failed to record push notification attempts:", attemptError.message);
  }

  await Promise.allSettled(
    results.map((result, index) => {
      const sub = subscriptions[index];
      if (result.status === "fulfilled") {
        return admin
          .from("push_subscriptions")
          .update({
            updated_at: now,
            last_success_at: now,
            last_error_status: null,
            failure_count: 0,
          })
          .eq("id", sub.id);
      }

      return admin
        .from("push_subscriptions")
        .select("failure_count")
        .eq("id", sub.id)
        .single<{ failure_count: number | null }>()
        .then(async ({ data }) => {
          await admin
            .from("push_subscriptions")
            .update({
              updated_at: now,
              last_failure_at: now,
              last_error_status: errorStatus(result.reason),
              failure_count: (data?.failure_count ?? 0) + 1,
            })
            .eq("id", sub.id);
        });
    }),
  );

  // Clean up invalid subscriptions.
  const expired = results
    .map((r, i) => {
      const statusCode = r.status === "rejected" ? errorStatus(r.reason) : null;
      return statusCode === 404 || statusCode === 410 ? subscriptions[i].endpoint : null;
    })
    .filter((endpoint): endpoint is string => Boolean(endpoint));

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
