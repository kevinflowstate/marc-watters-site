import { respond } from "@/lib/ops/http";
import { requireCron } from "@/lib/ops/auth";
import { importDriveResults } from "@/lib/ops/drive-results";

/** Collects Codex results that scheduled jobs left in the shared Drive folder. Read-only on Drive. */
export async function GET(request: Request) {
  const result = await respond(async () => {
    requireCron(request);
    return importDriveResults();
  });
  result.headers.set("Cache-Control", "private, no-store");
  return result;
}
