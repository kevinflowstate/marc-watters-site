import { adminActor, respond } from "@/lib/ops/http";
import { prepareLessonTransfer } from "@/lib/ops/lesson-upload";

export async function POST(request: Request) {
  const result = await respond(async () => {
    await adminActor();
    return prepareLessonTransfer(await request.json());
  });
  result.headers.set("Cache-Control", "private, no-store");
  return result;
}
