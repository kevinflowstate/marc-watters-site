import { getEnv } from "@/lib/env";

/** Display the actual switches, even when a separate prerequisite prevents execution. */
export function portalActionSwitches() {
  return {
    content_scheduling: getEnv("OPS_CONTENT_SCHEDULING_ENABLED") === "true",
    lesson_publication: getEnv("OPS_LESSON_PUBLICATION_ENABLED") === "true",
    payment_reminders: getEnv("OPS_PAYMENT_REMINDERS_ENABLED") === "true",
    report_sending: getEnv("OPS_REPORT_SEND_ENABLED") === "true",
    notifications: getEnv("OPS_NOTIFICATIONS_ENABLED") === "true",
    portal_sending: getEnv("FLOWSTATE_PORTAL_SEND_ENABLED") === "true",
    legacy_lesson_pipeline: getEnv("OPS_LEGACY_LESSON_PIPELINE_ENABLED") === "true",
  };
}
