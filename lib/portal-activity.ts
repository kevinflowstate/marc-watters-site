/** A submitted check-in is portal activity, even when the home page was bypassed. */
export function lastPortalActivity(
  lastLogin: string | null,
  lastCheckin: string | null,
  createdAt = "",
): string {
  if (!lastLogin) return lastCheckin || createdAt;
  if (!lastCheckin) return lastLogin;
  return new Date(lastCheckin).getTime() > new Date(lastLogin).getTime()
    ? lastCheckin
    : lastLogin;
}

export function portalClientStatus(
  lastLogin: string | null,
  lastCheckin: string | null,
  createdAt: string,
  now = Date.now(),
): "green" | "amber" | "red" {
  const day = 1000 * 60 * 60 * 24;
  const activityAt = lastPortalActivity(lastLogin, lastCheckin, createdAt);
  const checkinAt = lastCheckin || createdAt;
  const activityDays = activityAt ? (now - new Date(activityAt).getTime()) / day : Infinity;
  const checkinDays = checkinAt ? (now - new Date(checkinAt).getTime()) / day : Infinity;

  if (activityDays > 10 || checkinDays > 14) return "red";
  if (checkinDays > 7) return "amber";
  return "green";
}
