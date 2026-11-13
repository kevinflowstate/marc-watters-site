import { createHash } from "node:crypto";
import { CBB_LOCATION_ID } from "@/lib/ops/content-pack";
import { createAdminClient } from "@/lib/supabase/admin";
import { OpsError } from "@/lib/ops/tasks";
import { assertSchedulingEnabled, env, schedulingEnabled } from "./config";
import {
  accounts,
  CRM_API,
  crmHeaders,
  crmRead,
  listPosts,
  mediaUrl,
  postsPath,
  type CrmPost,
} from "./crm";
import { syncReviewTask } from "./review-task";
import { londonDate } from "./slots";
import type { Platform, Video, VideoPost } from "./types";
export function videoPayload(
  video: Pick<
    Video,
    "caption" | "media_url" | "mime_type" | "suggested_at" | "schedule_at"
  >,
  platform: Platform,
  accountId: string,
  userId: string,
) {
  return {
    accountIds: [accountId],
    userId,
    status: "scheduled",
    type: platform === "linkedin" ? "post" : "reel",
    summary: video.caption,
    scheduleDate: video.schedule_at ?? video.suggested_at,
    media: [{ url: video.media_url!, type: video.mime_type }],
    ...(platform === "instagram"
      ? { instagramPostDetails: { type: "reel" } }
      : {}),
    ...(platform === "facebook"
      ? { facebookPostDetails: { type: "reel" } }
      : {}),
  };
}
export type Payload = ReturnType<typeof videoPayload>;
export function matchesPost(saved: CrmPost, payload: Payload) {
  const ids = saved.accountIds ?? (saved.accountId ? [saved.accountId] : []);
  return (
    saved.locationId === CBB_LOCATION_ID &&
    saved.status === "scheduled" &&
    saved.type === payload.type &&
    saved.summary === payload.summary &&
    ids.length === 1 &&
    ids[0] === payload.accountIds[0] &&
    Date.parse(saved.displayDate ?? saved.scheduleDate ?? "") ===
      Date.parse(payload.scheduleDate!) &&
    Array.isArray(saved.media) &&
    saved.media.length === 1 &&
    saved.media[0].url === payload.media[0].url &&
    saved.media[0].type === payload.media[0].type
  );
}
type Result = Pick<
  VideoPost,
  "outcome" | "provider_post_id" | "receipt" | "reason"
