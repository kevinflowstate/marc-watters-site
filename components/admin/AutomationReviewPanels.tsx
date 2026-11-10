"use client";

import Image from "next/image";
import MarkdownPreview from "@/components/ops/MarkdownPreview";
import PrivateContentImage from "@/components/admin/PrivateContentImage";
import type {
  ArtifactItem,
  JsonValue,
  OpsArtifact,
} from "@/lib/ops/action-types";
import { bundledContentPreview } from "@/lib/ops/content-preview-assets";
import type { ContentPack } from "@/lib/ops/content-pack";

const itemStatuses: Record<ArtifactItem["status"], string> = {
  pending: "Not started",
  running: "In progress",
  succeeded: "Completed",
  failed: "Failed",
  unknown: "Result needs checking",
};

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export function text(value: unknown) {
  return typeof value === "string" ? value : "";
}
export function contentPostLabel(payload: Record<string, JsonValue>, postId: string) {
  const posts = Array.isArray(payload.posts) ? payload.posts : [];
  const index = posts.findIndex((post) => object(post).post_id === postId);
  return index >= 0 ? `Post ${index + 1}` : "Post reference needs checking";
}
export function date(value: unknown) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)))
    return "Not recorded";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
function safeUrl(value: unknown, relative = true) {
  if (typeof value !== "string") return null;
  if (
    relative &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\")
  )
    return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}
function safeMediaUrl(value: unknown) {
  const safe = safeUrl(value, false);
  if (!safe) return null;
  const url = new URL(safe);
  if (
    !url.hostname.includes(".") ||
    /[:\[\]]/.test(url.hostname) ||
    /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname) ||
    /(^|\.)(localhost|local|internal|invalid|test)$/.test(url.hostname) ||
    ["drive.google.com", "docs.google.com", "www.googleapis.com"].includes(
      url.hostname,
    ) ||
    (url.port && url.port !== "443") ||
    url.search ||
    url.hash
  )
    return null;
  return safe;
}
export function statusClass(status: string) {
  return ["needs_attention", "failed", "unknown", "unpaid"].includes(status)
    ? "text-amber-600 bg-amber-500/10"
    : ["completed", "succeeded", "paid"].includes(status)
      ? "text-emerald-600 bg-emerald-500/10"
      : "text-accent-bright bg-accent/10";
}

export function ActionAvailability({
  title,
  enabled,
}: {
  title: string;
  enabled: boolean | null;
}) {
  return (
    <div className="v2-surface flex min-w-0 flex-wrap items-center justify-between gap-2 px-4 py-3">
      <span className="text-sm font-semibold">{title}</span>
      <span
        className={`rounded-lg px-2 py-1 text-xs font-semibold ${enabled ? "bg-emerald-500/10 text-emerald-600" : "bg-current/5 text-text-muted"}`}
      >
        {enabled === true ? "On" : enabled === false ? "Off" : "Not checked"}
      </span>
    </div>
  );
}

