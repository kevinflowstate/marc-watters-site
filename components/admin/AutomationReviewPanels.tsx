"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import MarkdownPreview from "@/components/ops/MarkdownPreview";
import PrivateContentImage from "@/components/admin/PrivateContentImage";
import type {
  ArtifactItem,
  JsonValue,
  OpsArtifact,
} from "@/lib/ops/action-types";
import { bundledContentPreview } from "@/lib/ops/content-preview-assets";
import type { ContentPack } from "@/lib/ops/content-pack";
import type { PaymentAttempt, PaymentCase } from "@/lib/ops/payment-policy";
import {
  paymentAttemptDeliveryLabel,
  paymentInvoiceSourceUrl,
  paymentReminderSummary,
  paymentNextStep,
  type paymentHumanHandoff,
} from "@/lib/ops/payment-display";

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
  remindersEnabled: boolean | null;
  focusedCaseId?: string | null;
}) {
  const [showSettled, setShowSettled] = useState(false);
  const visible = showSettled
    ? cases
    : cases.filter(
        (payment) =>
          !["paid", "void", "cancelled"].includes(payment.state) ||
          payment.id === focusedCaseId,
      );
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
            See which invoice needs checking, what reminders are recorded and
            when Eimear takes over. A delivered reminder does not mean the
            invoice has been paid.
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
      {remindersEnabled === false && (
        <p className="mt-4 rounded-xl bg-accent/5 p-3 text-sm text-text-secondary">
          Automatic reminders are off. Planned dates below explain the agreed
          timing; they are not scheduled sends. This page does not send
          messages.
        </p>
      )}
      {remindersEnabled === null && <p role="status" className="mt-4 rounded-xl bg-amber-500/10 p-3 text-sm text-text-secondary">
        Reminder settings have not been confirmed. Refresh this page before relying on the planned dates. This page does not send messages.
      </p>}
      {!visible.length ? (
        <p className="v2-surface mt-4 p-6 text-sm text-text-muted">
          No {showSettled ? "payment cases" : "open payment cases"} are recorded
          in this view. This does not confirm that every payment account has
          been checked.
        </p>
      ) : (
        <div className="mt-4 grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((payment) => (
            <PaymentReviewCard
              key={payment.id}
              payment={payment}
              focused={payment.id === focusedCaseId}
              remindersEnabled={remindersEnabled}
            />
          ))}
        </div>
      )}
    </section>
  );
}

