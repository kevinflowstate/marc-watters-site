import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireGrowthManager } from "@/lib/growth-engine";

const statuses = new Set(["planned", "in_progress", "complete"]);
const owners = new Set(["Flow State", "Client", "Shared"]);

function cleanMilestones(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      id: typeof item.id === "string" && item.id.length <= 80 ? item.id : randomUUID(),
      title: typeof item.title === "string" ? item.title.trim().slice(0, 240) : "",
      owner: typeof item.owner === "string" && owners.has(item.owner) ? item.owner : "Shared",
      status: typeof item.status === "string" && statuses.has(item.status) ? item.status : "planned",
      targetDate: typeof item.targetDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.targetDate)
        ? item.targetDate
        : undefined,
      note: typeof item.note === "string" ? item.note.trim().slice(0, 1200) : undefined,
    }))
    .filter((item) => item.title)
    .slice(0, 40);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const viewer = await requireGrowthManager();
  if (!viewer.authorized) {
    return NextResponse.json({ error: viewer.error }, { status: viewer.status });
  }

  const { clientId } = await params;
  const body = await request.json().catch(() => null);
  const strategyTitle = typeof body?.strategyTitle === "string" ? body.strategyTitle.trim().slice(0, 180) : "";
  const strategySummary = typeof body?.strategySummary === "string" ? body.strategySummary.trim().slice(0, 12000) : "";
  const milestones = cleanMilestones(body?.milestones);
  const now = new Date().toISOString();
  const admin = createAdminClient();

  const { data: entitlement } = await admin.from("client_entitlements")
    .select("status")
    .eq("client_id", clientId)
    .eq("entitlement_key", "cbb_growth_engine")
    .maybeSingle();
  if (entitlement?.status !== "active") {
    return NextResponse.json({ error: "Growth Engine access is not enabled for this client." }, { status: 409 });
  }

  const { data: workspace, error } = await admin.from("cbb_growth_workspaces").upsert({
    client_id: clientId,
    strategy_title: strategyTitle,
    strategy_summary: strategySummary,
    implementation_milestones: milestones,
    created_by: viewer.userId,
    updated_by: viewer.userId,
    updated_at: now,
  }, { onConflict: "client_id" }).select("*").single();

  if (error || !workspace) {
    return NextResponse.json({ error: "The Growth Engine workspace could not be saved." }, { status: 500 });
  }
  return NextResponse.json({ workspace });
}
