import { sendPushToUser } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

interface PortalNotificationInput {
  userId: string;
  title: string;
  message: string;
  link?: string;
  dedupeKey?: string;
  pushTitle?: string;
  pushBody?: string;
  pushUrl?: string;
  pushTag?: string;
}

export async function notifyPortalUsers(
  admin: AdminClient,
  notifications: PortalNotificationInput[],
): Promise<{ created: number; duplicates: number; failed: number }> {
  const candidateNotifications = notifications.filter((notification) => notification.userId && notification.title);
  const userIds = [...new Set(candidateNotifications.map((notification) => notification.userId))];
  const { data: activeProfiles } = userIds.length
    ? await admin.from("client_profiles").select("user_id").in("user_id", userIds).is("archived_at", null)
    : { data: [] };
  const activeUserIds = new Set((activeProfiles || []).map((profile) => profile.user_id));
  const validNotifications = candidateNotifications.filter((notification) => activeUserIds.has(notification.userId));
  if (validNotifications.length === 0) return { created: 0, duplicates: 0, failed: 0 };

  const notificationsToPush: PortalNotificationInput[] = [];
  let created = 0;
  let duplicates = 0;
  let failed = 0;
  const regularNotifications = validNotifications.filter((notification) => !notification.dedupeKey);
  const deduplicatedNotifications = validNotifications.filter((notification) => notification.dedupeKey);

  if (regularNotifications.length > 0) {
    const { error } = await admin.from("notifications").insert(
      regularNotifications.map((notification) => ({
        user_id: notification.userId,
        title: notification.title,
        message: notification.message.slice(0, 200),
        link: notification.link ?? null,
      })),
    );
    if (error) {
      console.error("Failed to create portal notification:", error);
      failed += regularNotifications.length;
    } else {
      notificationsToPush.push(...regularNotifications);
      created += regularNotifications.length;
    }
  }

  for (const notification of deduplicatedNotifications) {
    const { error } = await admin.from("notifications").insert({
      user_id: notification.userId,
      title: notification.title,
      message: notification.message.slice(0, 200),
      link: notification.link ?? null,
      dedupe_key: notification.dedupeKey,
    });
    if (!error) {
      notificationsToPush.push(notification);
      created += 1;
    } else if (error.code === "23505") {
      duplicates += 1;
    } else {
      console.error("Failed to create deduplicated portal notification:", error);
      failed += 1;
    }
  }

  await Promise.all(
    notificationsToPush.map(async (notification) => {
      try {
        await sendPushToUser(notification.userId, {
          title: notification.pushTitle ?? notification.title,
          body: (notification.pushBody ?? notification.message).slice(0, 140),
          url: notification.pushUrl ?? notification.link,
          tag: notification.pushTag,
        });
      } catch (pushError) {
        console.error("Failed to send portal push notification:", pushError);
      }
    }),
  );

  return { created, duplicates, failed };
}
