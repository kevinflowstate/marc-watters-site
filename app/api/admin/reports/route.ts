import { respond, adminActor } from "@/lib/ops/http";
import { listReports, createReportDraft } from "@/lib/ops/reports";
export async function GET() {
  return respond(async () => {
    await adminActor();
    return { reports: await listReports() };
  });
}
export async function POST() {
  return respond(async () => {
    await adminActor();
    return { report: await createReportDraft() };
  });
}
