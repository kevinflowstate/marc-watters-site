export const platforms = ["instagram", "facebook", "linkedin"] as const;
export type Platform = (typeof platforms)[number];
export type VideoStatus =
  | "new"
  | "importing"
  | "ready"
  | "failed"
  | "scheduled"
  | "partly_scheduled"
  | "skipped"
  | "replaced";
export type VideoPost = {
  id: string;
  video_id: string;
  platform: Platform;
  account_id: string;
  outcome: "claimed" | "scheduled" | "failed" | "uncertain";
  provider_post_id: string | null;
  receipt: Record<string, unknown> | null;
  reason: string | null;
  created_at: string;
};
export type Video = {
  id: string;
  drive_file_id: string;
  drive_md5: string | null;
  file_name: string;
  mime_type: string;
  size_bytes: number | null;
  status: VideoStatus;
  failure_reason: string | null;
  media_url: string | null;
  media_file_id: string | null;
  caption: string;
  caption_source: "sidecar" | "manual" | null;
  suggested_at: string | null;
  schedule_at: string | null;
  platforms: Platform[];
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  content_video_posts: VideoPost[];
};
export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  createdTime?: string;
  modifiedTime?: string;
  md5Checksum?: string;
  size?: string;
  parent: string;
  path: string[];
  monthId?: string;
};
