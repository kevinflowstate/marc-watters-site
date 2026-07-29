import type { GrowthMilestone } from "@/lib/growth-engine";

export interface GrowthReportSummary {
  id: string;
  workspace_id: string;
  title: string;
  period_start: string | null;
  period_end: string | null;
  status: "draft" | "published";
  published_at: string | null;
  updated_at: string;
}

export interface GrowthAssetSummary {
  id: string;
  workspace_id: string;
  report_id: string | null;
  title: string;
  mime_type: string | null;
  size_bytes: number | null;
  published_at: string | null;
  created_at: string;
}

export interface GrowthAdminWorkspace {
  id: string;
  client_id: string;
  strategy_title: string;
  strategy_summary: string;
  implementation_milestones: GrowthMilestone[];
  updated_at: string;
}

export interface GrowthAdminClient {
  id: string;
  fullName: string;
  businessName: string;
  enabled: boolean;
  workspaceId: string | null;
  workspace: GrowthAdminWorkspace | null;
  reports: GrowthReportSummary[];
  assets: GrowthAssetSummary[];
}

export interface GrowthClientsResponse {
  viewerRole: "admin" | "growth_operator";
  clients: GrowthAdminClient[];
}