export function ContentReview({
  payload,
  showMedia,
  artifact,
}: {
  payload: Record<string, JsonValue>;
  showMedia: boolean;
  artifact?: OpsArtifact;
}) {
  const posts = Array.isArray(payload.posts) ? payload.posts : [];
  const platformNames: Record<string, string> = {
    facebook: "Facebook",
    instagram: "Instagram",
    linkedin: "LinkedIn",
  };
  if (!posts.length)
    return (
      <p className="rounded-xl bg-amber-500/10 p-4 text-sm text-amber-600">
        No reviewable posts were included. Ask for a complete content pack
        before approving.
      </p>
    );
  return (
    <div className="space-y-4">
      {posts.map((value, index) => {
        const post = object(value) as Partial<ContentPack["posts"][number]>;
        const media = Array.isArray(post.media) ? post.media : [];
        return (
          <article
            key={post.post_id || index}
            className="min-w-0 rounded-xl border border-current/10 p-4"
          >
            <div className="flex flex-wrap justify-between gap-2">
              <h3 className="font-heading font-bold">
                Post {index + 1} ·{" "}
                {platformNames[post.platform || ""] || "Channel not recorded"}
              </h3>
              <span className="text-sm text-accent-bright">
                {date(post.schedule_at)}
              </span>
            </div>
            <p className="mt-1 text-xs text-text-muted">
              All times shown in London time.
            </p>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm">
              {post.caption || "Copy is missing."}
            </p>
            {media.length > 0 && showMedia && (
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {media.map((value, mediaIndex) => {
                  const image = object(value);
                  const url =
                    bundledContentPreview(image) || safeMediaUrl(image.url);
                  if (artifact && typeof image.asset_id === "string") return (
                    <PrivateContentImage key={`${artifact.id}:${artifact.manifest_hash}:${image.asset_id}`}
                      artifact={artifact} assetId={image.asset_id} fallback={url}
                      label={`Post ${index + 1}, image ${mediaIndex + 1}`} />
                  );
                  return url ? (
                    <a
                      key={mediaIndex}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="block min-w-0 rounded-lg border border-current/10 p-1"
                    >
                      <Image
                        unoptimized
                        referrerPolicy="no-referrer"
                        src={url}
                        width={480}
                        height={480}
                        alt={`Post ${index + 1}, image ${mediaIndex + 1}`}
                        className="aspect-square w-full rounded-md bg-bg-primary object-contain"
                      />
                      <span className="block px-1 py-1 text-center text-xs text-text-muted">
                        Image {mediaIndex + 1}
                      </span>
                    </a>
                  ) : (
                    <p
                      key={mediaIndex}
                      className="rounded-lg bg-amber-500/10 p-3 text-xs text-amber-600"
                    >
                      Image {mediaIndex + 1} is unavailable.
                    </p>
                  );
                })}
              </div>
            )}
            <details className="mt-3 text-xs text-text-muted">
              <summary className="cursor-pointer">Destination account</summary>
              <p className="mt-2 break-all">
                {platformNames[post.platform || ""] || "Channel"}:{" "}
                {post.account_id || "Not recorded"}
              </p>
            </details>
          </article>
        );
      })}
    </div>
  );
}

function workbookPdfPath(payload: Record<string, JsonValue>) {
  const ref = payload.workbook_pdf;
  if (!ref || typeof ref !== "object" || Array.isArray(ref)) return "";
  const path = (ref as Record<string, JsonValue>).storage_path;
  return typeof path === "string" && /^workbooks\/[a-f0-9]{64}\.pdf$/.test(path) ? path : "";
}

