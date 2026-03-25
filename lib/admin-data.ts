import { createAdminClient } from "@/lib/supabase/admin";
import type {
  TrafficLight,
  BusinessPlan,
  BusinessPlanPhase,
  BusinessPlanItem,
  CheckIn,
  TrainingModule,
  ModuleContent,
} from "./types";

// ============================================
// Types for admin data layer
// ============================================

export interface AdminClient {
  id: string;         // client_profiles.id
  user_id: string;
  name: string;
  email: string;
  phone: string;
  business_name: string;
  business_type: string;
  goals: string;
  start_date: string;
  status: TrafficLight;
  current_week: number;
  last_login: string;
  last_checkin: string;
  checkins: CheckIn[];
  business_plan: BusinessPlan[];
  internal_notes?: string;
}

// ============================================
// Status calculation
// ============================================

function computeStatus(lastLogin: string | null, lastCheckin: string | null, createdAt: string): TrafficLight {
  const now = Date.now();
  const DAY = 1000 * 60 * 60 * 24;

  // Use created_at as fallback for last_login (new clients who haven't had login tracked yet)
  const loginRef = lastLogin || createdAt;
  const loginDays = loginRef ? (now - new Date(loginRef).getTime()) / DAY : Infinity;
  const checkinDays = lastCheckin ? (now - new Date(lastCheckin).getTime()) / DAY : Infinity;

  if (loginDays > 10 || checkinDays > 14) return "red";
  if (checkinDays > 7) return "amber";
  return "green";
}

function computeCurrentWeek(startDate: string): number {
  const now = Date.now();
  const start = new Date(startDate).getTime();
  return Math.max(1, Math.ceil((now - start) / (7 * 24 * 60 * 60 * 1000)));
}

// ============================================
// Fetch all clients (for dashboard / client list)
// ============================================

export async function getClients(): Promise<AdminClient[]> {
  const admin = createAdminClient();

  // Fetch client profiles joined with user
  const { data: profiles, error } = await admin
    .from("client_profiles")
    .select(`
      id, user_id, phone, business_name, business_type, goals,
      start_date, last_login, last_checkin, created_at,
      user:users!client_profiles_user_id_fkey(email, full_name)
    `)
    .order("created_at", { ascending: true });

  if (error || !profiles) return [];

  // Fetch all checkins
  const { data: allCheckins } = await admin
    .from("checkins")
    .select("*")
    .order("created_at", { ascending: false });

  // Fetch all business plans with phases + items + training links
  const { data: plans } = await admin
    .from("business_plans")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: phases } = await admin
    .from("business_plan_phases")
    .select("*")
    .order("order_index", { ascending: true });

  const { data: items } = await admin
    .from("business_plan_items")
    .select("*")
    .order("order_index", { ascending: true });

  const { data: links } = await admin
    .from("phase_training_links")
    .select("phase_id, content_id");

  // Build lookup maps
  const checkinsByClient = new Map<string, CheckIn[]>();
  for (const ck of allCheckins || []) {
    const list = checkinsByClient.get(ck.client_id) || [];
    list.push(ck);
    checkinsByClient.set(ck.client_id, list);
  }

  const itemsByPhase = new Map<string, BusinessPlanItem[]>();
  for (const item of items || []) {
    const list = itemsByPhase.get(item.phase_id) || [];
    list.push({
      id: item.id,
      category: "",
      title: item.title,
      completed: item.completed,
      completed_at: item.completed_at,
    });
    itemsByPhase.set(item.phase_id, list);
  }

  const linksByPhase = new Map<string, string[]>();
  for (const link of links || []) {
    const list = linksByPhase.get(link.phase_id) || [];
    list.push(link.content_id);
    linksByPhase.set(link.phase_id, list);
  }

  const phasesByPlan = new Map<string, BusinessPlanPhase[]>();
  for (const phase of phases || []) {
    const list = phasesByPlan.get(phase.plan_id) || [];
    list.push({
      id: phase.id,
      name: phase.name,
      notes: phase.notes,
      order_index: phase.order_index,
      items: itemsByPhase.get(phase.id) || [],
      linked_trainings: linksByPhase.get(phase.id) || [],
    });
    phasesByPlan.set(phase.plan_id, list);
  }

  const plansByClient = new Map<string, BusinessPlan[]>();
  for (const plan of plans || []) {
    const list = plansByClient.get(plan.client_id) || [];
    list.push({
      id: plan.id,
      client_id: plan.client_id,
      summary: plan.summary,
      status: plan.status,
      created_at: plan.created_at,
      completed_at: plan.completed_at,
      phases: phasesByPlan.get(plan.id) || [],
      discovery_answers: plan.discovery_answers || undefined,
    });
    plansByClient.set(plan.client_id, list);
  }

  // Assemble clients
  const clients: AdminClient[] = profiles.map((p) => {
    const user = Array.isArray(p.user) ? p.user[0] : p.user;
    return {
      id: p.id,
      user_id: p.user_id,
      name: user?.full_name || "Unknown",
      email: user?.email || "",
      phone: p.phone || "",
      business_name: p.business_name || "",
      business_type: p.business_type || "",
      goals: p.goals || "",
      start_date: p.start_date,
      status: computeStatus(p.last_login, p.last_checkin, p.created_at),
      current_week: computeCurrentWeek(p.start_date),
      last_login: p.last_login || p.created_at,
      last_checkin: p.last_checkin || p.created_at,
      checkins: checkinsByClient.get(p.id) || [],
      business_plan: plansByClient.get(p.id) || [],
    };
  });

  // Sort by priority: red first, then amber, then green
  const priority: Record<TrafficLight, number> = { red: 0, amber: 1, green: 2 };
  clients.sort((a, b) => priority[a.status] - priority[b.status]);

  return clients;
}

