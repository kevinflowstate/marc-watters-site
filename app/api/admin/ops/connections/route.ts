import { adminActor, respond } from "@/lib/ops/http";
import { verifyGhlContentConnection } from "@/lib/ops/content-scheduling";
import {
  connectContentDrive,
  verifyContentDriveAccess,
} from "@/lib/ops/drive-connection";
import { ContentPackError } from "@/lib/ops/content-pack";
import { getEnv } from "@/lib/env";
import { portalActionSwitches } from "@/lib/ops/portal-controls";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Account/file reads and Google authentication only; no drafts, posts or messages. */
export async function GET() {
  return respond(async () => {
    await adminActor();
    const [ghl, drive] = await Promise.all([
      verifyGhlContentConnection()
        .then(({ location, user, accounts }) => ({
          connected: true,
          message: "Marc's GHL account is connected",
          location: { id: location.id, name: location.name },
          user: { id: user.id, name: user.name },
          accounts: accounts
            .filter((a) => a.locationId === location.id)
            .map((a) => ({
              id: a.id,
              name: a.name,
              platform: a.platform,
              available:
                a.active === true &&
                a.isExpired === false &&
                a.deleted !== true,
            })),
        }))
        .catch((error) => ({ connected: false, message: safeMessage(error) })),
      connectContentDrive()
        .then(async (connection) => ({
          connected: true,
          message: "The portal can read Marc's shared content",
          source: await verifyContentDriveAccess(connection),
        }))
        .catch((error) => ({ connected: false, message: safeMessage(error) })),
    ]);
    return {
      checked_at: new Date().toISOString(),
      read_only: true,
      ghl,
      drive,
      controls: portalActionSwitches(),
      content_media_configured: Boolean(getEnv("OPS_CONTENT_MEDIA_HOSTS")?.split(",").some((host) => host.trim())),
      actions_enabled: Object.fromEntries(
        [
          "OPS_CONTENT_SCHEDULING_ENABLED",
          "OPS_PAYMENT_REMINDERS_ENABLED",
          "OPS_LESSON_PUBLICATION_ENABLED",
          "OPS_LEGACY_LESSON_PIPELINE_ENABLED",
          "FLOWSTATE_PORTAL_SEND_ENABLED",
          "OPS_NOTIFICATIONS_ENABLED",
          "OPS_REPORT_SEND_ENABLED",
        ].map((key) => [key, getEnv(key) === "true"]),
      ),
    };
  });
}

function safeMessage(error: unknown) {
  return error instanceof ContentPackError
    ? error.message
    : "The connection could not be checked. Please try again";
}
