import { respond } from "@/lib/ops/http";
import { prepareLessonTransfer } from "@/lib/ops/lesson-upload";
import { requireOpsScope } from "@/lib/ops/scoped-auth";

/**
 * Scoped integration entry for the private lesson transfer grant.
 * Issues an upload or readback grant for one content-addressed MP4 only.
 * Verification, approval and publication stay with a signed-in admin.
 */
export async function POST(request: Request) {
  const result = await respond(async () => {
    requireOpsScope(request, "lessons:upload");
    return prepareLessonTransfer(await request.json());
  });
  result.headers.set("Cache-Control", "private, no-store");
  return result;
}
