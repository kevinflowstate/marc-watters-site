import { getEnv } from "@/lib/env";
import {
  getArtifact,
  listArtifactItems,
  decideArtifact,
  claimArtifact,
  claimArtifactItem,
  recordArtifactItem,
  finishArtifact,
  reconcileArtifactItem,
  type OpsArtifact,
  type ArtifactItem,
  type ArtifactSnapshot,
} from "./actions";
import {
  artifactHash,
  artifactSnapshot,
  assertSnapshot,
  canonicalJson,
} from "./action-validation";
import { OpsError, record } from "./tasks";
import { ContentPackError, validateContentPack } from "./content-pack";
import { executeContentPost } from "./content-scheduling";
import { contentArtifactReadiness } from "./content-preflight";
import {
  validateLessonPublicationManifest,
  previewLessonPublication,
  publishLessonArtifact,
} from "./lesson-publication";

const MAX_CONTENT_POSTS_PER_REQUEST = 1;
export function automationControls() {
  return {
    content_scheduling:
      getEnv("OPS_CONTENT_SCHEDULING_ENABLED") === "true" &&
      Boolean(getEnv("CBB_GHL_PIT_TOKEN")) &&
      Boolean(getEnv("CBB_GHL_USER_ID")) &&
      Boolean(getEnv("OPS_CONTENT_MEDIA_HOSTS")),
    lesson_publication: getEnv("OPS_LESSON_PUBLICATION_ENABLED") === "true",
    payment_reminders: getEnv("OPS_PAYMENT_REMINDERS_ENABLED") === "true",
  };
}
export type ArtifactExecutionDeps = {
  get: typeof getArtifact;
  items: typeof listArtifactItems;
  decide: typeof decideArtifact;
  claim: typeof claimArtifact;
  claimItem: typeof claimArtifactItem;
  recordItem: typeof recordArtifactItem;
  finish: typeof finishArtifact;
  reconcile: typeof reconcileArtifactItem;
  controls: typeof automationControls;
  contentExecute: typeof executeContentPost;
  lessonPreview: typeof previewLessonPublication;
  lessonPublish: typeof publishLessonArtifact;
};
function dependencies(): ArtifactExecutionDeps {
  return {
    get: getArtifact,
    items: listArtifactItems,
    decide: decideArtifact,
    claim: claimArtifact,
    claimItem: claimArtifactItem,
    recordItem: recordArtifactItem,
    finish: finishArtifact,
    reconcile: reconcileArtifactItem,
    controls: automationControls,
    contentExecute: executeContentPost,
    lessonPreview: previewLessonPublication,
    lessonPublish: publishLessonArtifact,
  };
}
function domainError(e: unknown): never {
  if (e instanceof ContentPackError) throw new OpsError(e.message, e.status);
  throw e;
}
function exact(input: unknown, fields: string[]) {
  const body = record(input);
  if (Object.keys(body).some((k) => !fields.includes(k)))
    throw new OpsError("Unsupported action field");
  return body;
}
export function executionSnapshot(input: unknown) {
  const body = exact(input, ["version", "manifest_hash"]);
  return artifactSnapshot(body);
}

/** These checks bind the immutable core document to the domain actually executed. */
export function validateArtifactDomain(
  artifact: OpsArtifact,
  requireFuture = false,
) {
  const calculated = artifactHash({
    kind: artifact.kind,
    action: artifact.action,
    title: artifact.title,
    payload: artifact.payload,
    destination: artifact.destination,
    item_keys: artifact.item_keys,
  });
  if (calculated !== artifact.manifest_hash)
    throw new OpsError("Prepared work integrity check failed", 409);
  try {
    if (artifact.kind === "content" && artifact.action === "schedule_content") {
      const manifest = validateContentPack(artifact.payload, { requireFuture });
      if (
        manifest.version !== artifact.version ||
        canonicalJson(artifact.destination) !==
          canonicalJson({ location_id: manifest.location_id }) ||
        canonicalJson(artifact.item_keys) !==
          canonicalJson(manifest.posts.map((p) => p.post_id))
      )
        throw new OpsError(
          "Content action, version, destination or post list does not match the prepared pack",
          409,
        );
      return { kind: "content" as const, manifest };
    }
    if (artifact.kind === "lesson" && artifact.action === "publish_lesson") {
      const manifest = validateLessonPublicationManifest(artifact.payload);
      if (
        manifest.version !== artifact.version ||
        canonicalJson(artifact.destination) !==
          canonicalJson({ module_id: manifest.module_id }) ||
        canonicalJson(artifact.item_keys) !== canonicalJson(["lesson"])
      )
        throw new OpsError(
          "Lesson action, version, destination or item does not match the prepared lesson",
          409,
        );
      return { kind: "lesson" as const, manifest };
    }
    throw new OpsError("Unsupported prepared action", 409);
  } catch (e) {
    return domainError(e);
  }
}

