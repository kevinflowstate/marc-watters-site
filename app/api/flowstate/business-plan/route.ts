import { savePlan } from "@/lib/admin-data";
import { requireFlowstateAccess } from "@/lib/flowstate/auth";
import { notifyPortalUsers } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BusinessPlan, BusinessPlanItem, BusinessPlanPhase } from "@/lib/types";
import { NextResponse } from "next/server";
import { isClientActive } from "@/lib/client-lifecycle";

type PlanPhaseInput = {
  id?: unknown;
  name?: unknown;
  notes?: unknown;
  items?: unknown;
  linked_trainings?: unknown;
  linkedTrainingIds?: unknown;
};

type PlanItemInput = {
  id?: unknown;
  title?: unknown;
  completed?: unknown;
  completed_at?: unknown;
};

export async function POST(request: Request) {
  const auth = requireFlowstateAccess(request);
  if (auth) return auth;

  if (process.env.FLOWSTATE_PORTAL_PLAN_IMPORT_ENABLED === "false") {
    return NextResponse.json({ ok: false, error: "flowstate_portal_plan_import_disabled" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const clientId = text(body.client_id || body.clientId || body.plan?.client_id || body.plan?.clientId);

  if (!clientId) {
    return NextResponse.json({ ok: false, error: "client_id_required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: client, error: clientError } = await admin
    .from("client_profiles")
    .select("id, user_id")
    .eq("id", clientId)
    .single<{ id: string; user_id: string }>();

  if (clientError || !client) {
    return NextResponse.json({ ok: false, error: "client_not_found" }, { status: 404 });
  }
  if (!(await isClientActive(clientId))) {
    return NextResponse.json({ ok: false, error: "archived_client_read_only" }, { status: 409 });
  }

  const planInput = objectValue(body.plan) || body;
  const existingPlanId = await activePlanIdForClient(admin, clientId);
  const useExistingActivePlan = body.replace_active_plan !== false && body.replaceActivePlan !== false;
  const planId = text(planInput.id || planInput.plan_id || body.plan_id || body.planId) || (useExistingActivePlan ? existingPlanId : "") || crypto.randomUUID();
  const planExists = Boolean(planId === existingPlanId) || await businessPlanExists(admin, planId);
  const summary = text(planInput.summary || body.summary);
  const rawPhases = arrayValue(planInput.phases || body.phases);

  if (!summary) {
    return NextResponse.json({ ok: false, error: "summary_required" }, { status: 400 });
  }

  if (rawPhases.length === 0) {
    return NextResponse.json({ ok: false, error: "phases_required" }, { status: 400 });
  }

  const phases = normalizePhases(rawPhases);
  const linkedTrainingIds = [...new Set(phases.flatMap((phase) => phase.linked_trainings))];
  const validation = await validateLinkedTrainingIds(admin, linkedTrainingIds);
  if (validation.error) {
    return NextResponse.json({ ok: false, error: validation.error, missingTrainingIds: validation.missingTrainingIds }, { status: 400 });
  }

  const plan: BusinessPlan = {
    id: planId,
    client_id: clientId,
    summary,
    status: statusValue(planInput.status || body.status),
    created_at: text(planInput.created_at || body.created_at) || new Date().toISOString(),
    completed_at: text(planInput.completed_at || body.completed_at) || undefined,
    phases,
    discovery_answers: recordValue(planInput.discovery_answers || planInput.discoveryAnswers || body.discovery_answers || body.discoveryAnswers),
    pdf_url: text(planInput.pdf_url || planInput.pdfUrl || body.pdf_url || body.pdfUrl) || undefined,
  };

  const result = await savePlan(plan);
  if (result.error) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  const assignment = body.assign_modules === false || body.assignModules === false
    ? { assigned: 0, skipped: 0 }
    : await assignLinkedModules(admin, clientId, validation.moduleIds);

  if (client.user_id) {
    const created = !planExists;
    const title = created ? "Business plan issued" : "Business plan updated";
    await notifyPortalUsers(admin, [{
      userId: client.user_id,
      title,
      message: created
        ? "Marc has issued your business plan. Open the portal to review it."
        : "Marc has updated your business plan. Open the portal to review the latest version.",
      link: "/portal/plan",
      pushTag: `business-plan-${plan.id}`,
    }]);
  }

  return NextResponse.json({
    ok: true,
    planId: plan.id,
    clientId,
    created: !planExists,
    phases: phases.length,
    linkedTrainings: linkedTrainingIds.length,
    assignedModules: assignment.assigned,
    skippedModules: assignment.skipped,
  });
}

function normalizePhases(rawPhases: unknown[]): BusinessPlanPhase[] {
  return rawPhases.map((rawPhase, index) => {
    const phase = objectValue(rawPhase) as PlanPhaseInput;
    const name = text(phase.name) || `Phase ${index + 1}`;
    const items = arrayValue(phase.items).map((rawItem) => normalizeItem(rawItem, name));
    const linkedTrainings = arrayValue(phase.linked_trainings || phase.linkedTrainingIds)
      .map((id) => text(id))
      .filter(Boolean);

    return {
      id: text(phase.id) || crypto.randomUUID(),
      name,
      notes: text(phase.notes),
      order_index: index,
      items,
      linked_trainings: [...new Set(linkedTrainings)],
    };
  });
}

function normalizeItem(rawItem: unknown, category: string): BusinessPlanItem {
  if (typeof rawItem === "string") {
    return {
      id: crypto.randomUUID(),
      category,
      title: rawItem.trim() || "Untitled action",
      completed: false,
    };
  }

  const item = objectValue(rawItem) as PlanItemInput;
  return {
    id: text(item.id) || crypto.randomUUID(),
    category,
    title: text(item.title) || "Untitled action",
    completed: Boolean(item.completed),
    completed_at: text(item.completed_at) || undefined,
  };
}

async function activePlanIdForClient(admin: ReturnType<typeof createAdminClient>, clientId: string) {
  const { data } = await admin
    .from("business_plans")
    .select("id")
    .eq("client_id", clientId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();

  return data?.id || "";
}

async function businessPlanExists(admin: ReturnType<typeof createAdminClient>, planId: string) {
  if (!planId) return false;

  const { data } = await admin
    .from("business_plans")
    .select("id")
    .eq("id", planId)
    .maybeSingle<{ id: string }>();

  return Boolean(data);
}

async function validateLinkedTrainingIds(admin: ReturnType<typeof createAdminClient>, trainingIds: string[]) {
  if (trainingIds.length === 0) return { moduleIds: [] as string[] };

  const { data, error } = await admin
    .from("module_content")
    .select("id, module_id")
    .in("id", trainingIds);

  if (error) return { error: error.message, moduleIds: [] as string[] };

  const found = new Set((data || []).map((row) => row.id));
  const missingTrainingIds = trainingIds.filter((id) => !found.has(id));
  if (missingTrainingIds.length > 0) {
    return { error: "unknown_training_ids", missingTrainingIds, moduleIds: [] as string[] };
  }

  return {
    moduleIds: [...new Set((data || []).map((row) => row.module_id).filter(Boolean))],
  };
}

async function assignLinkedModules(admin: ReturnType<typeof createAdminClient>, clientId: string, moduleIds: string[]) {
  let assigned = 0;
  let skipped = 0;

  for (const moduleId of moduleIds) {
    const { data: existing } = await admin
      .from("client_modules")
      .select("id")
      .eq("client_id", clientId)
      .eq("module_id", moduleId)
      .maybeSingle<{ id: string }>();

    if (existing) {
      skipped++;
      continue;
    }

    const { error } = await admin.from("client_modules").insert({
      client_id: clientId,
      module_id: moduleId,
      status: "locked",
    });

    if (error) {
      skipped++;
    } else {
      assigned++;
    }
  }

  return { assigned, skipped };
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function recordValue(value: unknown): Record<string, string> | undefined {
  const record = objectValue(value);
  const entries = Object.entries(record)
    .map(([key, val]) => [key, text(val)] as const)
    .filter(([, val]) => val);

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function statusValue(value: unknown): "active" | "completed" {
  return value === "completed" ? "completed" : "active";
}
