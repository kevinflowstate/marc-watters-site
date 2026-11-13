"use client";
import { useRef } from "react";
import { londonToUtc } from "@/lib/content/slots";
import { platforms, type Platform, type Video } from "@/lib/content/types";
import { reviewIssue, type Review } from "@/lib/content/review";

export const platformLabels = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
};
export const when = (s: string | null) =>
  s
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London",
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(s))
    : "Choose a date";
function status(v: Video, review: Review) {
  if (
    v.content_video_posts.some((p) =>
      ["claimed", "uncertain"].includes(p.outcome),
    )
  )
    return "Needs checking";
  if (v.status === "partly_scheduled") return "Partly scheduled";
  if (v.status === "ready")
    return review.caption.trim() ? "Ready to review" : "Caption needed";
  return {
    new: "Awaiting import",
    importing: "Importing · check receipt",
    failed: "Import needs attention",
    scheduled: "Scheduled",
    skipped: "Skipped",
    replaced: "Video replaced",
  }[v.status];
}

type Props = {
  video: Video;
  review: Review;
  expanded: boolean;
  busy: boolean;
  enabled: boolean;
  sample: boolean;
  error?: string;
  onExpand: () => void;
  onEdit: (
    patch: Partial<Pick<Review, "caption" | "date" | "platforms">>,
  ) => void;
  onApproval: (approved: boolean) => void;
  onSave: () => void;
  onSkip: () => void;
  onRetry: (platform: Platform) => void;
  onReconcile: () => void;
};
export default function ContentReviewRow({
  video: v,
  review,
  expanded,
  busy,
  enabled,
  sample,
  error,
  onExpand,
  onEdit,
  onApproval,
  onSave,
  onSkip,
  onRetry,
  onReconcile,
}: Props) {
  const player = useRef<HTMLVideoElement>(null);
  const locked =
    !!v.approved_at ||
    v.content_video_posts.length > 0 ||
    v.status === "importing" ||
    v.status === "skipped";
  const issue = reviewIssue(v, review);
  const approved = review.approved && !issue;
  const title = v.file_name.replace(/\.mp4$/i, "");
  const count = Array.from(review.caption).length;
  const id = `review-${v.id}`;
  let displayDate = v.schedule_at;
  if (!displayDate && review.date) {
    try {
      displayDate = londonToUtc(review.date);
    } catch {
      /* The field warning explains an invalid date. */
    }
  }
  return (
    <article
      className={`content-review-row${approved ? " is-approved" : ""}`}
      aria-label={title}
    >
      <div className="content-review-bar">
        <button
          className="content-expand"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => {
            player.current?.pause();
            onExpand();
          }}
        >
          <span className="content-thumbnail" aria-hidden="true">
            {v.media_url ? (
              <video
                src={`${v.media_url}#t=0.1`}
                muted
                playsInline
                preload="metadata"
                tabIndex={-1}
              />
            ) : (
              <span>▷</span>
            )}
            <span className="content-thumbnail-play">▷</span>
          </span>
          <span className="content-row-copy">
            <span className="ws-row-title">{title}</span>
            <span className="ws-row-sub">
              {approved ? "Ready to schedule" : status(v, review)}
            </span>
            <span className="content-muted">{when(displayDate)}</span>
          </span>
          <span className="content-chevron" aria-hidden="true">
            {expanded ? "−" : "+"}
          </span>
        </button>
        {!locked && (
          <label
            className="content-approval"
            title={issue ?? "Reviewed and ready to schedule"}
          >
            <input
              type="checkbox"
              checked={approved}
              disabled={busy || !!issue}
              aria-label={`Approved: ${title}`}
              onChange={(e) => onApproval(e.target.checked)}
            />
            Approved
          </label>
        )}
        {locked && <span className="ws-chip">{status(v, review)}</span>}
      </div>
      {expanded && (
        <div id={id} className="content-expanded">
          <div className="content-video-column">
            <div className="content-video-stage">
              {v.media_url ? (
                <video
                  ref={player}
                  key={v.media_url}
                  controls
                  playsInline
                  preload="metadata"
                  aria-label={`Video preview: ${title}`}
                  src={v.media_url}
                />
              ) : (
                <div className="content-video-empty">
                  <strong>Video awaiting import</strong>
                  <span>
                    {enabled
                      ? "Check for new videos to import the next file."
                      : "Media upload is switched off."}
                  </span>
                </div>
              )}
            </div>
            {v.drive_file_id && (
              <a
                className="ws-btn"
                target="_blank"
                rel="noreferrer"
                href={`https://drive.google.com/file/d/${encodeURIComponent(v.drive_file_id)}/view`}
              >
                Open in Drive
              </a>
            )}
          </div>
          <div className="content-copy-column">
            <label className="ws-label" htmlFor={`${id}-caption`}>
              Caption{" "}
              <span className="content-muted">
                {count.toLocaleString()} characters
              </span>
            </label>
            <textarea
              id={`${id}-caption`}
              className="ws-input content-caption"
              value={review.caption}
              disabled={locked || busy}
              placeholder="Caption needed"
              onChange={(e) => onEdit({ caption: e.target.value })}
            />
            <div className="content-settings">
              <div>
                <label className="ws-label" htmlFor={`${id}-date`}>
                  Posting date · London
                </label>
                <input
                  id={`${id}-date`}
                  className="ws-input"
                  type="datetime-local"
                  value={review.date}
                  disabled={locked || busy}
                  onChange={(e) => onEdit({ date: e.target.value })}
                />
              </div>
              <fieldset>
                <legend className="ws-label">Platforms</legend>
                <div className="content-platforms">
                  {platforms.map((p) => (
                    <label key={p}>
                      <input
                        type="checkbox"
                        checked={review.platforms.includes(p)}
                        disabled={locked || busy}
                        onChange={(e) =>
                          onEdit({
                            platforms: e.target.checked
                              ? [...review.platforms, p]
                              : review.platforms.filter((x) => x !== p),
                          })
                        }
                      />
                      {platformLabels[p]}
                      <small>{p === "linkedin" ? "Post" : "Reel"}</small>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
            {!locked && issue && <p className="content-warning">{issue}</p>}
            {!locked && (
              <div className="content-row-actions">
                <span className="content-muted">
                  {approved
                    ? "Approved · included when you schedule"
                    : "Check the video and copy, then tick Approved."}
                </span>
                {!sample && (
                  <>
                    <button className="ws-btn" disabled={busy} onClick={onSave}>
                      Save edits
                    </button>
                    <button className="ws-btn" disabled={busy} onClick={onSkip}>
                      Skip
                    </button>
                  </>
                )}
              </div>
            )}
            {v.failure_reason && (
              <div className="ws-note is-attn">{v.failure_reason}</div>
            )}
            {error && (
              <div role="alert" className="ws-note is-bad">
                {error}
              </div>
            )}
            {v.content_video_posts.length > 0 && (
              <section className="content-receipts">
                <h3 className="ws-h3">Platform receipts</h3>
                {v.content_video_posts.map((p) => (
                  <div className="content-receipt" key={p.id}>
                    <strong>{platformLabels[p.platform]}</strong>
                    <span>
                      {p.outcome === "scheduled"
                        ? "Scheduled · verified"
                        : p.outcome === "claimed"
                          ? "Attempt claimed · check outcome"
                          : p.outcome}
                    </span>
                    {p.reason && <p>{p.reason}</p>}
                    {p.provider_post_id && (
                      <a
                        className="ws-btn"
                        href="https://app.flow-state.tech/v2/location/93GJEdsr0cT9el3OINXq/marketing/social-planner"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open CRM · {p.provider_post_id}
                      </a>
                    )}
                    {p.outcome === "failed" && (
                      <button
                        className="ws-btn"
                        disabled={busy || !enabled || sample}
                        onClick={() => onRetry(p.platform)}
                      >
                        Retry {platformLabels[p.platform]}
                      </button>
                    )}
                  </div>
                ))}
                {v.content_video_posts.some((p) =>
                  ["uncertain", "claimed"].includes(p.outcome),
                ) && (
                  <button
                    className="ws-btn"
                    disabled={busy || sample}
                    onClick={onReconcile}
                  >
                    Check CRM receipts
                  </button>
                )}
                <p className="content-muted">
                  Reschedule or remove scheduled posts in the CRM. Past dates do
                  not confirm publication.
                </p>
              </section>
            )}
          </div>
        </div>
      )}
      {!expanded && error && (
        <p role="alert" className="content-warning content-row-error">
          {error}
        </p>
      )}
    </article>
  );
}