export async function artifactPreview(
  artifact: OpsArtifact,
  supplied?: ArtifactExecutionDeps,
  currentItems?: ArtifactItem[],
) {
  const d = supplied ?? dependencies();
  const validated = validateArtifactDomain(artifact);
  if (validated.kind === "content") {
    let validation_error: string | undefined;
    try {
      let remaining = validated.manifest.posts;
      if (!["draft", "approved"].includes(artifact.status)) {
        const pending = new Set(
          (currentItems ?? (await d.items(artifact.id)))
            .filter((item) => item.status === "pending")
            .map((item) => item.item_key),
        );
        remaining = remaining.filter((post) => pending.has(post.post_id));
      }
      if (remaining.length)
        validateContentPack({ ...validated.manifest, posts: remaining });
    } catch (e) {
      validation_error =
        e instanceof ContentPackError
          ? e.message
          : "Content needs another review";
    }
    return {
      kind: "content",
      dry_run: true,
      timezone: validated.manifest.timezone,
      location_id: validated.manifest.location_id,
      posts: validated.manifest.posts,
      ...(validation_error ? { validation_error } : {}),
    };
  }
  const media_url = `/api/admin/ops/lesson-media/${validated.manifest.media.verification_id}/preview`;
  try {
    return {
      ...(await d.lessonPreview(validated.manifest)),
      kind: "lesson",
      media_url,
    };
  } catch (e) {
    if (!(e instanceof OpsError)) throw e;
    return {
      kind: "lesson",
      dry_run: true,
      manifest: validated.manifest,
      media_url,
      validation_error: e.message,
    };
  }
}

export async function getArtifactDetail(
  id: string,
  supplied?: ArtifactExecutionDeps,
) {
  const d = supplied ?? dependencies();
  const artifact = await d.get(id),
    items = await d.items(id);
  return {
    artifact,
    items,
    preview: await artifactPreview(artifact, d, items),
  };
}

/** Explicit admin-triggered read checks remain usable while every write gate is off. */
export async function preflightPreparedContent(
  id: string,
  input: unknown,
  supplied?: ArtifactExecutionDeps,
  readiness = contentArtifactReadiness,
) {
  const d = supplied ?? dependencies();
  const body = exact(input, ["version", "manifest_hash", "post_ids"]);
  const artifact = await d.get(id);
  assertSnapshot(artifact, artifactSnapshot(body));
  const validated = validateArtifactDomain(artifact);
  if (validated.kind !== "content")
    throw new OpsError(
      "Choose a content pack for these scheduling checks",
      409,
    );
  if (
    body.post_ids !== undefined &&
    (!Array.isArray(body.post_ids) ||
      !body.post_ids.every((value) => typeof value === "string"))
  )
    throw new OpsError("Choose the posts to check");
  try {
    const items = await d.items(id);
    const result = await readiness(artifact, items, {
      enabled: d.controls().content_scheduling,
      postIds: body.post_ids as string[] | undefined,
    });
    const latest = await d.get(id);
    assertSnapshot(latest, artifactSnapshot(body));
    const latestItems = await d.items(id);
    if (
      latest.status !== artifact.status ||
      latest.approved_by !== artifact.approved_by ||
      latest.approved_at !== artifact.approved_at ||
      canonicalJson(
        latestItems.map((item) => [
          item.item_key,
          item.status,
          item.updated_at,
        ]),
      ) !==
        canonicalJson(
          items.map((item) => [item.item_key, item.status, item.updated_at]),
        )
    )
      throw new OpsError(
        "This work changed while the checks were running. Refresh it and check again.",
        409,
      );
    return result;
  } catch (error) {
    return domainError(error);
  }
}

export async function decidePreparedArtifact(
  id: string,
  input: unknown,
  authenticatedAdminId: string,
  supplied?: ArtifactExecutionDeps,
) {
  const d = supplied ?? dependencies(),
    body = exact(input, ["version", "manifest_hash", "decision", "note"]);
  const snapshot = artifactSnapshot(body),
    artifact = await d.get(id);
  assertSnapshot(artifact, snapshot);
  if (body.decision === "approved") {
    const validated = validateArtifactDomain(artifact, true);
    if (validated.kind === "lesson") await d.lessonPreview(validated.manifest);
  }
  return d.decide(id, body, authenticatedAdminId);
}

/** Explicit human recovery; core requires item revision, evidence and stopped-executor confirmation. */
export async function reconcilePreparedArtifact(
  id: string,
  itemKey: string,
  input: unknown,
  authenticatedAdminId: string,
  supplied?: ArtifactExecutionDeps,
) {
  const d = supplied ?? dependencies();
  const body = exact(input, [
    "version",
    "manifest_hash",
    "expected_updated_at",
    "resolution",
    "receipt",
    "note",
    "executor_stopped",
  ]);
  const snapshot = artifactSnapshot(body);
  const artifact = await d.get(id);
  assertSnapshot(artifact, snapshot);
  validateArtifactDomain(artifact);
  if (!artifact.item_keys.includes(itemKey))
    throw new OpsError("Item is not part of this approved action", 409);
  const recovery = Object.fromEntries(
    Object.entries(body).filter(
      ([key]) => key !== "version" && key !== "manifest_hash",
    ),
  );
  const updated = await d.reconcile(
    id,
    itemKey,
    recovery,
    authenticatedAdminId,
  );
  return { artifact: updated, items: await d.items(id) };
}

