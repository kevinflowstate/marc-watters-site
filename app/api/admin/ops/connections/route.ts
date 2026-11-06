import { adminActor, respond } from "@/lib/ops/http";
import { verifyGhlContentConnection } from "@/lib/ops/content-scheduling";
import {
  connectContentDrive,
  verifyContentDriveAccess,
} from "@/lib/ops/drive-connection";
import { ContentPackError } from "@/lib/ops/content-pack";

export const dynamic = "force-dynamic";

/** Account/folder reads and Google authentication only; no drafts, posts or messages. */
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
      actions_enabled: Object.fromEntries(
        [
          "OPS_CONTENT_SCHEDULING_ENABLED",
          "OPS_PAYMENT_REMINDERS_ENABLED",
          "OPS_LESSON_PUBLICATION_ENABLED",
          "OPS_LEGACY_LESSON_PIPELINE_ENABLED",
          "FLOWSTATE_PORTAL_SEND_ENABLED",
          "OPS_NOTIFICATIONS_ENABLED",
          "OPS_REPORT_SEND_ENABLED",
        ].map((key) => [key, process.env[key] === "true"]),
      ),
    };
  });
}

function safeMessage(error: unknown) {
  return error instanceof ContentPackError
    ? error.message
    : "The connection could not be checked. Please try again";
}
