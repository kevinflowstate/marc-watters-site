import { adminActor, respondPrivate } from "@/lib/ops/http";
import { getWorkspace } from "@/lib/ops/workspace-feed";
import { workspaceResultForActor } from "@/lib/ops/business-report-access";
export const dynamic = "force-dynamic";
export async function GET() {
  return respondPrivate(async () => {
    const actor = await adminActor();
    const workspace = await getWorkspace();
    return { ...workspace, results: workspace.results.map(row => workspaceResultForActor(row, actor)) };
  });
}