function progress(
  artifact: OpsArtifact,
  items: ArtifactItem[],
  reused: boolean,
) {
  const pending = items.some((i) => i.status === "pending");
  const running = items.some((i) => i.status === "running");
  return {
    artifact,
    items,
    reused,
    has_more: pending,
    continuation_required: pending && !running && artifact.status === "running",
    needs_attention: items.some(
      (i) => i.status === "failed" || i.status === "unknown",
    ),
    in_progress: running,
  };
}

/** Claims are persisted before any side effect; body never supplies executor settings or identity. */
export async function executePreparedArtifact(
  id: string,
  input: unknown,
  authenticatedAdminId: string,
  supplied?: ArtifactExecutionDeps,
) {
  const d = supplied ?? dependencies(),
    snapshot: ArtifactSnapshot = executionSnapshot(input);
  let artifact = await d.get(id);
  assertSnapshot(artifact, snapshot);
  const validated = validateArtifactDomain(artifact);
  let items = await d.items(id);
  if (artifact.status === "completed") return progress(artifact, items, true);
  const controls = d.controls();
  if (
    (validated.kind === "content" && !controls.content_scheduling) ||
    (validated.kind === "lesson" && !controls.lesson_publication)
  )
    throw new OpsError(
      validated.kind === "content"
        ? "Content scheduling is not enabled or its server connection is incomplete"
        : "Lesson publication is not enabled",
      409,
    );
  // Expired dates on already successful posts do not block continuation of other approved posts.
  if (validated.kind === "content") {
    const pending = new Set(
      items.filter((i) => i.status === "pending").map((i) => i.item_key),
    );
    const posts = validated.manifest.posts.filter((p) =>
      pending.has(p.post_id),
    );
    if (posts.length) {
      try {
        validateContentPack({ ...validated.manifest, posts });
      } catch (e) {
        domainError(e);
      }
    }
  } else if (artifact.status === "approved") {
    await d.lessonPreview(validated.manifest);
  }
  const claim = await d.claim(id, snapshot, authenticatedAdminId);
  artifact = claim.artifact;
  if (artifact.status === "completed")
    return progress(artifact, await d.items(id), true);
  if (!claim.claim_id) throw new OpsError("Execution claim was not saved", 409);
  const claimId = claim.claim_id;
  const candidates = items
    .filter((i) => i.status === "pending")
    .slice(0, validated.kind === "content" ? MAX_CONTENT_POSTS_PER_REQUEST : 1);
  for (const candidate of candidates) {
    const claimed = await d.claimItem(id, claimId, candidate.item_key);
    if (!claimed.claimed) continue;
    if (validated.kind === "lesson") {
      try {
        // This RPC writes the lesson and settles its item in one database transaction.
        await d.lessonPublish(validated.manifest, {
          artifact_id: id,
          claim_id: claimId,
        });
      } catch {
        const readback = (await d.items(id)).find(
          (i) => i.item_key === candidate.item_key,
        );
        if (readback?.status !== "succeeded")
          await d.recordItem(id, claimId, candidate.item_key, {
            status: "unknown",
            error:
              "Lesson publication outcome needs reconciliation before retrying",
          });
      }
      continue;
    }
    let outcome;
    try {
      outcome = await d.contentExecute(validated.manifest, candidate.item_key, {
        dryRun: false,
      });
    } catch {
      outcome = {
        outcome: "uncertain" as const,
        post_id: candidate.item_key,
        reason:
          "Content execution outcome needs reconciliation before retrying",
      };
    }
    const succeeded = outcome.outcome === "scheduled";
    const status = succeeded
      ? "succeeded"
      : outcome.outcome === "uncertain"
        ? "unknown"
        : "failed";
    const receipt =
      outcome.receipt || outcome.provider_id
        ? {
            ...(outcome.receipt ?? {}),
            ...(outcome.provider_id
              ? { provider_id: outcome.provider_id }
              : {}),
            post_id: candidate.item_key,
          }
        : null;
    if (succeeded && (!outcome.provider_id || !outcome.receipt)) {
      await d.recordItem(id, claimId, candidate.item_key, {
        status: "unknown",
        receipt,
        error: "Scheduling result is missing its verified provider receipt",
      });
    } else {
      await d.recordItem(id, claimId, candidate.item_key, {
        status,
        receipt,
        error: succeeded
          ? null
          : outcome.outcome === "dry_run"
            ? "Preview only; no content was scheduled"
            : (outcome.reason ?? "Content execution needs attention"),
      });
    }
  }
  items = await d.items(id);
  // Keep a bounded run's claim alive for the next explicit continuation click.
  if (!items.some((i) => i.status === "pending" || i.status === "running"))
    artifact = await d.finish(id, claimId);
  else artifact = await d.get(id);
  return progress(artifact, items, claim.reused);
}
