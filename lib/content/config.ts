import { OpsError } from "@/lib/ops/tasks";
export const env = (name: string) => (process.env[name] ?? "").trim();
export const schedulingEnabled = () =>
  env("OPS_CONTENT_SCHEDULING_ENABLED") === "true";
export function assertSchedulingEnabled() {
  if (!schedulingEnabled())
    throw new OpsError("Scheduling is switched off", 409);
}
export function inboxFolder() {
  const id = env("OPS_CONTENT_INBOX_FOLDER_ID");
  if (id && !/^[A-Za-z0-9_-]{10,200}$/.test(id))
    throw new OpsError("The inbox folder ID needs checking", 409);
  return id;
}
export function videoMaxBytes() {
  const mb = Number(env("OPS_CONTENT_VIDEO_MAX_MB") || "500");
  if (!Number.isFinite(mb) || mb <= 0 || mb > 500)
    throw new OpsError("Video size limit must be between 1 and 500 MB", 409);
  return Math.floor(mb * 1_000_000);
}