// ============================================
// Fetch single client by ID
// ============================================

export async function getClientById(id: string): Promise<AdminClient | null> {
  const admin = createAdminClient();

  const { data: p, error } = await admin
    .from("client_profiles")
    .select(`
      id, user_id, phone, business_name, business_type, goals,
      start_date, last_login, last_checkin, created_at,
      user:users!client_profiles_user_id_fkey(email, full_name)
    `)
    .eq("id", id)
    .single();

  if (error || !p) return null;

  // Checkins
  const { data: checkins } = await admin
    .from("checkins")
    .select("*")
    .eq("client_id", id)
    .order("created_at", { ascending: false });

  // Business plans
  const { data: plans } = await admin
    .from("business_plans")
    .select("*")
    .eq("client_id", id)
    .order("created_at", { ascending: false });

  const planIds = (plans || []).map((pl) => pl.id);

  const { data: phases } = planIds.length
    ? await admin
        .from("business_plan_phases")
        .select("*")
        .in("plan_id", planIds)
        .order("order_index", { ascending: true })
    : { data: [] };

  const phaseIds = (phases || []).map((ph) => ph.id);

  const { data: items } = phaseIds.length
    ? await admin
        .from("business_plan_items")
        .select("*")
        .in("phase_id", phaseIds)
        .order("order_index", { ascending: true })
    : { data: [] };

  const { data: links } = phaseIds.length
    ? await admin
        .from("phase_training_links")
        .select("phase_id, content_id")
        .in("phase_id", phaseIds)
    : { data: [] };

  // Internal notes
  const { data: notes } = await admin
    .from("internal_notes")
    .select("content")
    .eq("client_id", id)
    .single();

  // Build nested structures
  const itemsByPhase = new Map<string, BusinessPlanItem[]>();
  for (const item of items || []) {
    const list = itemsByPhase.get(item.phase_id) || [];
    list.push({
      id: item.id,
      category: "",
      title: item.title,
      completed: item.completed,
      completed_at: item.completed_at,
    });
    itemsByPhase.set(item.phase_id, list);
  }

  const linksByPhase = new Map<string, string[]>();
  for (const link of links || []) {
    const list = linksByPhase.get(link.phase_id) || [];
    list.push(link.content_id);
    linksByPhase.set(link.phase_id, list);
  }

  const phasesByPlan = new Map<string, BusinessPlanPhase[]>();
  for (const phase of phases || []) {
    const list = phasesByPlan.get(phase.plan_id) || [];
    list.push({
      id: phase.id,
      name: phase.name,
      notes: phase.notes,
      order_index: phase.order_index,
      items: itemsByPhase.get(phase.id) || [],
      linked_trainings: linksByPhase.get(phase.id) || [],
    });
    phasesByPlan.set(phase.plan_id, list);
  }

  const businessPlans: BusinessPlan[] = (plans || []).map((plan) => ({
    id: plan.id,
    client_id: plan.client_id,
    summary: plan.summary,
    status: plan.status,
    created_at: plan.created_at,
    completed_at: plan.completed_at,
    phases: phasesByPlan.get(plan.id) || [],
    discovery_answers: plan.discovery_answers || undefined,
  }));

  const user = Array.isArray(p.user) ? p.user[0] : p.user;

  return {
    id: p.id,
    user_id: p.user_id,
    name: user?.full_name || "Unknown",
    email: user?.email || "",
    phone: p.phone || "",
    business_name: p.business_name || "",
    business_type: p.business_type || "",
    goals: p.goals || "",
    start_date: p.start_date,
    status: computeStatus(p.last_login, p.last_checkin, p.created_at),
    current_week: computeCurrentWeek(p.start_date),
    last_login: p.last_login || p.created_at,
    last_checkin: p.last_checkin || p.created_at,
    checkins: checkins || [],
    business_plan: businessPlans,
    internal_notes: notes?.content || "",
  };
}

