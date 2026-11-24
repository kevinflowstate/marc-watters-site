import { respond, adminActor } from "@/lib/ops/http";
import { MARC_USER_ID } from "@/lib/ops/call-outcomes";
import { readTeamActivity } from "@/lib/ops/team-activity";
import { OpsError } from "@/lib/ops/tasks";
import { getReport } from "@/lib/ops/reports";

export async function GET(request: Request) {
  return respond(async () => {
    if (await adminActor() !== MARC_USER_ID) throw new OpsError("Not found",404);
    const report = await getReport(new URL(request.url).searchParams.get("report") || "");
    const range=report.data?.periods?.current;
    if (!range?.from || !range?.to) throw new OpsError("Report period unavailable",409);
    return readTeamActivity(range.from,range.to);
  });
}
