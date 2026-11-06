import type { ArtifactItem, OpsArtifact } from "./action-types";
import { ContentPackError, validateContentPack } from "./content-pack";
import {
  verifyContentPostDelivery,
  type ContentScheduleOptions,
} from "./content-scheduling";

export const MAX_CONTENT_PREFLIGHT_POSTS = 5;
export type ContentReadinessOptions = ContentScheduleOptions & {
  postIds?: string[];
  verify?: typeof verifyContentPostDelivery;
};

/** No writes, claims, approval or scheduler calls belong in this function. */
export async function contentArtifactReadiness(
  artifact: OpsArtifact,
  items: ArtifactItem[],
  options: ContentReadinessOptions = {},
) {
  const pack = validateContentPack(artifact.payload, { requireFuture: false });
  const requested = options.postIds;
  if (
    requested &&
    (!requested.length ||
      requested.length > MAX_CONTENT_PREFLIGHT_POSTS ||
      new Set(requested).size !== requested.length ||
      !requested.every((id) => pack.posts.some((post) => post.post_id === id)))
  )
    throw new ContentPackError(
      "Choose up to five different posts from this version",
    );
  const selection = requested
    ? pack.posts.filter((post) => requested.includes(post.post_id))
    : pack.posts
        .filter((post) =>
          items.some(
            (item) =>
              item.item_key === post.post_id && item.status === "pending",
          ),
        )
        .slice(0, MAX_CONTENT_PREFLIGHT_POSTS);
  const enabled =
    options.enabled ?? process.env.OPS_CONTENT_SCHEDULING_ENABLED === "true";
  const verify = options.verify ?? verifyContentPostDelivery;
  const request = options.fetch ?? fetch;
  const deadline = AbortSignal.timeout(90_000);
  const readOnlyFetch: typeof fetch = async (input, init) => {
    const method =
      init?.method ?? (input instanceof Request ? input.method : "GET");
    if (method.toUpperCase() !== "GET")
      throw new ContentPackError(
        "Readiness checks cannot create or change social posts",
      );
    return request(input, {
      ...init,
      method: "GET",
      signal: init?.signal
        ? AbortSignal.any([init.signal, deadline])
        : deadline,
    });
  };
  const approved =
    Boolean(artifact.approved_by && artifact.approved_at) &&
    ["approved", "running", "needs_attention", "completed"].includes(
      artifact.status,
    );
  const checks = [];
  for (const post of selection) {
    const item = items.find((row) => row.item_key === post.post_id);
    const base = {
      post_id: post.post_id,
      platform: post.platform,
      account_id: post.account_id,
      schedule_label:
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Europe/London",
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(post.schedule_at)) + " (London time)",
    };
    if (!item || item.artifact_id !== artifact.id) {
      checks.push({
        ...base,
        status: "blocked",
        connection_ready: false,
        summary:
          "This post’s saved progress is missing. Refresh the work before continuing.",
        blockers: ["Saved post progress needs checking."],
      });
      continue;
    }
    if (item.status !== "pending") {
      const confirmed =
        item.status === "succeeded" &&
        typeof item.receipt?.provider_id === "string" &&
        item.receipt?.status === "scheduled";
      checks.push({
        ...base,
        status: confirmed ? "already_scheduled" : "needs_attention",
        connection_ready: false,
        summary: confirmed
          ? "This post already has a saved scheduling confirmation. It will not be scheduled again."
          : item.status === "running"
            ? "This post is already being processed. Do not start another attempt."
            : "The previous attempt needs checking before another scheduling attempt.",
        blockers: confirmed
          ? []
          : ["Check the previous attempt and its confirmation first."],
      });
      continue;
    }
    if (["superseded", "rejected", "completed"].includes(artifact.status)) {
      checks.push({
        ...base,
        status: "blocked",
        connection_ready: false,
        summary:
          artifact.status === "superseded"
            ? "A newer version is available. Open that version instead."
            : "This version needs updating before it can be scheduled.",
        blockers: ["Open the current version and complete its review."],
      });
      continue;
    }
    const blockers = [];
    if (!approved) blockers.push("This version still needs approval.");
    if (!enabled) blockers.push("Scheduling is switched off.");
    try {
      const checked = await verify(pack, post.post_id, {
        ...options,
        fetch: readOnlyFetch,
      });
      checks.push({
        ...base,
        ...checked,
        status: blockers.length ? "blocked" : "ready",
        connection_ready: true,
        summary: blockers.length
          ? "The account, date and image files passed the checks. " +
            blockers.join(" ")
          : "The account, date and image files passed the checks. This post is ready for the separate scheduling action.",
        blockers,
      });
    } catch (error) {
      const reason =
        error instanceof ContentPackError
          ? error.message
          : "The account or image files could not be checked. Try again after the connection is restored.";
      checks.push({
        ...base,
        status: "blocked",
        connection_ready: false,
        summary: reason,
        blockers: [...blockers, reason],
      });
    }
  }
  const selected = new Set(selection.map((post) => post.post_id));
  const unselectedPending = pack.posts.filter(
    (post) =>
      !selected.has(post.post_id) &&
      items.some(
        (item) => item.item_key === post.post_id && item.status === "pending",
      ),
  );
  const ready =
    checks.length > 0 && checks.every((check) => check.status === "ready");
  return {
    dry_run: true,
    checked_at: (options.now ?? new Date()).toISOString(),
    ready,
    summary: !checks.length
      ? "There are no unchecked pending posts in this selection. Nothing was scheduled."
      : ready
        ? "The selected posts passed their checks. Nothing has been scheduled."
        : "Some steps are still needed before scheduling. Nothing has been scheduled.",
    scheduling_enabled: enabled,
    approval_saved: approved,
    checks,
    has_more: unselectedPending.length > 0,
    remaining_post_ids: unselectedPending.map((post) => post.post_id),
  };
}
