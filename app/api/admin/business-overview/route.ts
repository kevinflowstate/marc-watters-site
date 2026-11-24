import { adminActor, respondPrivate } from "@/lib/ops/http";
import { operationalOverview } from "@/lib/ops/business-report-access";
import { readDashboardHubdoc } from "@/lib/ops/hubdoc-dashboard";
import { londonDate, weekStart } from "@/lib/ops/task-weeks";
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
        asOf, weekStart, monthStart, operations: operationalOverview(operations),
        ...(capabilities.canViewRevenue ? { revenue: snapshot.revenue } : {}),
      },
    };
  });
}

export function GET() {
  return overview(async () => {
    const now = new Date();
    const [snapshot, latest] = await Promise.all([
      readBusinessOverview(),
      readDashboardHubdoc(now).catch(() => null),
    ]);
    if (!snapshot) return null;
    // Keep same-week evidence on a transient read failure. A prior week's count cannot be reused.
    const cached = snapshot.weekStart === londonDate(weekStart(now)) ? snapshot.operations.hubdoc : null;
    return { ...snapshot, operations: { ...snapshot.operations, hubdoc: latest ?? cached } };
  });
}
export function POST() { return overview(refreshBusinessOverview); }
