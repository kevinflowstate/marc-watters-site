import { adminActor, respondPrivate } from "@/lib/ops/http";
import { businessCapabilities } from "@/lib/ops/team-identities";
import { businessAttention } from "@/lib/ops/business-attention";
import { callsForPeriod, salesWindow } from "@/lib/ops/sales-calls";
import { getWorkspace } from "@/lib/ops/workspace-feed";

export const dynamic = "force-dynamic";
export function GET() {
  return respondPrivate(async () => {
    const actor = await adminActor();
    const now = new Date();
    const range = salesWindow(null, now.getTime());
    const [workspace, calls] = await Promise.all([
      getWorkspace().catch(() => null),
      callsForPeriod(range.from, range.to).catch(() => null),
    ]);
    return businessAttention(
      workspace,
      calls,
      businessCapabilities(actor).canViewRevenue,
      now,
    );
  });
}
