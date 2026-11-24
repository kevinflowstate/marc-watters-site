import { respondPrivate, adminActor } from "@/lib/ops/http";
import { listReports, createReportDraft } from "@/lib/ops/reports";
import { reportForActor, reportHeader } from "@/lib/ops/business-report-access";

export async function GET() {
  return respondPrivate(async () => {
    await adminActor();
    return { reports: (await listReports()).map(reportHeader) };
  });
}
export async function POST() {
  return respondPrivate(async () => {
    const actor = await adminActor();
    return { report: reportForActor(await createReportDraft(), actor) };
  });
}
