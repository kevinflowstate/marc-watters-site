import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getArtifact } from "./actions";
import { assertSnapshot, artifactHash } from "./action-validation";
import { ContentPackError, contentResponseBytes, validateContentPack, type ContentMedia, type ContentPack } from "./content-pack";
import { OpsError } from "./tasks";
import type { OpsArtifact, ArtifactSnapshot } from "./action-types";

export const CONTENT_STAGING_BUCKET = "ops-content-media";
// Keep the complete raw request below the hosted function ingress limit.
export const CONTENT_STAGING_MAX_BYTES = 3 * 1024 * 1024;
export type ContentStagingDeps = {
  artifact: typeof getArtifact;
  privateBucket: () => Promise<void>;
  read: (path: string) => Promise<Uint8Array | null>;
  writeOnce: (path: string, bytes: Uint8Array, mime: string) => Promise<void>;
};
export function contentStagingDependencies(): ContentStagingDeps {
  const db = createAdminClient();
  return {
    artifact: getArtifact,
    privateBucket: async () => {
      const r = await db.storage.getBucket(CONTENT_STAGING_BUCKET);
      if (r.error || !r.data || r.data.public !== false || !r.data.file_size_limit || r.data.file_size_limit > CONTENT_STAGING_MAX_BYTES)
        throw new OpsError("Private content storage needs to be configured", 409);
    },
    read: async (path) => {
      const r = await db.storage.from(CONTENT_STAGING_BUCKET).download(path);
      if (r.error) {
        if (String((r.error as { statusCode?: string }).statusCode) === "404" || r.error.message === "Object not found") return null;
        throw new OpsError("Private content could not be read", 503);
      }
      if (!r.data || r.data.size > CONTENT_STAGING_MAX_BYTES) throw new OpsError("Private image exceeds the upload limit", 409);
      return new Uint8Array(await r.data.arrayBuffer());
    },
    writeOnce: async (path, bytes, mime) => {
      const r = await db.storage.from(CONTENT_STAGING_BUCKET).upload(path, bytes, { contentType: mime, upsert: false, cacheControl: "0" });
      // Concurrent identical uploads can conflict. Caller must verify stored bytes.
      if (r.error && String((r.error as { statusCode?: string }).statusCode) !== "409")
        throw new OpsError("Private image could not be stored", 503);
    },
  };
}
function current(artifact: OpsArtifact, snapshot: ArtifactSnapshot) {
  assertSnapshot(artifact, snapshot);
  if (artifact.kind !== "content" || artifact.action !== "schedule_content" || artifact.status === "superseded")
    throw new OpsError("Choose the current prepared content version", 409);
  const calculated = artifactHash({ kind: artifact.kind, action: artifact.action, title: artifact.title,
    payload: artifact.payload, destination: artifact.destination, item_keys: artifact.item_keys });
  if (calculated !== artifact.manifest_hash) throw new OpsError("Prepared content integrity check failed", 409);
  try {
    const pack = validateContentPack(artifact.payload, { requireFuture: false });
    if (pack.version !== artifact.version || JSON.stringify(artifact.destination) !== JSON.stringify({ location_id: pack.location_id }) ||
      JSON.stringify(artifact.item_keys) !== JSON.stringify(pack.posts.map((p) => p.post_id)))
      throw new OpsError("Prepared content version or destination does not match its action", 409);
    return pack;
  }
  catch (e) { throw new OpsError(e instanceof ContentPackError ? e.message : "Prepared content is invalid", 409); }
}
function selected(pack: ContentPack, assetId: string): ContentMedia {
  const media = pack.posts.flatMap((p) => p.media).find((m) => m.asset_id === assetId);
  if (!media) throw new OpsError("This image is not in the selected content version", 404);
  return media;
}
function pathFor(artifact: OpsArtifact, media: ContentMedia) {
  if (!/^[a-f0-9-]{36}$/.test(artifact.id)) throw new OpsError("Invalid content reference", 400);
  return `drafts/${artifact.id}/${artifact.manifest_hash}/${media.sha256}.${media.mime_type === "image/png" ? "png" : "jpg"}`;
}
function verify(bytes: Uint8Array, media: ContentMedia) {
  const b = Buffer.from(bytes);
  const signature = media.mime_type === "image/png"
    ? b.length >= 24 && b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : b.length >= 4 && b[0] === 255 && b[1] === 216 && b[2] === 255;
  if (!b.length || b.length > CONTENT_STAGING_MAX_BYTES || !signature || createHash("sha256").update(b).digest("hex") !== media.sha256)
    throw new OpsError("Image bytes or file type do not match this prepared version", 409);
}
export async function stageContentImage(id: string, snapshot: ArtifactSnapshot, assetId: string, request: Request,
  deps: ContentStagingDeps = contentStagingDependencies()) {
  const before = await deps.artifact(id), pack = current(before, snapshot), media = selected(pack, assetId);
  if (["running", "completed", "needs_attention"].includes(before.status) || before.execution_started_at)
    throw new OpsError("Content execution has already started; review its existing result", 409);
  const mime = request.headers.get("content-type")?.split(";")[0].trim();
  if (mime !== media.mime_type) throw new OpsError("Upload the selected image’s original file type", 400);
  await deps.privateBucket();
  let bytes;
  try { bytes = await contentResponseBytes(new Response(request.body), CONTENT_STAGING_MAX_BYTES); }
  catch { throw new OpsError("Upload one original image of 3 MiB or less", 413); }
  verify(bytes, media);
  const path = pathFor(before, media);
  const existing = await deps.read(path);
  if (existing) verify(existing, media);
  else await deps.writeOnce(path, bytes, media.mime_type);
  const stored = await deps.read(path);
  if (!stored) throw new OpsError("Stored image could not be verified", 503);
  verify(stored, media);
  current(await deps.artifact(id), snapshot);
  return { staged: true, private: true, asset_id: assetId, sha256: media.sha256, byte_size: stored.length,
    version: before.version, manifest_hash: before.manifest_hash, approval_changed: false, public_copy_created: false };
}
export async function readStagedContentImage(id: string, snapshot: ArtifactSnapshot, assetId: string,
  deps: ContentStagingDeps = contentStagingDependencies()) {
  const artifact = await deps.artifact(id), pack = current(artifact, snapshot), media = selected(pack, assetId);
  await deps.privateBucket();
  const bytes = await deps.read(pathFor(artifact, media));
  if (!bytes) throw new OpsError("Upload this image before opening its private preview", 404);
  verify(bytes, media);
  current(await deps.artifact(id), snapshot);
  return { bytes, mime_type: media.mime_type };
}

