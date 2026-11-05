"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import MarkdownPreview from "@/components/ops/MarkdownPreview";
import type {
  ArtifactItem,
  JsonValue,
  OpsArtifact,
} from "@/lib/ops/action-types";
import type { ContentPack } from "@/lib/ops/content-pack";
import type { PaymentCase } from "@/lib/ops/payment-policy";

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
  enabled: boolean;
}) {
  return (
    <div className="v2-surface flex min-w-0 flex-wrap items-center justify-between gap-2 px-4 py-3">
      <span className="text-sm font-semibold">{title}</span>
      <span
        className={`rounded-lg px-2 py-1 text-xs font-semibold ${enabled ? "bg-emerald-500/10 text-emerald-600" : "bg-current/5 text-text-muted"}`}
      >
        {enabled ? "Enabled" : "Not enabled"}
      </span>
    </div>
  );
}

export function ContentReview({
  payload,
  showMedia,
}: {
  payload: Record<string, JsonValue>;
  showMedia: boolean;
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
                  const url = safeMediaUrl(image.url);
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
          {published
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
        {text(payload.workbook_md) ? (
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
          {items.map((item, index) => {
            const post = posts.find(
              (post) => object(post).post_id === item.item_key,
            );
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
                      : `Post ${index + 1}`}
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
                {providerId && (
                  <p className="mt-2 break-all text-xs text-text-muted">
                    Saved reference: {providerId}
                  </p>
                )}
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

function paymentAmount(payment: PaymentCase) {
  if (payment.amount_minor === null || !payment.currency)
    return "Amount not recorded";
  try {
    const formatter = new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: payment.currency.toUpperCase(),
    });
    const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
    return formatter.format(payment.amount_minor / 10 ** digits);
  } catch {
    return "Amount could not be displayed";
  }
}
export function PaymentReviews({
  cases,
  remindersEnabled,
  focusedCaseId,
}: {
  cases: PaymentCase[];
  remindersEnabled: boolean;
  focusedCaseId?: string | null;
}) {
  const [showSettled, setShowSettled] = useState(false);
  const settled = (payment: PaymentCase) =>
    ["paid", "void", "cancelled"].includes(payment.state);
  const visible = showSettled
    ? cases
    : cases.filter(
        (payment) => !settled(payment) || payment.id === focusedCaseId,
      );
  const paymentLabels: Record<PaymentCase["state"], string> = {
    unpaid: "Unpaid",
    paid: "Paid",
    void: "Invoice voided",
    uncollectible: "Needs a decision",
    paused: "Paused",
    cancelled: "Cancelled",
    unknown: "Payment status needs checking",
  };
  const deliveryLabels: Record<string, string> = {
    reserved: "Reminder reserved · not sent",
    requested: "Send requested · delivery not confirmed",
    sent: "Sent · delivery not confirmed",
    delivered: "Delivery confirmed",
    failed: "Reminder failed",
    unknown: "Reminder result needs checking",
  };
  return (
    <section className="mt-8" aria-labelledby="payment-review-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="v2-eyebrow">Client follow-up</div>
          <h2
            id="payment-review-title"
            className="mt-2 font-heading text-2xl font-bold"
          >
            Payments needing attention
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-text-secondary">
            See the invoice status and any recorded reminder result. A delivered
            message does not mean the invoice has been paid.
          </p>
        </div>
        <button
          className="v2-button-secondary"
          aria-pressed={showSettled}
          onClick={() => setShowSettled((value) => !value)}
        >
          {showSettled ? "Show open cases" : "Include settled cases"}
        </button>
      </div>
      {!remindersEnabled && (
        <p className="mt-4 rounded-xl bg-accent/5 p-3 text-sm text-text-secondary">
          Automatic reminders are not enabled here. These records show the
          latest saved checks; this page does not send messages.
        </p>
      )}
      {!visible.length ? (
        <p className="v2-surface mt-4 p-6 text-sm text-text-muted">
          No {showSettled ? "payment cases" : "open payment cases"} are recorded
          in this view. This does not confirm that every payment account has
          been checked.
        </p>
      ) : (
        <div className="mt-4 grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((payment) => {
            const invoiceUrl = safeUrl(payment.hosted_invoice_url, false);
            const safeInvoice =
              invoiceUrl &&
              new URL(invoiceUrl).hostname === "invoice.stripe.com"
                ? invoiceUrl
                : null;
            const stopped =
              payment.manual_pause ||
              payment.reply_needs_human ||
              payment.contact_dnd;
            return (
              <article
                key={payment.id}
                id={`payment-case-${payment.id}`}
                tabIndex={-1}
                className={`v2-surface min-w-0 scroll-mt-6 p-5 focus-visible:outline-2 focus-visible:outline-accent ${payment.id === focusedCaseId ? "ring-2 ring-accent/50" : ""}`}
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <h3 className="min-w-0 break-words font-heading font-bold">
                    {payment.customer_name ||
                      payment.contact_email ||
                      "Client not matched"}
                  </h3>
                  <span
                    className={`rounded-lg px-2 py-1 text-xs ${statusClass(payment.state)}`}
                  >
                    {paymentLabels[payment.state]}
                  </span>
                </div>
                <p className="mt-3 text-xl font-semibold">
                  {paymentAmount(payment)}
                </p>
                <p className="mt-2 text-xs text-text-muted">
                  Payment last checked: {date(payment.source_verified_at)}
                </p>
                <p className="mt-3 text-sm text-text-secondary">
                  {payment.latest_delivery
                    ? deliveryLabels[payment.latest_delivery] ||
                      "Reminder status needs checking"
                    : "No reminder result recorded"}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  Verified reminders: {payment.reminder_count}
                </p>
                {stopped && (
                  <p className="mt-3 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-600">
                    {payment.contact_dnd
                      ? "Messages stopped: do not disturb is set."
                      : payment.reply_needs_human
                        ? "The client has replied. Eimear needs to review before another reminder."
                        : "Automatic follow-up is paused."}
                  </p>
                )}
                {!stopped && !settled(payment) && !payment.whatsapp_opt_in && (
                  <p className="mt-3 text-xs text-text-secondary">
                    WhatsApp permission has not been verified for this case.
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-3">
                  {payment.task_id && (
                    <Link
                      className="text-sm text-accent-bright underline"
                      href={`/admin/work?task=${encodeURIComponent(payment.task_id)}`}
                    >
                      Open Eimear’s task
                    </Link>
                  )}
                  {safeInvoice && (
                    <a
                      href={safeInvoice}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-accent-bright underline"
                    >
                      View invoice
                    </a>
                  )}
                </div>
                <details className="mt-4 text-xs text-text-muted">
                  <summary className="cursor-pointer">
                    Invoice reference
                  </summary>
                  <p className="mt-2 break-all">{payment.invoice_id}</p>
                  <p className="mt-1 break-all">
                    Account: {payment.stripe_account_id}
                  </p>
                  <p className="mt-1">
                    First failure: {date(payment.first_failed_at)}
                  </p>
                </details>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
