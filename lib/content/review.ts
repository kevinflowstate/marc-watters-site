import { londonInput, londonToUtc } from "./slots";
import type { Platform, Video } from "./types";

export type Review = {
  revision: string;
  caption: string;
  date: string;
  platforms: Platform[];
  approved: boolean;
};
export function newReview(video: Video): Review {
  return {
    revision: video.updated_at,
    caption: video.caption,
    date:
      video.schedule_at || video.suggested_at
        ? londonInput((video.schedule_at || video.suggested_at)!)
        : "",
    platforms: [...video.platforms],
    approved: false,
  };
}
export function editReview(
  review: Review,
  patch: Partial<Pick<Review, "caption" | "date" | "platforms">>,
): Review {
  return { ...review, ...patch, approved: false };
}
export function reviewIssue(
  video: Video,
  review: Review,
  now = Date.now(),
): string | null {
  if (video.updated_at !== review.revision)
    return "Video changed. Refresh and review it again.";
  if (video.approved_at || video.content_video_posts.length)
    return "Check the existing platform receipts.";
  if (video.status !== "ready" || !video.media_url)
    return "Video must finish importing before approval.";
  if (!review.caption.trim()) return "Caption needed";
  if (!review.platforms.length) return "Choose at least one platform.";
  const count = Array.from(review.caption).length;
  if (review.platforms.includes("instagram") && count > 2200)
    return "Caption exceeds Instagram’s 2,200 character limit.";
  if (review.platforms.includes("linkedin") && count > 3000)
    return "Caption exceeds LinkedIn’s 3,000 character limit.";
  try {
    if (!review.date || Date.parse(londonToUtc(review.date)) <= now)
      return "Choose a future posting date.";
  } catch {
    return "Choose a valid London posting date.";
  }
  return null;
}

export type ReviewItem = { video: Video; review: Review };
export type ReviewResult = { id: string; video?: Video; error?: string };
/** One explicit batch action, using the existing guarded per-video endpoints. Never retry a request here. */
export async function scheduleReviews(
  items: ReviewItem[],
  options: {
    enabled: boolean;
    sample: boolean;
    save: (video: Video, review: Review) => Promise<Video>;
    schedule: (video: Video) => Promise<Video>;
    onResult: (result: ReviewResult) => void;
  },
): Promise<ReviewResult[]> {
  if (!options.enabled || options.sample)
    throw new Error("Scheduling is switched off.");
  if (!items.length) throw new Error("Approve at least one video first.");
  if (new Set(items.map(({ video }) => video.id)).size !== items.length)
    throw new Error("A video was selected more than once.");
  for (const { video, review } of items) {
    const issue = reviewIssue(video, review);
    if (!review.approved || issue)
      throw new Error(issue || "Review and approve each selected video.");
  }
  const results: ReviewResult[] = [];
  for (const { video, review } of items) {
    let result: ReviewResult;
    try {
      const saved = await options.save(video, review);
      result = { id: video.id, video: await options.schedule(saved) };
    } catch (error) {
      result = {
        id: video.id,
        error:
          error instanceof Error
            ? error.message
            : "Could not confirm scheduling. Check the CRM receipts before trying again.",
      };
    }
    results.push(result);
    options.onResult(result);
  }
  return results;
}
