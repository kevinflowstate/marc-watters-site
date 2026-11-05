import { createHash } from "node:crypto";
import {
  CBB_LOCATION_ID,
  CBB_LOCATION_NAME,
  CONTENT_MAX_IMAGE_BYTES,
  ContentPackError,
  contentMediaUrl,
  contentPackHash,
  contentResponseBytes,
  validateContentPack,
  type ContentPack,
  type ContentPost,
} from "./content-pack";

const API = "https://services.leadconnectorhq.com";
export type ContentScheduleResult = {
  outcome: "dry_run" | "scheduled" | "failed" | "uncertain";
  post_id: string;
  provider_id?: string;
  reason?: string;
  receipt?: Record<string, unknown>;
};
export type ContentScheduleOptions = {
  /** These are server settings, never values copied from a request body. */
  dryRun?: boolean;
  enabled?: boolean;
  token?: string;
  userId?: string;
  allowedMediaHosts?: string[];
  fetch?: typeof fetch;
  now?: Date;
};

export function contentPostPayload(post: ContentPost, userId: string) {
  return {
    accountIds: [post.account_id],
    userId,
    status: "scheduled",
    type: "post",
    summary: post.caption,
    scheduleDate: post.schedule_at,
    media: post.media.map((m) => ({ url: m.url, type: m.mime_type })),
    ...(post.platform === "facebook"
      ? { facebookPostDetails: { type: "post" } }
      : {}),
    ...(post.platform === "instagram"
      ? { instagramPostDetails: { type: "post" } }
      : {}),
  };
}

export function contentSchedulePreview(
  input: unknown,
  options: { now?: Date } = {},
) {
  const pack = validateContentPack(input, options);
  return {
    dry_run: true,
    manifest_hash: contentPackHash(pack),
    location_id: pack.location_id,
    posts: pack.posts.map((post) => ({
      post_id: post.post_id,
      platform: post.platform,
      account_id: post.account_id,
      schedule_at: post.schedule_at,
      caption: post.caption,
      media_count: post.media.length,
      delivery_checks:
        "Required before execution: allowed host, content-addressed URL and matching media bytes",
    })),
  };
}

function mediaHosts(options: ContentScheduleOptions) {
  const values =
    options.allowedMediaHosts ??
    (process.env.OPS_CONTENT_MEDIA_HOSTS ?? "").split(",");
  return new Set(values.map((v) => v.trim().toLowerCase()).filter(Boolean));
}

async function jsonResponse(r: Response) {
  const value = JSON.parse(
    (await contentResponseBytes(r, 512_000)).toString("utf8"),
  );
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ContentPackError("Provider response is incomplete", 502);
  return value;
}

