import { respond } from "@/lib/ops/http";
import { opsAccess } from "@/lib/ops/action-access";
import { listReports, createReportDraft } from "@/lib/ops/reports";
export async function GET(request: Request) {
  return respond(async () => {
    opsAccess(request, "reports:read");
    return { reports: await listReports() };
  });
}
export async function POST(request: Request) {
  return respond(async () => {
    opsAccess(request, "reports:write");
    return { report: await createReportDraft() };
  });
}