// ============================================
// Recent check-ins (for dashboard)
// ============================================

export async function getRecentCheckins() {
  const admin = createAdminClient();

  const { data: checkins } = await admin
    .from("checkins")
    .select(`
      *,
      client:client_profiles!checkins_client_id_fkey(
        id, business_name,
        user:users!client_profiles_user_id_fkey(full_name)
      )
    `)
    .order("created_at", { ascending: false })
    .limit(50);

  return (checkins || []).map((ck) => {
    const client = Array.isArray(ck.client) ? ck.client[0] : ck.client;
    const user = client?.user;
    const userName = Array.isArray(user) ? user[0]?.full_name : user?.full_name;
    return {
      ...ck,
      client_name: userName || "Unknown",
      client_business: client?.business_name || "",
      client_status: "green" as TrafficLight, // Not critical for check-in display
    };
  });
}

// ============================================
// Save business plan (create or update)
// ============================================

export async function savePlan(plan: BusinessPlan): Promise<{ error?: string }> {
  const admin = createAdminClient();

  // Upsert the plan
  const { error: planError } = await admin
    .from("business_plans")
    .upsert({
      id: plan.id,
      client_id: plan.client_id,
      summary: plan.summary,
      status: plan.status,
      created_at: plan.created_at,
      completed_at: plan.completed_at || null,
      discovery_answers: plan.discovery_answers || null,
    });

  if (planError) return { error: planError.message };

  // Delete existing phases for this plan (cascade deletes items + links)
  await admin
    .from("business_plan_phases")
    .delete()
    .eq("plan_id", plan.id);

  // Insert phases
  for (const phase of plan.phases) {
    const { data: insertedPhase, error: phaseError } = await admin
      .from("business_plan_phases")
      .insert({
        id: phase.id,
        plan_id: plan.id,
        name: phase.name,
        notes: phase.notes,
        order_index: phase.order_index,
      })
      .select("id")
      .single();

    if (phaseError) return { error: phaseError.message };

    const phaseId = insertedPhase.id;

    // Insert items
    if (phase.items.length > 0) {
      const { error: itemsError } = await admin
        .from("business_plan_items")
        .insert(
          phase.items.map((item, idx) => ({
            id: item.id,
            phase_id: phaseId,
            title: item.title,
            completed: item.completed,
            completed_at: item.completed_at || null,
            order_index: idx,
          }))
        );
      if (itemsError) return { error: itemsError.message };
    }

    // Insert training links
    if (phase.linked_trainings.length > 0) {
      const { error: linksError } = await admin
        .from("phase_training_links")
        .insert(
          phase.linked_trainings.map((contentId) => ({
            phase_id: phaseId,
            content_id: contentId,
          }))
        );
      if (linksError) return { error: linksError.message };
    }
  }

  return {};
}

