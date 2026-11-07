import { createAdminClient } from "@/lib/supabase/admin";
import { getEnv } from "@/lib/env";
import { getArtifact } from "./actions";
import { readStagedContentImage, CONTENT_STAGING_BUCKET } from "./content-media-staging";
import { contentPackHash, ContentPackError, type ContentPack, type ContentMedia } from "./content-pack";
import { OpsError } from "./tasks";

export type ApprovedDeliveryContext = { artifact_id: string };
export type SignedDeliveryDeps = {
  artifact: typeof getArtifact;
  read: typeof readStagedContentImage;
  sign: (path: string, seconds: number) => Promise<string>;
  origin: string;
  ttl: number;
  afterSchedule: number;
};
export function signedDeliveryConfigured() {
  return validPolicy(Number(getEnv("OPS_CONTENT_SIGNED_DELIVERY_TTL_SECONDS")), Number(getEnv("OPS_CONTENT_SIGNED_DELIVERY_AFTER_SCHEDULE_SECONDS")));
}
function validPolicy(ttl: number, after: number) {
  return Number.isSafeInteger(ttl) && ttl >= 120 && ttl <= 604800 && Number.isSafeInteger(after) && after >= 60 && after < ttl;
}
function dependencies(): SignedDeliveryDeps {
  return {
    artifact: getArtifact, read: readStagedContentImage,
    sign: async (path, seconds) => {
      const r = await createAdminClient().storage.from(CONTENT_STAGING_BUCKET).createSignedUrl(path, seconds);
      if (r.error || !r.data?.signedUrl) throw new ContentPackError("Approved image download link could not be prepared", 503);
      return r.data.signedUrl;
    },
    origin: getEnv("NEXT_PUBLIC_SUPABASE_URL") || "",
    ttl: Number(getEnv("OPS_CONTENT_SIGNED_DELIVERY_TTL_SECONDS")),
    afterSchedule: Number(getEnv("OPS_CONTENT_SIGNED_DELIVERY_AFTER_SCHEDULE_SECONDS")),
  };
}
function approved(artifact: Awaited<ReturnType<typeof getArtifact>>, pack: ContentPack) {
  if (!artifact.approved_by || !artifact.approved_at || !["approved", "running"].includes(artifact.status) ||
    artifact.kind !== "content" || artifact.version !== pack.version || contentPackHash(artifact.payload as ContentPack) !== contentPackHash(pack))
    throw new ContentPackError("This exact content version needs a saved approval before private image delivery", 409);
}
function checkedUrl(value: string, path: string, deps: SignedDeliveryDeps, now: number, schedule: number) {
  let url: URL;
  try { url = new URL(value); } catch { throw new ContentPackError("Private image delivery returned an invalid link", 409); }
  const expected = new URL(deps.origin);
  const token = url.searchParams.get("token");
  if (expected.protocol !== "https:" || url.origin !== expected.origin || url.username || url.password || url.hash ||
    url.pathname !== `/storage/v1/object/sign/${CONTENT_STAGING_BUCKET}/${path}` || !token || [...url.searchParams.keys()].some(k => k !== "token"))
    throw new ContentPackError("Private image delivery returned an unexpected host or file", 409);
  let expiry;
  try { expiry = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).exp; } catch { /* fixed safe error below */ }
  if (!Number.isSafeInteger(expiry) || expiry <= now + 60 || expiry > now + deps.ttl + 60 || expiry < schedule + deps.afterSchedule)
    throw new ContentPackError("Private image link expires before the configured delivery policy allows", 409);
  return { url: url.toString(), expires: expiry as number };
}
/** Only exact saved approvals get scoped bearer links. This never creates a social post or public object. */
export async function createApprovedContentDelivery(pack: ContentPack, postId: string, context: ApprovedDeliveryContext | undefined,
  options: { now?: Date; deps?: SignedDeliveryDeps } = {}) {
  if (!context || !/^[a-f0-9-]{36}$/.test(context.artifact_id))
    throw new ContentPackError("Private image delivery requires the approved portal content reference", 409);
  const deps = options.deps ?? dependencies();
  if (!validPolicy(deps.ttl, deps.afterSchedule))
    throw new ContentPackError("Private image delivery needs an explicit expiry and post-schedule retention policy", 409);
  const now = Math.floor((options.now ?? new Date()).getTime()/1000);
  const post = pack.posts.find(p => p.post_id === postId);
  if (!post) throw new ContentPackError("Post is missing from this approved version", 409);
  const schedule = Math.ceil(Date.parse(post.schedule_at)/1000);
  if (!Number.isFinite(schedule) || schedule <= now || now + deps.ttl - 60 < schedule + deps.afterSchedule)
    throw new ContentPackError("This post’s date is outside the configured private-image delivery horizon", 409);
  const artifact = await deps.artifact(context.artifact_id);
  approved(artifact, pack);
  const snapshot = { version: artifact.version, manifest_hash: artifact.manifest_hash };
  const media: ContentMedia[] = [];
  let expiry = now + deps.ttl;
  for (const m of post.media) {
    // The private reader checks exact artifact/domain/hash and actual stored bytes. No drafts are signed.
    try { await deps.read(artifact.id, snapshot, m.asset_id); }
    catch (e) { throw new ContentPackError(e instanceof OpsError ? e.message : "This approved image’s private original could not be verified", 409); }
    const latest = await deps.artifact(artifact.id); approved(latest, pack);
    if (latest.manifest_hash !== snapshot.manifest_hash || latest.approved_by !== artifact.approved_by || latest.approved_at !== artifact.approved_at)
      throw new ContentPackError("Content approval changed while preparing private images", 409);
    const path = `drafts/${artifact.id}/${artifact.manifest_hash}/${m.sha256}.${m.mime_type === "image/png" ? "png" : "jpg"}`;
    const signed = checkedUrl(await deps.sign(path, deps.ttl), path, deps, now, schedule);
    expiry = Math.min(expiry, signed.expires);
    media.push({ ...m, url: signed.url });
  }
  const latest = await deps.artifact(artifact.id); approved(latest, pack);
  if (latest.manifest_hash !== snapshot.manifest_hash || latest.approved_by !== artifact.approved_by || latest.approved_at !== artifact.approved_at)
    throw new ContentPackError("Content approval changed while preparing private images", 409);
  return { media, expires_at: new Date(expiry*1000).toISOString(), policy: "Configured operational retention; provider fetch timing has not been proven" };
}
