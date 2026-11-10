import { respond } from "@/lib/ops/http";
import { requireCron } from "@/lib/ops/auth";
import { writePortalSnapshot } from "@/lib/ops/portal-snapshot";

/** Writes the read-only portal picture into Marc's one shared snapshot file for scheduled Codex runs. */
export async function GET(request: Request) {
  const result = await respond(async () => {
    requireCron(request);
    return writePortalSnapshot();
  });
  result.headers.set("Cache-Control", "private, no-store");
  return result;
}
