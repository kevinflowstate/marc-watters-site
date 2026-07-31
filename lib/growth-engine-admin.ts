import type { GrowthConnection, GrowthMilestone } from "@/lib/growth-engine";

export interface GrowthReportSummary {
  id: string;
  workspace_id: string;
  title: string;
  period_start: string | null;
  period_end: string | null;
  status: "draft" | "published" | "withdrawn";
  published_at: string | null;
  generation_source: string;
  updated_at: string;
}

export interface GrowthAssetSummary {
  id: string;
  workspace_id: string;
  report_id: string | null;
  title: string;
  original_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  published_at: string | null;
  visibility: "client" | "internal";
  availability: "visible" | "on_publish" | "internal";
  created_at: string;
  updated_at: string;
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
  connection: GrowthConnection | null;
}

export interface GrowthAutomationCapabilities {
  reportIntakeConfigured: boolean;
  ghlWebhookConfigured: boolean;
  scheduledDraftsConfigured: boolean;
}

export interface GrowthClientsResponse {
  viewerRole: "admin" | "growth_operator";
  capabilities: GrowthAutomationCapabilities;
  clients: GrowthAdminClient[];
}
