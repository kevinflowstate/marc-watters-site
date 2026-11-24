import { respondPrivate, adminActor } from "@/lib/ops/http";
import { businessCapabilities } from "@/lib/ops/team-identities";
import { readTeamActivity } from "@/lib/ops/team-activity";
import { OpsError } from "@/lib/ops/tasks";
import { getReport } from "@/lib/ops/reports";

import { weekStart } from "@/lib/ops/task-weeks";

export async function GET(request: Request) {
  return respondPrivate(async () => {
    if (!businessCapabilities(await adminActor()).canViewTeamActivity)
      throw new OpsError("Not found", 404);
    const id = new URL(request.url).searchParams.get("report");
    if (id === null) {
      const now = new Date();
      return readTeamActivity(weekStart(now).toISOString(), now.toISOString());
    }
    const report = await getReport(id);
    const range = report.data?.periods?.current;
    if (!range?.from || !range?.to)
      throw new OpsError("Report period unavailable", 409);
    return readTeamActivity(range.from, range.to);
  });
}
