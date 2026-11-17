import { getEnv } from "@/lib/env";

/** Master switch. Off unless OPS_LEAD_DMS_ENABLED is exactly "true": nothing is read, drafted or shown. */
export function leadDmsEnabled() {
  return (getEnv("OPS_LEAD_DMS_ENABLED") || "").toLowerCase() === "true";
}

/**
 * Who sees the Leads tab. OPS_LEAD_DMS_USERS is a comma-separated list of admin user ids while it is being
 * tested (Kevin first, 17 Nov 2026). Empty means every admin.
 */
export function leadDmsAllowed(userId: string) {
  if (!leadDmsEnabled()) return false;
  const list = (getEnv("OPS_LEAD_DMS_USERS") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length === 0 || list.includes(userId);
}

/** Marc's CRM location (Construction Business Blueprint). */
export const LEAD_LOCATION = "93GJEdsr0cT9el3OINXq";
/** "Strategy Call" calendar: the one the public booking page uses. */
export const STRATEGY_CALENDAR = "4SOIodvlfHYmyzKvIAmn";
/** Public booking page a draft may point a lead to. */
export const BOOKING_LINK = "https://constructionbusinessblueprint.co.uk/book-marc";

/** Instagram only allows a reply within 24 hours of the lead's last message. */
export const REPLY_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Wait this long after the lead's last message before drafting (they often send two or three in a row). */
export const DM_DEBOUNCE_MS = 90 * 1000;
/** The CRM app name on messages Marc's AI setter sends. */
export const AI_SETTER_APP = "Appointwise";
