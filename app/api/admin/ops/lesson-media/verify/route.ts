import { adminActor, respond } from "@/lib/ops/http";
import { verifyStoredLessonMedia } from "@/lib/ops/lesson-publication";
export const maxDuration = 120;
export async function POST(request: Request) {
  return respond(async () => {
    const actor = await adminActor();
    return verifyStoredLessonMedia(await request.json(), actor);
  });
}
