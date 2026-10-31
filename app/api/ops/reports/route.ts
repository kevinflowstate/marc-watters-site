import { respond } from "@/lib/ops/http";
import { requireOps } from "@/lib/ops/auth";
import { listReports, createReportDraft } from "@/lib/ops/reports";
export async function GET(request: Request) {
  return respond(async () => {
    requireOps(request);
    return { reports: await listReports() };
  });
}
export async function POST(request: Request) {
  return respond(async () => {
    requireOps(request);
    return { report: await createReportDraft() };
  });
}