export function LessonReview({
  payload,
  preview,
}: {
  payload: Record<string, JsonValue>;
  preview: Record<string, unknown> | null;
}) {
  const destination = object(preview?.destination);
  const verification = object(preview?.verification);
  const mediaUrl = safeUrl(preview?.media_url || preview?.preview_url);
  const published = payload.mode === "publish";
  const duration =
    typeof verification.duration_s === "number"
      ? `${Math.floor(verification.duration_s / 60)}m ${Math.round(verification.duration_s % 60)}s`
      : null;
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-current/10 p-4">
        <h3 className="font-heading font-bold">Finished lesson</h3>
        {mediaUrl ? (
          <>
            <video
              key={mediaUrl}
              controls
              preload="metadata"
              src={mediaUrl}
              className="mt-3 aspect-video w-full rounded-lg bg-black"
              aria-label="Edited lesson preview"
            />
            <a
              href={mediaUrl}
              className="mt-2 inline-block text-sm text-accent-bright underline"
              target="_blank"
              rel="noreferrer"
            >
              Open private video preview
            </a>
          </>
        ) : (
          <p className="mt-2 text-sm text-text-secondary">
            A playable preview is not available here. Review the exact edited
            file in Codex or Drive before approving. File checks do not replace
            watching the edit.
          </p>
        )}
        {duration && (
          <p className="mt-2 text-sm text-text-muted">Length: {duration}</p>
        )}
      </div>
      <div className="rounded-xl border border-current/10 p-4">
        <h3 className="font-heading font-bold">Training destination</h3>
        <p className="mt-2 break-words text-sm">
          {text(destination.title) ||
            "Destination module has not been checked."}
        </p>
        <p className="mt-1 text-sm text-text-secondary">
          {payload.mode === "append"
            ? "Adds the lesson to the end of this module. Clients who have it will see the lesson straight away. You can move it to another module later."
            : published
              ? "Add the lesson and publish its dedicated module."
              : "Add the lesson as an unpublished draft."}
        </p>
        <details className="mt-2 text-xs text-text-muted">
          <summary className="cursor-pointer">Module reference</summary>
          <p className="mt-1 break-all">
            {text(payload.module_id) || "Not recorded"}
          </p>
        </details>
      </div>
      <div className="rounded-xl border border-current/10 p-4">
        <h3 className="mb-3 font-heading font-bold">Lesson summary</h3>
        {text(payload.summary_md) ? (
          <div className="break-words text-sm">
            <MarkdownPreview text={text(payload.summary_md)} />
          </div>
        ) : (
          <p className="text-sm text-text-muted">No summary was included.</p>
        )}
      </div>
      <div className="rounded-xl border border-current/10 p-4">
        <h3 className="mb-3 font-heading font-bold">Workbook</h3>
        {workbookPdfPath(payload) ? (
          <>
            <iframe
              src={`/api/admin/ops/lesson-media/workbook?path=${encodeURIComponent(workbookPdfPath(payload))}#navpanes=0&view=FitH`}
              title="Workbook PDF"
              className="h-[560px] w-full rounded-lg border border-current/10 bg-white"
            />
            <a
              href={`/api/admin/ops/lesson-media/workbook?path=${encodeURIComponent(workbookPdfPath(payload))}`}
              className="mt-2 inline-block text-sm text-accent-bright underline"
              target="_blank"
              rel="noreferrer"
            >
              Open the workbook PDF
            </a>
            <p className="mt-1 text-xs text-text-muted">
              This PDF is attached to the lesson when it is added to Training.
            </p>
          </>
        ) : text(payload.workbook_md) ? (
          <div className="break-words text-sm">
            <MarkdownPreview text={text(payload.workbook_md)} />
          </div>
        ) : (
          <p className="text-sm text-text-muted">No workbook was included.</p>
        )}
      </div>
    </div>
  );
}

export function ActionResults({
  items,
  artifact,
}: {
  items: ArtifactItem[];
  artifact: OpsArtifact;
}) {
  const posts = Array.isArray(artifact.payload.posts)
    ? artifact.payload.posts
    : [];
  return (
    <section
      className="mt-6 border-t border-current/10 pt-5"
      aria-label="Saved action results"
    >
      <h3 className="font-heading font-bold">Saved results</h3>
      {!items.length ? (
        <p className="mt-2 text-sm text-text-muted">
          No action results have been recorded.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {items.map((item) => {
            const postIndex = posts.findIndex(
              (post) => object(post).post_id === item.item_key,
            );
            const post = posts[postIndex];
            const caption = text(object(post).caption);
            const receipt = object(item.receipt);
            const providerId = text(
              receipt.provider_id ||
                receipt.provider_post_id ||
                receipt.content_id,
            );
            const resultUrl = safeUrl(
              receipt.admin_url || receipt.training_url || receipt.url,
            );
            return (
              <div
                key={item.id}
                className="rounded-xl border border-current/10 p-3"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <strong className="text-sm">
                    {artifact.kind === "lesson"
                      ? "Lesson"
                      : contentPostLabel(artifact.payload, item.item_key)}
                  </strong>
                  <span
                    className={`rounded-lg px-2 py-1 text-xs ${statusClass(item.status)}`}
                  >
                    {itemStatuses[item.status]}
                  </span>
                </div>
                {caption && (
                  <p className="mt-2 line-clamp-2 whitespace-pre-wrap break-words text-xs text-text-secondary">
                    {caption}
                  </p>
                )}
                {item.error && (
                  <p className="mt-2 break-words text-sm text-amber-600">
                    {item.error}
                  </p>
                )}
                {item.finished_at && (
                  <p className="mt-2 text-xs text-text-muted">
                    Recorded {date(item.finished_at)}
                  </p>
                )}
                {providerId && <details className="mt-2 text-xs text-text-muted">
                  <summary className="cursor-pointer">Saved reference</summary>
                  <p className="mt-2 break-all">{providerId}</p>
                </details>}
                {resultUrl && (
                  <a
                    href={resultUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-sm text-accent-bright underline"
                  >
                    Open saved result
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
