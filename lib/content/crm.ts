import { CBB_LOCATION_ID } from "@/lib/ops/content-pack";
import { verifyGhlContentConnection } from "@/lib/ops/content-scheduling";
import { OpsError } from "@/lib/ops/tasks";
import { env } from "./config";
import type { Platform } from "./types";
export const CRM_API = "https://services.leadconnectorhq.com";
export const postsPath = `/social-media-posting/${CBB_LOCATION_ID}/posts`;
export type CrmPost = {
  _id: string;
  locationId: string;
  status: string;
  summary: string;
  type: string;
  accountId?: string;
  accountIds?: string[];
  displayDate?: string;
  scheduleDate?: string;
  media: { url: string; type: string }[];
};
export type Account = {
  id: string;
  locationId: string;
  platform: Platform;
  name: string;
  active: boolean;
  isExpired: boolean;
  expire?: string;
  expiresOn?: string;
  expireDate?: string;
  expiresAt?: string;
};
export function crmHeaders() {
  const token = env("CBB_GHL_PIT_TOKEN");
  if (!token) throw new OpsError("CRM connection is not configured", 409);
  return {
    Authorization: `Bearer ${token}`,
    Version: "v3",
    "Content-Type": "application/json",
  };
}
export async function crmRead(path: string, body?: object) {
  const response = await fetch(CRM_API + path, {
    method: body ? "POST" : "GET",
    headers: crmHeaders(),
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new OpsError(`CRM read failed (${response.status})`, 502);
  return response.json();
}
/** posts/list is a read-only query despite its HTTP verb. Paginate or fail closed. */
export async function listPosts(
  from: string,
  to: string,
  type = "scheduled",
): Promise<CrmPost[]> {
  const posts: CrmPost[] = [];
  for (let skip = 0; skip < 10000; skip += 100) {
    const result = await crmRead(postsPath + "/list", {
      type,
      fromDate: from,
      toDate: to,
      skip: String(skip),
      limit: "100",
    });
    if (!Array.isArray(result.results?.posts))
      throw new OpsError("CRM post list is incomplete", 502);
    posts.push(...result.results.posts);
    if (result.results.posts.length < 100) return posts;
  }
  throw new OpsError(
    "CRM post list is too large; scheduling needs checking",
    409,
  );
}
export async function accounts(): Promise<Account[]> {
  const verified = await verifyGhlContentConnection();
  return verified.accounts as Account[];
}
export function accountWarnings(items: Account[], now = new Date()) {
  return items.flatMap((a) => {
    const expiry = a.expire ?? a.expiresOn ?? a.expireDate ?? a.expiresAt;
    if (
      !a.active ||
      a.isExpired ||
      (expiry && Date.parse(expiry) <= now.getTime())
    )
      return [`${a.platform}: account needs reconnecting`];
    if (expiry && Date.parse(expiry) - now.getTime() < 14 * 86400000)
      return [`${a.platform}: account expires within 14 days`];
    return [];
  });
}
export function mediaUrl(value: string) {
  const u = new URL(value);
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    u.port ||
    ![
      "files.leadconnectorhq.com",
      "assets.cdn.filesafe.space",
      "storage.googleapis.com",
    ].includes(u.hostname)
  )
    throw new OpsError("The video must use CRM media storage", 409);
  return value;
}
