import { respond, adminActor } from "@/lib/ops/http";
import { getReport, updateReport } from "@/lib/ops/reports";
type C = { params: Promise<{ id: string }> };
export async function GET(_r: Request, c: C) {
  return respond(async () => {
    await adminActor();
    const report = await getReport((await c.params).id);
    const sheetId = process.env.CBB_WEEKLY_RECONCILIATION_SHEET_ID?.trim();
    return {
      report,
      reconciliationSheetUrl: sheetId && /^[\w-]+$/.test(sheetId)
        ? `https://docs.google.com/spreadsheets/d/${sheetId}/edit`
        : null,
    };
  });
}
export async function PATCH(r: Request, c: C) {
  return respond(async () => {
    const actor = await adminActor();
    return updateReport((await c.params).id, await r.json(), actor);
  });
}