/** Exactly one create attempt. Root must persist a claim before calling and record this result. */
export async function executeContentPost(
  input: unknown,
  postId: string,
  options: ContentScheduleOptions = {},
): Promise<ContentScheduleResult> {
  const pack: ContentPack = validateContentPack(input, {
    requireFuture: false,
  });
  const post = pack.posts.find((p) => p.post_id === postId);
  if (!post)
    throw new ContentPackError("Post is not in the approved content pack", 404);
  validateContentPack({ ...pack, posts: [post] }, { now: options.now });
  if (options.dryRun !== false)
    return {
      outcome: "dry_run",
      post_id: postId,
      receipt: {
        manifest_hash: contentPackHash(pack),
        location_id: pack.location_id,
        planned: contentPostPayload(post, "SERVER_USER_NOT_VERIFIED"),
      },
    };
  const enabled =
    options.enabled ?? process.env.OPS_CONTENT_SCHEDULING_ENABLED === "true";
  const token = (options.token ?? process.env.CBB_GHL_PIT_TOKEN)?.trim();
  const userId = (options.userId ?? process.env.CBB_GHL_USER_ID)?.trim();
  if (!enabled || !token || !userId)
    return {
      outcome: "failed",
      post_id: postId,
      reason:
        "Content scheduling is disabled or its server connection is incomplete",
    };
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(userId))
    return {
      outcome: "failed",
      post_id: postId,
      reason: "Configured scheduling user is invalid",
    };
  const allowed = mediaHosts(options);
  if (!allowed.size)
    return {
      outcome: "failed",
      post_id: postId,
      reason: "No approved immutable media delivery host is configured",
    };
  const request = options.fetch ?? fetch;
  const headers = {
    Authorization: `Bearer ${token}`,
    Version: "v3",
    "Content-Type": "application/json",
  };
  const path = `/social-media-posting/${CBB_LOCATION_ID}/posts`;
  // Before the POST, failure is definite: this adapter has not attempted creation.
  try {
    for (const media of post.media) {
      const url = contentMediaUrl(media.url);
      if (
        !allowed.has(url.hostname.toLowerCase()) ||
        !url.pathname.split(/[/.]/).includes(media.sha256)
      )
        throw new ContentPackError(
          "Media must use an approved content-addressed delivery URL",
        );
    }
    const locationResponse = await request(
      API + `/locations/${CBB_LOCATION_ID}`,
      {
        headers,
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!locationResponse.ok)
      throw new ContentPackError("CRM location could not be verified");
    const location = (await jsonResponse(locationResponse)).location;
    if (
      location?.id !== CBB_LOCATION_ID ||
      location?.name !== CBB_LOCATION_NAME
    )
      throw new ContentPackError("CRM identity does not match Marc's account");
    const userResponse = await request(
      API + `/users/${encodeURIComponent(userId)}`,
      {
        headers,
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!userResponse.ok)
      throw new ContentPackError("Scheduling user could not be verified");
    const user = await jsonResponse(userResponse);
    if (
      user.id !== userId ||
      !Array.isArray(user.roles?.locationIds) ||
      !user.roles.locationIds.includes(CBB_LOCATION_ID)
    )
      throw new ContentPackError(
        "Scheduling user does not belong to Marc's account",
      );
    const accountResponse = await request(
      API + `/social-media-posting/${CBB_LOCATION_ID}/accounts`,
      {
        headers,
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!accountResponse.ok)
      throw new ContentPackError("Social account could not be verified");
    const accounts = (await jsonResponse(accountResponse)).results?.accounts;
    const account = Array.isArray(accounts)
      ? accounts.find((a) => a.id === post.account_id)
      : null;
    if (
      !account ||
      account.locationId !== CBB_LOCATION_ID ||
      account.platform !== post.platform ||
      account.active !== true ||
      account.isExpired !== false
    )
      throw new ContentPackError(
        "Selected social account is unavailable, expired or belongs to another destination",
      );
    for (const media of post.media) {
      // No provider token, cookies or auth headers go to a media origin. Redirects are refused.
      const r = await request(media.url, {
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
      if (
        !r.ok ||
        r.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
          media.mime_type
      )
        throw new ContentPackError(
          "Media is not publicly readable with the approved MIME type",
        );
      const bytes = await contentResponseBytes(r, CONTENT_MAX_IMAGE_BYTES);
      const png =
        bytes.length >= 24 &&
        bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      const jpeg =
        bytes.length >= 4 &&
        bytes[0] === 255 &&
        bytes[1] === 216 &&
        bytes[2] === 255;
      if (
        (media.mime_type === "image/png" ? !png : !jpeg) ||
        createHash("sha256").update(bytes).digest("hex") !== media.sha256
      )
        throw new ContentPackError(
          "Media bytes no longer match the approved file",
        );
    }
    // Long media reads can consume the lead time; check the selected post again immediately before create.
    validateContentPack(
      { ...pack, posts: [post] },
      { now: options.now ?? new Date() },
    );
  } catch (e) {
    return {
      outcome: "failed",
      post_id: postId,
      reason:
        e instanceof ContentPackError
          ? e.message
          : "Scheduling preflight failed; no post was created",
    };
  }
  let providerId: string | undefined;
  try {
    const response = await request(API + path, {
      method: "POST",
      headers,
      redirect: "error",
      cache: "no-store",
      body: JSON.stringify(contentPostPayload(post, userId)),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok)
      return {
        outcome:
          response.status >= 400 &&
          response.status < 500 &&
          ![408, 409, 425, 429].includes(response.status)
            ? "failed"
            : "uncertain",
        post_id: postId,
        reason: `CRM create returned ${response.status}${response.status >= 500 || [408, 409, 425, 429].includes(response.status) ? "; reconcile before retrying" : ""}`,
      };
    const result = await jsonResponse(response);
    const created = result.results?.post;
    providerId = typeof created?._id === "string" ? created._id : undefined;
    if (!providerId || !/^[A-Za-z0-9_-]{1,200}$/.test(providerId))
      return {
        outcome: "uncertain",
        post_id: postId,
        reason:
          "CRM accepted the create request without a complete post receipt; reconcile before retrying",
      };
    const read = await request(
      API + path + "/" + encodeURIComponent(providerId),
      {
        headers,
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!read.ok)
      throw new ContentPackError("Created post readback is unavailable");
    const saved = (await jsonResponse(read)).results?.post;
    const accountIds =
      saved?.accountIds ?? (saved?.accountId ? [saved.accountId] : []);
    if (
      saved?._id !== providerId ||
      saved.locationId !== CBB_LOCATION_ID ||
      saved.status !== "scheduled" ||
      saved.summary !== post.caption ||
      saved.type !== "post" ||
      !Array.isArray(accountIds) ||
      accountIds.length !== 1 ||
      accountIds[0] !== post.account_id ||
      Date.parse(saved.displayDate ?? saved.scheduleDate) !==
        Date.parse(post.schedule_at) ||
      !Array.isArray(saved.media) ||
      saved.media.length !== post.media.length ||
      saved.media.some(
        (m: { url?: unknown; type?: unknown }, i: number) =>
          m.url !== post.media[i].url || m.type !== post.media[i].mime_type,
      )
    )
      throw new ContentPackError(
        "Created post readback differs from the approved content",
      );
    return {
      outcome: "scheduled",
      post_id: postId,
      provider_id: providerId,
      receipt: {
        provider: "ghl",
        location_id: CBB_LOCATION_ID,
        account_id: post.account_id,
        status: "scheduled",
        requested_at: post.schedule_at,
        verified_at: new Date().toISOString(),
        manifest_hash: contentPackHash(pack),
      },
    };
  } catch {
    return {
      outcome: "uncertain",
      post_id: postId,
      ...(providerId ? { provider_id: providerId } : {}),
      reason:
        "Create outcome or saved post needs reconciliation; do not retry creation",
    };
  }
}
