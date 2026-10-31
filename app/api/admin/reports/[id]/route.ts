import { respond, adminActor } from "@/lib/ops/http";
import { getReport, updateReport } from "@/lib/ops/reports";
type C = { params: Promise<{ id: string }> };
export async function GET(_r: Request, c: C) {
  return respond(async () => {
    await adminActor();
    return { report: await getReport((await c.params).id) };
  });
}
export async function PATCH(r: Request, c: C) {
  return respond(async () => {
    const actor = await adminActor();
    return updateReport((await c.params).id, await r.json(), actor);
  });
}
