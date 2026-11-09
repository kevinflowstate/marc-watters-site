import { respond } from "@/lib/ops/http";
import { OpsError } from "@/lib/ops/tasks";
import { prepareLessonTransfer } from "@/lib/ops/lesson-upload";
import { requireOpsScope } from "@/lib/ops/scoped-auth";

/**
 * Scoped integration entry for the private lesson transfer grant.
 * Issues an upload grant for one content-addressed MP4 only. Readback is
 * deliberately not offered here: integrations never read stored lessons.
 * Verification (which recomputes the SHA-256), approval and publication stay
 * with a signed-in admin.
 */
export async function POST(request: Request) {
  const result = await respond(async () => {
    requireOpsScope(request, "lessons:upload");
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body) || body.action !== "upload")
      throw new OpsError("This connection can only request an upload grant", 403);
    return prepareLessonTransfer(body);
  });
  result.headers.set("Cache-Control", "private, no-store");
  return result;
}
