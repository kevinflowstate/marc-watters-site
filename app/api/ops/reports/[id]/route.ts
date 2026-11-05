import { respond } from "@/lib/ops/http";
import { requireOps } from "@/lib/ops/auth";
import { getReport, submitReportDraft } from "@/lib/ops/reports";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  return respond(async () => {
    requireOps(request);
    return { report: await getReport((await context.params).id) };
  });
}
export async function PATCH(request: Request, context: Context) {
  return respond(async () => {
    requireOps(request);
    return {
      report: await submitReportDraft(
        (await context.params).id,
        await request.json(),
      ),
    };
  });
}
