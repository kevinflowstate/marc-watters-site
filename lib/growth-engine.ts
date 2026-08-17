import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
export { cleanReportInput, normalizeGrowthMetrics } from "@/lib/growth-engine-input";

export const CBB_GROWTH_ENGINE_KEY = "cbb_growth_engine";

export type GrowthManagerRole = "admin" | "growth_operator";
export type GrowthReportStatus = "draft" | "published" | "withdrawn";

export interface GrowthMetric {
  label: string;
  value: string;
  change?: string;
  context?: string;
}

export interface GrowthReport {
  id: string;
  workspace_id: string;
  title: string;
  period_start: string | null;
  period_end: string | null;
  executive_summary: string;
  strategic_takeaway: string;
  progress_update: string;
  next_priorities: string;
  metrics: GrowthMetric[];
  status: GrowthReportStatus;
  published_at: string | null;
  notification_sent_at?: string | null;
  generation_key?: string | null;
  generation_source?: string;
  withdrawn_at?: string | null;
  withdrawal_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface GrowthWorkspace {
  id: string;
  client_id: string;
  strategy_title: string;
  strategy_summary: string;
  implementation_milestones: GrowthMilestone[];
  created_at: string;
  updated_at: string;
}

export type GrowthMilestoneStatus = "planned" | "in_progress" | "complete";

export interface GrowthMilestone {
  id: string;
  title: string;
  owner: "Flow State" | "Client" | "Shared";
  status: GrowthMilestoneStatus;
  targetDate?: string;
  note?: string;
}

export interface GrowthAsset {
  id: string;
  workspace_id: string;
  report_id: string | null;
  title: string;
  original_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  published_at: string | null;
  created_at: string;
}

export interface GrowthConnection {
  client_id: string;
  ghl_location_id: string | null;
  ghl_calendar_ids: string[];
  timezone: string;
  automation_enabled: boolean;
  report_day: number;
  last_event_at: string | null;
  last_draft_at: string | null;
}

export type GrowthSalesOutcomeStatus = "won" | "lost" | "follow_up" | "no_show";

export interface GrowthAppointment {
  id: string;
  client_id: string;
  ghl_event_id: string;
  ghl_contact_id: string | null;
  contact_name: string | null;
  appointment_status: string;
  starts_at: string | null;
  ends_at: string | null;
  source: string | null;
  outcome: {
    id: string;
    outcome: GrowthSalesOutcomeStatus;
    sale_value: number;
    notes: string | null;
    updated_at: string;
  } | null;
}

export type GrowthManagerResult =
  | { authorized: true; userId: string; role: GrowthManagerRole }
  | { authorized: false; status: number; error: string };

export async function requireGrowthManager(): Promise<GrowthManagerResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { authorized: false, status: 401, error: "Not authenticated" };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin" && profile?.role !== "growth_operator") {
    return { authorized: false, status: 403, error: "Not authorized" };
  }

  return { authorized: true, userId: user.id, role: profile.role };
}

export async function getClientGrowthAccess(userId: string): Promise<{
  activeClient: boolean;
  entitled: boolean;
  clientId?: string;
  userId?: string;
}> {
  const admin = createAdminClient();
  const { data: client } = await admin
    .from("client_profiles")
    .select("id, user_id, archived_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (!client || client.archived_at) {
    return { activeClient: false, entitled: false };
  }

  const { data: entitlement } = await admin
    .from("client_entitlements")
    .select("status")
    .eq("client_id", client.id)
    .eq("entitlement_key", CBB_GROWTH_ENGINE_KEY)
    .maybeSingle();

  return {
    activeClient: true,
    entitled: entitlement?.status === "active",
    clientId: client.id,
    userId: client.user_id,
  };
}
