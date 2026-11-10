import { respond } from "@/lib/ops/http";
import { requireCron } from "@/lib/ops/auth";
import { importDriveResults } from "@/lib/ops/drive-results";
import { checkScheduledJobs, reportFileProblems, reportStepFailure } from "@/lib/ops/job-health";

/**
 * Collects Codex results that scheduled jobs left in the shared Drive folder (read-only on Drive),
 * then checks the active jobs reported in on time. Failures become tasks in the Flowstate lane.
 */
export async function GET(request: Request) {
  const result = await respond(async () => {
    requireCron(request);
    let imported;
    try {
      imported = await importDriveResults();
    } catch (error) {
      await reportStepFailure("drive-results", error instanceof Error ? error.message : "Unknown error");
      throw error;
    }
    if (imported.problems.length) await reportFileProblems(imported.problems).catch(() => undefined);
    const jobs = imported.configured ? await checkScheduledJobs().catch(() => ({ checked: false, raised: [] })) : null;
    return { ...imported, jobs };
  });
  result.headers.set("Cache-Control", "private, no-store");
  return result;
}
