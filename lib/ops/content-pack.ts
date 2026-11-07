import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { z } from "zod";

export const CBB_LOCATION_ID = "93GJEdsr0cT9el3OINXq";
export const CBB_LOCATION_NAME = "MRW Management LTD";
export const CONTENT_MIN_LEAD_MS = 5 * 60_000;
export const CONTENT_MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const mediaSchema = z
  .object({
    asset_id: identifier,
    sha256: hash,
    url: z.string().max(2048),
    mime_type: z.enum(["image/png", "image/jpeg"]),
  })
  .strict();
const postSchema = z
  .object({
    post_id: identifier,
    platform: z.enum(["facebook", "instagram", "linkedin"]),
    account_id: identifier,
    caption: z.string().min(1).max(3000),
    schedule_at: z.string().max(40),
    media: z.array(mediaSchema).min(1).max(10),
  })
  .strict();
const packSchema = z
  .object({
    schema_version: z.literal(1),
    pack_id: identifier,
    version: z.number().int().min(1).max(1_000_000),
    timezone: z.literal("Europe/London"),
    location_id: z.literal(CBB_LOCATION_ID),
    source: z
      .object({
        provider: z.enum(["google_drive", "upload"]),
        id: identifier,
        revision: identifier,
      })
      .strict(),
    posts: z.array(postSchema).min(1).max(50),
  })
  .strict();
export type ContentPack = z.infer<typeof packSchema>;
export type ContentPost = ContentPack["posts"][number];
export type ContentMedia = ContentPost["media"][number];
export class ContentPackError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

/** Syntactic guard; execution additionally requires an administrator-owned host allowlist. */
export function contentMediaUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ContentPackError("Media needs an HTTPS delivery URL");
  }
  const host = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    isIP(host.replace(/^\[|\]$/g, "")) ||
    !host.includes(".") ||
    /(^|\.)(localhost|local|internal|invalid|test)$/.test(host) ||
    host === "drive.google.com" ||
    host === "docs.google.com" ||
    host === "www.googleapis.com" ||
    url.hash ||
    url.search
  )
    throw new ContentPackError(
      "Use an immutable public HTTPS media URL, not a private/share/signed URL",
    );
  return url;
}

function scheduleTime(value: string) {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(
      value,
    );
  if (!match)
    throw new ContentPackError(
      "Every schedule needs a full ISO timestamp with timezone offset",
    );
  const [, year, month, day, hour, minute, second, offset] = match;
  const date = new Date(Date.UTC(+year, +month - 1, +day));
  if (
    +year < 2020 ||
    +month < 1 ||
    +month > 12 ||
    date.getUTCMonth() !== +month - 1 ||
    date.getUTCDate() !== +day ||
    +hour > 23 ||
    +minute > 59 ||
    +second > 59 ||
    !Number.isFinite(Date.parse(value))
  )
    throw new ContentPackError("Invalid schedule date");
  const instant = Date.parse(value);
  if (offset !== "Z") {
    const londonOffset = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      timeZoneName: "longOffset",
    })
      .formatToParts(new Date(instant))
      .find((p) => p.type === "timeZoneName")?.value;
    if (
      offset !==
      (londonOffset === "GMT" ? "+00:00" : londonOffset?.replace("GMT", ""))
    )
      throw new ContentPackError(
        "Schedule offset does not match Europe/London daylight saving",
      );
  }
  return instant;
}

export function validateContentPack(
  input: unknown,
  options: { now?: Date; requireFuture?: boolean } = {},
): ContentPack {
  const parsed = packSchema.safeParse(input);
  if (!parsed.success)
    throw new ContentPackError(
      "Invalid content pack: " +
        parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
    );
  const pack = parsed.data,
    ids = new Set<string>(),
    assetVersions = new Map<string, string>();
  for (const post of pack.posts) {
    if (ids.has(post.post_id)) throw new ContentPackError("Duplicate post_id");
    ids.add(post.post_id);
    if (post.platform === "linkedin" && post.media.length > 9)
      throw new ContentPackError(
        "LinkedIn feed posts support at most nine images; split this post before review",
      );
    const limit = post.platform === "instagram" ? 2200 : 3000;
    if (
      post.caption !== post.caption.trim() ||
      !post.caption.trim() ||
      post.caption.length > limit
    )
      throw new ContentPackError(
        `Caption must be exact, nonblank and within ${limit} characters`,
      );
    const instant = scheduleTime(post.schedule_at);
    if (
      options.requireFuture !== false &&
      instant < (options.now ?? new Date()).getTime() + CONTENT_MIN_LEAD_MS
    )
      throw new ContentPackError(
        "Schedule must be at least five minutes in the future",
      );
    const mediaIds = new Set<string>();
    for (const media of post.media) {
      contentMediaUrl(media.url);
      if (mediaIds.has(media.asset_id))
        throw new ContentPackError("Duplicate media asset in a post");
      mediaIds.add(media.asset_id);
      const identity = JSON.stringify([
        media.sha256,
        media.url,
        media.mime_type,
      ]);
      if (
        assetVersions.has(media.asset_id) &&
        assetVersions.get(media.asset_id) !== identity
      )
        throw new ContentPackError(
          "A media asset ID cannot refer to different bytes/URLs in one pack",
        );
      assetVersions.set(media.asset_id, identity);
    }
  }
  return pack;
}

/** Arrays preserve order. The action layer additionally binds destination/action to its own hash. */
export function contentPackHash(pack: ContentPack) {
  function canonical(v: unknown): string {
    if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
    if (v && typeof v === "object")
      return (
        "{" +
        Object.keys(v)
          .sort()
          .map(
            (k) =>
              JSON.stringify(k) +
              ":" +
              canonical((v as Record<string, unknown>)[k]),
          )
          .join(",") +
        "}"
      );
    return JSON.stringify(v);
  }
  return createHash("sha256").update(canonical(pack)).digest("hex");
}

export async function contentResponseBytes(response: Response, limit: number) {
  const declared = Number(response.headers.get("content-length"));
  if (declared > limit)
    throw new ContentPackError("Source file exceeds size limit", 413);
  const reader = response.body?.getReader();
  if (!reader) throw new ContentPackError("Source body missing", 502);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > limit)
        throw new ContentPackError("Source file exceeds size limit", 413);
      chunks.push(next.value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  return Buffer.concat(
    chunks.map((c) => Buffer.from(c)),
    size,
  );
}
