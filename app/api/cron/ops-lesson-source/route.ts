import { respond } from "@/lib/ops/http";
import { requireCron } from "@/lib/ops/auth";
import { advanceLessonSource, lessonOverdue } from "@/lib/ops/lesson-source";
import { reportStepFailure } from "@/lib/ops/job-health";

/** Wednesdays: finds Tuesday's lesson recording in Fathom and gets the video ready for the scheduled lesson job. */
export async function GET(request: Request) {
  const result = await respond(async () => {
    requireCron(request);
    let step;
    try {
      step = await advanceLessonSource();
    } catch (error) {
      await reportStepFailure("lesson-source", error instanceof Error ? error.message : "Unknown error");
      throw error;
    }
    const overdue = await lessonOverdue().catch(() => null);
    return { ...step, overdue };
  });
  result.headers.set("Cache-Control", "private, no-store");
  return result;
}