// ============================================
// Mark active plan as completed
// ============================================

export async function completePlan(planId: string): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("business_plans")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", planId);
  return error ? { error: error.message } : {};
}

// ============================================
// Toggle plan item completion
// ============================================

export async function togglePlanItem(itemId: string): Promise<{ error?: string }> {
  const admin = createAdminClient();

  // Get current state
  const { data: item, error: fetchError } = await admin
    .from("business_plan_items")
    .select("completed")
    .eq("id", itemId)
    .single();

  if (fetchError || !item) return { error: fetchError?.message || "Item not found" };

  const newCompleted = !item.completed;
  const { error } = await admin
    .from("business_plan_items")
    .update({
      completed: newCompleted,
      completed_at: newCompleted ? new Date().toISOString() : null,
    })
    .eq("id", itemId);

  return error ? { error: error.message } : {};
}

// ============================================
// Internal notes
// ============================================

export async function getInternalNotes(clientId: string): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("internal_notes")
    .select("content")
    .eq("client_id", clientId)
    .single();
  return data?.content || "";
}

export async function saveInternalNotes(clientId: string, content: string): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("internal_notes")
    .upsert(
      { client_id: clientId, content, updated_at: new Date().toISOString() },
      { onConflict: "client_id" }
    );
  return error ? { error: error.message } : {};
}

// ============================================
// Training modules (for admin training pages)
// ============================================

export async function getTrainingModules(): Promise<TrainingModule[]> {
  const admin = createAdminClient();

  const { data: modules } = await admin
    .from("training_modules")
    .select("*")
    .order("order_index", { ascending: true });

  const { data: content } = await admin
    .from("module_content")
    .select("*")
    .order("order_index", { ascending: true });

  const contentByModule = new Map<string, ModuleContent[]>();
  for (const c of content || []) {
    const list = contentByModule.get(c.module_id) || [];
    list.push({
      id: c.id,
      module_id: c.module_id,
      title: c.title,
      content_type: c.content_type,
      content_url: c.content_url,
      content_text: c.content_text,
      order_index: c.order_index,
      duration_minutes: c.duration_minutes,
      created_at: c.created_at,
    });
    contentByModule.set(c.module_id, list);
  }

  return (modules || []).map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    order_index: m.order_index,
    thumbnail_url: m.thumbnail_url,
    is_published: m.is_published,
    created_at: m.created_at,
    content: contentByModule.get(m.id) || [],
  }));
}

export async function getTrainingModuleById(id: string): Promise<TrainingModule | null> {
  const admin = createAdminClient();

  const { data: m, error } = await admin
    .from("training_modules")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !m) return null;

  const { data: content } = await admin
    .from("module_content")
    .select("*")
    .eq("module_id", id)
    .order("order_index", { ascending: true });

  return {
    id: m.id,
    title: m.title,
    description: m.description,
    order_index: m.order_index,
    thumbnail_url: m.thumbnail_url,
    is_published: m.is_published,
    created_at: m.created_at,
    content: (content || []).map((c) => ({
      id: c.id,
      module_id: c.module_id,
      title: c.title,
      content_type: c.content_type,
      content_url: c.content_url,
      content_text: c.content_text,
      order_index: c.order_index,
      duration_minutes: c.duration_minutes,
      created_at: c.created_at,
    })),
  };
}
