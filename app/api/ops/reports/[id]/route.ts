import { respond } from "@/lib/ops/http";
import { opsAccess } from "@/lib/ops/action-access";
import { getReport, submitReportDraft } from "@/lib/ops/reports";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  return respond(async () => {
    opsAccess(request, "reports:read");
    return { report: await getReport((await context.params).id) };
  });
}
export async function PATCH(request: Request, context: Context) {
  return respond(async () => {
    opsAccess(request, "reports:write");
    return {
      report: await submitReportDraft(
        (await context.params).id,
        await request.json(),
      ),
    };
  });
}