/** Produces a proposed revised pack only. It uploads nothing and saves no approval. */
export async function prepareContentDeliveryPack(id: string, snapshot: ArtifactSnapshot, deliveryOrigin: string,
  deps: ContentStagingDeps = contentStagingDependencies()) {
  const artifact = await deps.artifact(id), original = current(artifact, snapshot);
  if (artifact.execution_started_at || ["running", "completed", "needs_attention"].includes(artifact.status))
    throw new OpsError("Reconcile existing content execution before preparing new delivery URLs", 409);
  let origin;
  try { origin = new URL(deliveryOrigin); } catch { throw new OpsError("A configured media origin is required", 409); }
  if (origin.protocol !== "https:" || origin.pathname !== "/" || origin.username || origin.password || origin.port || origin.search || origin.hash)
    throw new OpsError("Use the operator-configured HTTPS media origin", 409);
  await deps.privateBucket();
  const pack = structuredClone(original);
  pack.version = artifact.version + 1;
  const checkedPaths = new Set<string>();
  const started = Date.now();
  if (new Set(original.posts.flatMap((p) => p.media.map((m) => pathFor(artifact, m)))).size > 50)
    throw new OpsError("Split content with more than 50 different images into smaller review packs", 409);
  for (const post of pack.posts) for (const media of post.media) {
    const path = pathFor(artifact, media);
    if (Date.now() - started > 30_000) throw new OpsError("Image checking took too long; retry with a smaller review pack", 503);
    if (!checkedPaths.has(path)) {
      const bytes = await deps.read(path);
      if (!bytes) throw new OpsError("Stage every original image before preparing delivery", 409);
      verify(bytes, media);
      checkedPaths.add(path);
    }
    media.url = `${origin.origin}/cbb-content/${media.sha256}.${media.mime_type === "image/png" ? "png" : "jpg"}`;
  }
  try { validateContentPack(pack, { requireFuture: false }); } catch { throw new OpsError("The delivery host is not suitable for social images", 409); }
  current(await deps.artifact(id), snapshot);
  return { proposed_pack: pack, requires_new_approval: true, public_copy_created: false,
    note: "Save this as a new prepared version for review. Public image delivery must be configured and verified separately; no image has been made public." };
}
