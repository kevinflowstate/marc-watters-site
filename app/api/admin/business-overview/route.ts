import { adminActor, respondPrivate } from "@/lib/ops/http";
import { businessCapabilities } from "@/lib/ops/team-identities";
import { readBusinessOverview, refreshBusinessOverview } from "@/lib/ops/business-overview-snapshot";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function overview(load: typeof readBusinessOverview) {
  return respondPrivate(async () => {
    const capabilities = businessCapabilities(await adminActor());
    const snapshot = await load();
    if (!snapshot) return { capabilities, snapshot: null };
    const { asOf, weekStart, monthStart, operations } = snapshot;
    return {
      capabilities,
      snapshot: {
        asOf, weekStart, monthStart, operations,
        ...(capabilities.canViewRevenue ? { revenue: snapshot.revenue } : {}),
      },
    };
  });
}

export function GET() { return overview(readBusinessOverview); }
export function POST() { return overview(refreshBusinessOverview); }
