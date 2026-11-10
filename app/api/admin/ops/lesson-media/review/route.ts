import { adminActor, respond } from "@/lib/ops/http";
import { startLessonReview } from "@/lib/ops/lesson-review";

/** Admin only: checks the lesson package's stored video, then opens the normal lesson review. */
export const maxDuration = 300;
export async function POST(request: Request) {
  return respond(async () => {
    const actor = await adminActor();
    return startLessonReview(await request.json(), actor);
  });
}