>;
function receipt(payload: Payload) {
  return {
    provider: "ghl",
    location_id: CBB_LOCATION_ID,
    account_id: payload.accountIds[0],
    status: "scheduled",
    schedule_at: payload.scheduleDate,
    verified_at: new Date().toISOString(),
    payload_hash: createHash("sha256")
      .update(JSON.stringify(payload))
      .digest("hex"),
  };
}
/** Sibling of executeContentPost: one create, strict readback, ambiguous outcomes never retried. Caller persists claim first. */
export async function executeVideoPost(
  payload: Payload,
  request: typeof fetch = fetch,
): Promise<Result> {
  assertSchedulingEnabled();
  let id: string | null = null;
  try {
    const r = await request(CRM_API + postsPath, {
      method: "POST",
      headers: crmHeaders(),
      body: JSON.stringify(payload),
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok)
      return {
        outcome:
          r.status >= 400 &&
          r.status < 500 &&
          ![408, 409, 425, 429].includes(r.status)
            ? "failed"
            : "uncertain",
        provider_post_id: null,
        receipt: null,
        reason: `CRM returned ${r.status}`,
      };
    const data = await r.json();
    id =
      typeof data.results?.post?._id === "string"
        ? data.results.post._id
        : null;
    if (!id) throw new Error("Missing receipt");
    const read = await request(
      CRM_API + postsPath + "/" + encodeURIComponent(id),
      {
        headers: crmHeaders(),
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!read.ok) throw new Error("Readback unavailable");
    const saved = (await read.json()).results?.post;
    if (!saved || saved._id !== id || !matchesPost(saved, payload))
      throw new Error("Readback differs");
    return {
      outcome: "scheduled",
      provider_post_id: id,
      receipt: receipt(payload),
      reason: null,
    };
  } catch {
    return {
      outcome: "uncertain",
      provider_post_id: id,
      receipt: null,
      reason: "Outcome needs reconciliation. Do not retry creation.",
    };
  }
}
export function aggregateStatus(
  outcomes: VideoPost["outcome"][],
  expected: number,
): Video["status"] {
  if (outcomes.length === expected && outcomes.every((o) => o === "scheduled"))
    return "scheduled";
  return "partly_scheduled";
}
export async function loadVideo(id: string): Promise<Video> {
  const r = await createAdminClient()
    .from("content_videos")
    .select("*,content_video_posts(*)")
    .eq("id", id)
    .single();
  if (r.error || !r.data) throw new OpsError("Video not found", 404);
  return r.data as Video;
}
async function finishStatus(id: string) {
  const v = await loadVideo(id);
  const r = await createAdminClient()
    .from("content_videos")
    .update({
      status: aggregateStatus(
        v.content_video_posts.map((p) => p.outcome),
        v.platforms.length,
      ),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (r.error)
    throw new OpsError(
      "Post receipts are saved; refresh to check the video status",
      502,
    );
}
export async function approveVideo(
  id: string,
  actor: string,
  revision: string,
  retry?: Platform,
) {
  assertSchedulingEnabled(); // Before DB claims and all CRM calls.
  const v = await loadVideo(id);
  if (v.updated_at !== revision)
    throw new OpsError("Video changed; refresh before approving", 409);
  if (
    !v.caption.trim() ||
    !v.media_url ||
    !v.suggested_at ||
    !["ready", "partly_scheduled"].includes(v.status)
  )
    throw new OpsError("Video, caption and date are needed", 409);
  if (
    (v.platforms.includes("instagram") &&
      Array.from(v.caption).length > 2200) ||
    (v.platforms.includes("linkedin") && Array.from(v.caption).length > 3000)
  )
    throw new OpsError("Caption exceeds the selected platform limit", 409);
  if (Date.parse(v.suggested_at) < Date.now() + 300000)
    throw new OpsError("Choose a date at least five minutes ahead", 409);
  mediaUrl(v.media_url);
  const destinations = await accounts();
  const accountIds: Record<string, string> = {};
  for (const p of v.platforms) {
    const active = destinations.filter(
      (a) =>
        a.platform === p &&
        a.locationId === CBB_LOCATION_ID &&
        a.active === true &&
        a.isExpired === false &&
        (!a.expire || Date.parse(a.expire) > Date.now()),
    );
    if (active.length !== 1)
      throw new OpsError(
        `${p}: reconnect or resolve multiple accounts before scheduling`,
        409,
      );
    accountIds[p] = active[0].id;
  }
  const date = londonDate(v.suggested_at);
  const remote = await listPosts(
    new Date(Date.parse(v.suggested_at) - 86400000).toISOString(),
    new Date(Date.parse(v.suggested_at) + 86400000).toISOString(),
  );
  const ownIds = new Set(v.content_video_posts.map((p) => p.provider_post_id));
  if (
    remote.some(
      (p) =>
        londonDate(p.displayDate ?? p.scheduleDate!) === date &&
        !ownIds.has(p._id),
    )
  )
    throw new OpsError(
      "Another CRM post now occupies that day. Choose a free date before approving.",
      409,
    );
  assertSchedulingEnabled();
  const db = createAdminClient();
  const claim = await db.rpc("claim_content_video", {
    p_id: id,
    p_revision: revision,
    p_actor: actor,
    p_accounts: accountIds,
    p_retry: retry ?? null,
  });
  if (claim.error)
    throw new OpsError(
      "Video changed or is already claimed. Refresh before approving.",
      409,
    );
  for (const post of (claim.data ?? []) as VideoPost[]) {
    const payload = videoPayload(
      v,
      post.platform,
      post.account_id,
      env("CBB_GHL_USER_ID"),
    );
    const result = await executeVideoPost(payload);
    const saved = await db
      .from("content_video_posts")
      .update(result)
      .eq("id", post.id)
      .eq("outcome", "claimed");
    if (saved.error)
      throw new OpsError(
        "CRM outcome could not be saved. The claim is retained; reconcile before retrying.",
        502,
      );
  }
  await finishStatus(id);
  await syncReviewTask();
  return loadVideo(id);
}
/** Read-only at CRM. No match stays uncertain: absence in a list is not proof a create failed. */
export async function reconcileVideo(id: string) {
  const v = await loadVideo(id);
  if (!v.schedule_at) return v;
  const day = Date.parse(v.schedule_at);
  const remote = await listPosts(
    new Date(day - 86400000).toISOString(),
    new Date(day + 86400000).toISOString(),
    "all",
  );
  for (const p of v.content_video_posts.filter((p) =>
    ["uncertain", "claimed"].includes(p.outcome),
  )) {
    // Leave active attempts alone; a terminated invocation cannot run past five minutes.
    if (
      p.outcome === "claimed" &&
      Date.now() - Date.parse(p.created_at) < 360000
    )
      continue;
    const payload = videoPayload(
      v,
      p.platform,
      p.account_id,
      env("CBB_GHL_USER_ID"),
    );
    let found = remote.filter((x) => matchesPost(x, payload));
    if (p.provider_post_id) {
      const data = await crmRead(
        postsPath + "/" + encodeURIComponent(p.provider_post_id),
      );
      found =
        data.results?.post && matchesPost(data.results.post, payload)
          ? [data.results.post]
          : [];
    }
    const result: Result =
      found.length === 1
        ? {
            outcome: "scheduled",
            provider_post_id: found[0]._id,
            receipt: receipt(payload),
            reason: null,
          }
        : {
            outcome: "uncertain",
            provider_post_id: p.provider_post_id,
            receipt: null,
            reason:
              "No unique matching scheduled post found. Check the CRM; creation remains blocked.",
          };
    const r = await createAdminClient()
      .from("content_video_posts")
      .update(result)
      .eq("id", p.id)
      .eq("outcome", p.outcome);
    if (r.error)
      throw new OpsError("Reconciliation receipt could not be saved", 502);
  }
  await finishStatus(id);
  await syncReviewTask();
  return loadVideo(id);
}
export { schedulingEnabled };