type PaymentDetail = {
  payment_case: PaymentCase;
  human_followup?: ReturnType<typeof paymentHumanHandoff>;
  attempts: PaymentAttempt[];
  events: {
    id: string;
    source: string;
    event_type: string;
    occurred_at: string;
    created_at: string;
  }[];
};
const paymentLabels: Record<PaymentCase["state"], string> = {
  unpaid: "Unpaid",
  paid: "Paid",
  void: "Invoice voided",
  uncollectible: "Needs a decision",
  paused: "Paused",
  cancelled: "Cancelled",
  unknown: "Payment status needs checking",
};
function PaymentReviewCard({
  payment,
  focused,
  remindersEnabled,
}: {
  payment: PaymentCase;
  focused: boolean;
  remindersEnabled: boolean | null;
}) {
  const [expanded, setExpanded] = useState(focused);
  const [detail, setDetail] = useState<PaymentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (focused) setExpanded(true);
  }, [focused]);
  useEffect(() => {
    setDetail(null);
    setError("");
    if (!expanded) return;
    const controller = new AbortController();
    setLoading(true);
    async function load() {
      try {
        const response = await fetch(
          `/api/admin/ops/payment-cases/${payment.id}`,
          { cache: "no-store", signal: controller.signal },
        );
        const result = await response.json();
        if (
          !response.ok ||
          result.payment_case?.id !== payment.id ||
          !Array.isArray(result.attempts) ||
          !Array.isArray(result.events)
        )
          throw new Error(
            "The saved reminder history could not be checked. No next send should be assumed.",
          );
        if (!controller.signal.aborted) setDetail(result);
      } catch {
        if (!controller.signal.aborted)
          setError(
            "The saved reminder history could not be checked. No next send should be assumed.",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [payment.id, payment.updated_at, expanded, refresh]);
  const current = detail?.payment_case || payment;
  const plan = paymentNextStep(current, detail?.attempts ?? null);
  const sourceUrl = paymentInvoiceSourceUrl(current);
  const invoiceUrl = safeUrl(current.hosted_invoice_url, false);
  const safeInvoice =
    invoiceUrl && new URL(invoiceUrl).hostname === "invoice.stripe.com"
      ? invoiceUrl
      : null;
  return (
    <article
      id={`payment-case-${payment.id}`}
      tabIndex={-1}
      className={`v2-surface min-w-0 scroll-mt-6 p-5 focus-visible:outline-2 focus-visible:outline-accent ${focused ? "ring-2 ring-accent/50" : ""}`}
    >
      <div className="flex flex-wrap justify-between gap-2">
        <h3 className="min-w-0 break-words font-heading font-bold">
          {current.customer_name ||
            current.contact_email ||
            "Client not matched"}
        </h3>
        <span
          className={`rounded-lg px-2 py-1 text-xs ${statusClass(current.state)}`}
        >
          {paymentLabels[current.state]}
        </span>
      </div>
      <p className="mt-3 text-xl font-semibold">{paymentAmount(current)}</p>
      <p className="mt-2 break-words text-sm text-text-secondary">
        {current.invoice_number ? `Invoice: ${current.invoice_number}` : "Invoice number not recorded"}
      </p>
      <p className="mt-2 text-sm text-text-secondary">
        Payment account name needs confirming.{sourceUrl ? " Check the invoice source below." : " Eimear needs to confirm the invoice source."}
      </p>
      <p className="mt-2 text-xs text-text-muted">
        Payment last checked: {date(current.source_verified_at)}
        {current.source_verified_at ? " (London time)" : ""}
      </p>
      <p className="mt-3 text-sm text-text-secondary">
        {paymentReminderSummary(current, detail?.attempts ?? null)}
      </p>
      <p className="mt-1 text-xs text-text-muted">
        Reminders recorded: {current.reminder_count} of 2
      </p>
      <div
        className={`mt-4 rounded-xl p-3 text-sm ${["review", "stopped"].includes(plan.kind) ? "bg-amber-500/10" : "bg-accent/5"}`}
      >
        <p className="mb-2 text-xs font-semibold text-text-muted">Next action for Eimear</p>
        <h4 className="font-semibold">{plan.title}</h4>
        <p className="mt-2 text-text-secondary">{plan.detail}</p>
        {plan.planned_at && (
          <>
            <p className="mt-3 font-semibold">
              {date(plan.planned_at)} London time
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              {remindersEnabled === null
                ? "Reminder settings have not been confirmed."
                : !remindersEnabled
                ? "Sending is off — no reminder is queued here."
                : "Planned timing only — this is not confirmation that a send is scheduled."}
              {plan.overdue
                ? " The planned time has passed; check the current case before taking action."
                : ""}
            </p>
          </>
        )}
        {sourceUrl && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center text-sm text-accent-bright underline"
          >
            Check invoice in Stripe
          </a>
        )}
      </div>
      {current.task_id && (
        <p className="mt-2 text-xs leading-5 text-text-muted">
          Completing Eimear’s task records her work. It does not send a reminder or mark the invoice as paid.
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          className="min-h-11 text-sm font-semibold text-accent-bright underline"
          aria-expanded={expanded}
          aria-controls={`payment-details-${payment.id}`}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Hide reminder details" : "Check reminder details"}
        </button>
        {current.task_id && (
          <Link
            className="inline-flex min-h-11 items-center text-sm text-accent-bright underline"
            href={`/admin/work?task=${encodeURIComponent(current.task_id)}`}
          >
            Open Eimear’s task
          </Link>
        )}
        {safeInvoice && (
          <a
            href={safeInvoice}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center text-sm text-accent-bright underline"
          >
            View invoice
          </a>
        )}
      </div>
      {expanded && (
        <section
          id={`payment-details-${payment.id}`}
          aria-label="Reminder details"
          className="mt-3 border-t border-current/10 pt-4"
        >
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold">Saved reminder history</h4>
            <button
              className="min-h-11 text-xs text-accent-bright underline"
              disabled={loading}
              onClick={() => setRefresh((value) => value + 1)}
            >
              Refresh history
            </button>
          </div>
          {loading && (
            <p role="status" className="mt-2 text-sm text-text-muted">
              Checking saved records…
            </p>
          )}
          {error && (
            <p role="alert" className="mt-2 text-sm text-amber-700">
              {error}
            </p>
          )}
          {detail && !loading && (
            <>
              {detail.human_followup && (
                <div className="mb-4 rounded-xl bg-accent/5 p-4 text-sm">
                  <h4 className="font-bold">{detail.human_followup.title}</h4>
                  <p className="mt-2 text-text-secondary">{detail.human_followup.summary}</p>
                  <ol className="mt-3 list-decimal space-y-2 pl-5 text-text-secondary">
                    {detail.human_followup.steps.map((step, index) => <li key={index}>{step}</li>)}
                  </ol>
                </div>
              )}
              {!detail.attempts.length ? (
                <p className="mt-2 text-sm text-text-secondary">
                  No send attempts are recorded for this invoice.
                </p>
              ) : (
                <ol className="mt-2 space-y-3">
                  {detail.attempts.map((attempt) => (
                    <li
                      key={attempt.id}
                      className="rounded-lg border border-current/10 p-3 text-sm"
                    >
                      <p className="font-semibold">
                        {attempt.step_key === "first"
                          ? "First reminder"
                          : attempt.step_key === "second"
                            ? "One follow-up"
                            : "Reminder attempt"}
                      </p>
                      <p className="mt-1 text-text-secondary">
                        {paymentAttemptDeliveryLabel(attempt)}
                      </p>
                      <p className="mt-2 text-xs text-text-muted">
                        Attempt recorded: {date(attempt.created_at)}
                      </p>
                      <p className="mt-1 text-xs text-text-muted">
                        Confirmed send:{" "}
                        {attempt.receipt_verified
                          ? date(attempt.verified_sent_at)
                          : "Not confirmed"}
                      </p>
                      {attempt.provider_message_id && (
                        <p className="mt-1 break-all text-xs text-text-muted">
                          Message reference: {attempt.provider_message_id}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
              <p className="mt-3 text-xs leading-5 text-text-muted">
                Agreed plan: first reminder on the next weekday, one follow-up
                three calendar days after the confirmed first send, then Eimear.
                Weekends move to Monday at 09:00 London time. Bank holidays are
                not yet accounted for.
              </p>
            </>
          )}
        </section>
      )}
      <details className="mt-4 text-xs text-text-muted">
        <summary className="cursor-pointer">Invoice source</summary>
        <p className="mt-2 break-all">{current.invoice_id}</p>
        <p className="mt-1 break-all">Account: {current.stripe_account_id}</p>
        <p className="mt-1">First failure: {date(current.first_failed_at)}</p>
      </details>
    </article>
  );
}
