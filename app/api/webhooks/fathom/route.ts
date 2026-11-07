import { after } from "next/server";
import { respond } from "@/lib/ops/http";
import { verifyFathom } from "@/lib/ops/fathom";
import { receiveRecording, ingest } from "@/lib/ops/lessons";
import { OpsError } from "@/lib/ops/tasks";
import { getEnv } from "@/lib/env";
export async function POST(request: Request) {
  return respond(async () => {
    const raw = await request.text();
    if (!verifyFathom(request.headers, raw))
      throw new OpsError("Unauthorized", 401);
    const lesson = await receiveRecording(JSON.parse(raw));
    if (
      getEnv("OPS_LEGACY_LESSON_PIPELINE_ENABLED") === "true" &&
      getEnv("FATHOM_API_KEY")
    )
      after(async () => {
        try {
          await ingest(lesson.id);
        } catch {
          console.error("Recording ingest pending; retry from review page");
        }
      });
    return { id: lesson.id, status: lesson.status };
  });
}
