import { respondPrivate, adminActor } from "@/lib/ops/http";
import { getReport, updateReport } from "@/lib/ops/reports";
import { reportForActor } from "@/lib/ops/business-report-access";
import { businessCapabilities } from "@/lib/ops/team-identities";
import { OpsError, record } from "@/lib/ops/tasks";

type C = { params: Promise<{ id: string }> };

export async function GET(_r: Request, c: C) {
  return respondPrivate(async () => {
    const actor = await adminActor();
    const report = await getReport((await c.params).id);
    const capabilities = businessCapabilities(actor);
    const sheetId = capabilities.canViewRevenue && process.env.CBB_WEEKLY_RECONCILIATION_SHEET_ID?.trim();
    return {
      capabilities, report: reportForActor(report, actor),
      reconciliationSheetUrl: sheetId && /^[\w-]+$/.test(sheetId)
        ? 'https://docs.google.com/spreadsheets/d/' + sheetId + '/edit'
        : null,
    };
  });
}
export async function PATCH(r: Request, c: C) {
  return respondPrivate(async () => {
    const actor = await adminActor();
    const body = record(await r.json());
    if (!businessCapabilities(actor).canViewRevenue) {
      const allowed = ["shared_observations_md", "expected_updated_at", "action"];
      if (Object.keys(body).some(key => !allowed.includes(key)) || ("action" in body && body.action !== "refresh"))
        throw new OpsError("Manager access required for the financial report", 403);
    }
    const result = await updateReport((await c.params).id, body, actor);
    return { ...result, report: reportForActor(result.report, actor) };
  });
}
