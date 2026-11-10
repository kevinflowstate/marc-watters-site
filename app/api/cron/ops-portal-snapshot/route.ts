import { respond } from "@/lib/ops/http";
import { requireCron } from "@/lib/ops/auth";
import { writePortalSnapshot } from "@/lib/ops/portal-snapshot";
import { reportStepFailure } from "@/lib/ops/job-health";

/** Writes the read-only portal picture into Marc's one shared snapshot file for scheduled Codex runs. */
export async function GET(request: Request) {
  const result = await respond(async () => {
    requireCron(request);
    try {
      return await writePortalSnapshot();
    } catch (error) {
      await reportStepFailure("portal-snapshot", error instanceof Error ? error.message : "Unknown error");
      throw error;
    }
  });
  result.headers.set("Cache-Control", "private, no-store");
  return result;
}
