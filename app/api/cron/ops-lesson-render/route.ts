import { requireCron } from "@/lib/ops/auth";
import { respond } from "@/lib/ops/http";
import { advanceLessonEdit } from "@/lib/ops/lesson-render";
export const maxDuration = 300;
export async function GET(request: Request) {
  return respond(async () => { requireCron(request); return advanceLessonEdit(); });
}
