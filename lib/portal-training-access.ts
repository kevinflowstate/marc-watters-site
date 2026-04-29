import { createAdminClient } from "@/lib/supabase/admin";

export const ONBOARDING_MODULE_TITLE = "Welcome & Onboarding";
const GLOBAL_CLIENT_MODULE_TITLE_PATTERNS = ["call replay"];

type AdminClient = ReturnType<typeof createAdminClient>;

export async function getPlanLinkedModuleIds(admin: AdminClient, clientId: string): Promise<Set<string>> {
  const moduleIds = new Set<string>();

  const { data: plans } = await admin
    .from("business_plans")
    .select("id")
    .eq("client_id", clientId)
    .eq("status", "active");

  if (!plans?.length) return moduleIds;

  const { data: phases } = await admin
    .from("business_plan_phases")
    .select("id")
    .in("plan_id", plans.map((plan) => plan.id));

  if (!phases?.length) return moduleIds;

  const { data: links } = await admin
    .from("phase_training_links")
    .select("content_id")
    .in("phase_id", phases.map((phase) => phase.id));

  if (!links?.length) return moduleIds;

  const { data: contentItems } = await admin
    .from("module_content")
    .select("module_id")
    .in("id", [...new Set(links.map((link) => link.content_id))]);

  for (const item of contentItems || []) {
    if (item.module_id) moduleIds.add(item.module_id);
  }

  return moduleIds;
}

export async function getExplicitOnboardingModuleIds(admin: AdminClient, clientId: string): Promise<Set<string>> {
  const moduleIds = new Set<string>();

  const { data: assignedModules } = await admin
    .from("client_modules")
    .select("module_id, module:training_modules(title)")
    .eq("client_id", clientId);

  for (const row of assignedModules || []) {
    const moduleData = Array.isArray(row.module) ? row.module[0] : row.module;
    if (row.module_id && moduleData?.title === ONBOARDING_MODULE_TITLE) {
      moduleIds.add(row.module_id);
    }
  }

  return moduleIds;
}

export async function getGlobalClientModuleIds(admin: AdminClient): Promise<Set<string>> {
  const moduleIds = new Set<string>();

  const { data: modules } = await admin
    .from("training_modules")
    .select("id, title")
    .eq("is_published", true);

  for (const mod of modules || []) {
    const title = typeof mod.title === "string" ? mod.title.toLowerCase() : "";
    if (GLOBAL_CLIENT_MODULE_TITLE_PATTERNS.some((pattern) => title.includes(pattern))) {
      moduleIds.add(mod.id);
    }
  }

  return moduleIds;
}

export async function getAccessibleModuleIds(admin: AdminClient, clientId: string): Promise<Set<string>> {
  const [planLinkedModuleIds, onboardingModuleIds, globalModuleIds] = await Promise.all([
    getPlanLinkedModuleIds(admin, clientId),
    getExplicitOnboardingModuleIds(admin, clientId),
    getGlobalClientModuleIds(admin),
  ]);

  const moduleIds = new Set<string>();
  for (const id of planLinkedModuleIds) moduleIds.add(id);
  for (const id of onboardingModuleIds) moduleIds.add(id);
  for (const id of globalModuleIds) moduleIds.add(id);

  return moduleIds;
}
