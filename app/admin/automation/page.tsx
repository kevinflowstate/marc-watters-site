"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActionAvailability,
  ContentReview,
  LessonReview,
  ActionResults,
  PaymentReviews,
  date,
  text,
  statusClass,
} from "@/components/admin/AutomationReviewPanels";
import type {
  ArtifactDecision,
  ArtifactItem,
  OpsArtifact,
} from "@/lib/ops/action-types";
import type { PaymentCase } from "@/lib/ops/payment-policy";

type Controls = {
  content_scheduling: boolean;
  lesson_publication: boolean;
  payment_reminders: boolean;
};
type Summary = {
  artifacts: OpsArtifact[];
  payments: PaymentCase[];
  controls: Controls;
};
type Detail = {
  artifact: OpsArtifact;
  items: ArtifactItem[];
  decisions: ArtifactDecision[];
  preview: Record<string, unknown> | null;
};
type SchedulingCheck = {
  post_id: string;
  platform: string;
  account_id: string;
  account_name?: string;
  schedule_label: string;
  status: "ready" | "blocked" | "already_scheduled" | "needs_attention";
  summary: string;
  blockers: string[];
  connection_ready: boolean;
};
type SchedulingSetup = {
  dry_run: true;
  checked_at: string;
  ready: boolean;
  summary: string;
  scheduling_enabled: boolean;
  approval_saved: boolean;
  checks: SchedulingCheck[];
  has_more: boolean;
  remaining_post_ids: string[];
};
class PreparedWorkError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}
const emptyControls: Controls = {
  content_scheduling: false,
  lesson_publication: false,
  payment_reminders: false,
};
const statuses: Record<OpsArtifact["status"], string> = {
  draft: "Needs review",
  approved: "Approved · action pending",
  rejected: "Changes requested",
  superseded: "Replaced by a newer version",
  running: "Action in progress",
  completed: "Completed",
  needs_attention: "Needs checking",
};
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { cache: "no-store", ...init });
  const result = await response.json();
  if (!response.ok)
    throw new PreparedWorkError(
      typeof result.error === "string"
        ? result.error
        : "The request could not be completed. Please try again.",
      response.status,
    );
  return result as T;
}
export default function AutomationPage() {
  const [summary, setSummary] = useState<Summary>({
    artifacts: [],
    payments: [],
    controls: emptyControls,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<OpsArtifact | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [actionBusy, setBusy] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(false);
  const busy = actionBusy || checkingSetup;
  const [schedulingSetup, setSchedulingSetup] = useState<SchedulingSetup | null>(null);
  const [setupError, setSetupError] = useState("");
  const setupRequest = useRef(0);
  const setupRunning = useRef(false);
  const setupAbort = useRef<AbortController | null>(null);
  const [notice, setNotice] = useState("");
  const [note, setNote] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [filter, setFilter] = useState("All prepared work");
  const selection = useRef(0);
  const mounted = useRef(true);
  const [progress, setProgress] = useState<{
    completed: number;
    total: number;
  } | null>(null);
  const detailPanel = useRef<HTMLElement>(null);
  const openedLink = useRef(false);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const openedPayment = useRef<string | null>(null);

  const loadDetail = useCallback(
    async (artifact: OpsArtifact, scroll = false) => {
      const currentSelection = ++selection.current;
      setupAbort.current?.abort();
      setupAbort.current = null;
      setupRequest.current += 1;
      setupRunning.current = false;
      setCheckingSetup(false);
      setSchedulingSetup(null);
      setSetupError("");
      setSelected(artifact);
      setDetail(null);
      setDetailError("");
      setDetailLoading(true);
      setReviewed(false);
      setNote("");
      setNotice("");
      if (scroll)
        detailPanel.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      try {
        const result = await request<Detail>(
          `/api/admin/ops/artifacts/${artifact.id}`,
        );
        if (selection.current !== currentSelection) return;
        setDetail(result);
        setSelected(result.artifact);
      } catch (e) {
        if (selection.current === currentSelection)
          setDetailError(
            e instanceof Error ? e.message : "Could not check this version.",
          );
      } finally {
        if (selection.current === currentSelection) setDetailLoading(false);
      }
    },
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await request<Summary>("/api/admin/ops/automation");
      setSummary(result);
      if (!openedLink.current) {
        openedLink.current = true;
        const id = new URLSearchParams(window.location.search).get("artifact");
        const match = result.artifacts.find((artifact) => artifact.id === id);
        if (match) void loadDetail(match);
        const payment = new URLSearchParams(window.location.search).get(
          "payment",
        );
        if (result.payments.some((item) => item.id === payment))
          setPaymentId(payment);
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not load prepared work.",
      );
    } finally {
      setLoading(false);
    }
  }, [loadDetail]);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
      selection.current += 1;
      setupAbort.current?.abort();
      setupRequest.current += 1;
    };
  }, [load]);

  useEffect(() => {
    if (loading || !paymentId || openedPayment.current === paymentId) return;
    const target = document.getElementById(`payment-case-${paymentId}`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      target.focus({ preventScroll: true });
      openedPayment.current = paymentId;
    }
  }, [loading, paymentId, summary.payments]);

  async function action(
    kind: "decision" | "execute",
    decision?: "approved" | "rejected",
  ) {
    if (!detail || busy || setupRunning.current) return;
    const displayed = detail.artifact;
    const contentRun = kind === "execute" && displayed.kind === "content";
    const total = displayed.item_keys.length;
    let completed = detail.items.filter(
      (item) => item.status === "succeeded",
    ).length;
    let result: {
      artifact?: OpsArtifact;
      items?: ArtifactItem[];
      continuation_required?: boolean;
      in_progress?: boolean;
    } = {};
    setBusy(true);
    setDetailError("");
    setNotice("");
    setProgress(contentRun ? { completed, total } : null);
    try {
      for (let turn = 0; turn < (contentRun ? 50 : 1); turn++) {
        result = await request(
          `/api/admin/ops/artifacts/${displayed.id}/${kind}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              version: displayed.version,
              manifest_hash: displayed.manifest_hash,
              ...(kind === "decision"
                ? { decision, ...(note.trim() ? { note: note.trim() } : {}) }
                : {}),
            }),
          },
        );
        if (!mounted.current) return;
        if (!contentRun) break;
        if (
          !result.artifact ||
          !Array.isArray(result.items) ||
          result.artifact.id !== displayed.id ||
          result.artifact.version !== displayed.version ||
          result.artifact.manifest_hash !== displayed.manifest_hash
        )
          throw Error(
            "The saved result could not be matched to this version. Refresh before continuing.",
          );
        setDetail({
          artifact: result.artifact,
          items: result.items,
          decisions: detail.decisions,
          preview: detail.preview,
        });
        setSelected(result.artifact);
        const updatedCount = result.items.filter(
          (item) => item.status === "succeeded",
        ).length;
        setProgress({ completed: updatedCount, total });
        const needsChecking = result.items.some((item) =>
          ["failed", "unknown"].includes(item.status),
        );
        const stillRunning = result.items.some(
          (item) => item.status === "running",
        );
        if (
          needsChecking ||
          stillRunning ||
          result.in_progress ||
          !result.continuation_required
        ) {
          completed = updatedCount;
          break;
        }
        if (updatedCount <= completed)
          throw Error(
            "No new completed post was confirmed. Refresh the saved results before continuing.",
          );
        completed = updatedCount;
        if (turn === 49)
          throw Error(
            "The remaining posts are saved as pending. Refresh, then continue from the saved progress.",
          );
      }
      await loadDetail(displayed);
      await load();
      setNotice(
        kind === "execute"
          ? contentRun
            ? `${completed} of ${total} posts have a confirmed scheduling result. Check each saved result below. Any remaining or uncertain item stays visible.`
            : "The action has been checked. See the saved result below."
          : decision === "approved"
            ? "Approval saved for this version. The action is a separate step."
            : "Changes requested. A revised version will need a new review.",
      );
    } catch (e) {
      if (mounted.current) {
        setDetailError(
          e instanceof Error
            ? e.message
            : "Could not save. Reload this version before trying again.",
        );
        setReviewed(false);
      }
    } finally {
      if (mounted.current) {
        setBusy(false);
        setProgress(null);
      }
    }
  }

  async function checkSchedulingSetup(postIds?: string[]) {
    if (!detail || detail.artifact.kind !== "content" || busy || setupRunning.current || detailLoading || detailError)
      return;
    const displayed = detail.artifact;
    const currentSelection = selection.current;
    const run = ++setupRequest.current;
    const previous = postIds ? schedulingSetup : null;
    const controller = new AbortController();
    setupAbort.current = controller;
    setupRunning.current = true;
    setCheckingSetup(true);
    setSetupError("");
    if (!postIds) setSchedulingSetup(null);
    try {
      const checked = await request<SchedulingSetup>(
        `/api/admin/ops/artifacts/${displayed.id}/preflight`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            version: displayed.version,
            manifest_hash: displayed.manifest_hash,
            ...(postIds ? { post_ids: postIds.slice(0, 5) } : {}),
          }),
        },
      );
      if (!mounted.current || selection.current !== currentSelection || setupRequest.current !== run)
        return;
      if (
        checked.dry_run !== true ||
        !Array.isArray(checked.checks) || checked.checks.length > 5 ||
        !checked.checks.every((check) => displayed.item_keys.includes(check.post_id)) ||
        !Array.isArray(checked.remaining_post_ids) ||
        !checked.remaining_post_ids.every((id) => displayed.item_keys.includes(id))
      ) throw Error("The scheduling checks could not be matched to this version. Refresh and try again.");
      const checks = new Map((previous?.checks || []).map((check) => [check.post_id, check]));
      checked.checks.forEach((check) => checks.set(check.post_id, check));
      const remaining = [...new Set(checked.remaining_post_ids)].filter((id) => !checks.has(id));
      const combined = [...checks.values()];
      setSchedulingSetup({
        ...checked,
        checks: combined,
        remaining_post_ids: remaining,
        has_more: remaining.length > 0,
        ready: remaining.length === 0 && combined.length > 0 && combined.every((check) => check.status === "ready"),
      });
    } catch (e) {
      if (!mounted.current || selection.current !== currentSelection || setupRequest.current !== run)
        return;
      setSchedulingSetup(null);
      if (e instanceof PreparedWorkError && e.status === 409) {
        setDetailError("This saved work changed while the checks were running. Refresh it before checking or approving again.");
        setReviewed(false);
      } else if (!controller.signal.aborted) {
        setSetupError(e instanceof Error ? e.message : "Couldn’t check the scheduling setup. Please try again.");
      }
    } finally {
      if (setupRequest.current === run) {
        setupAbort.current = null;
        setupRunning.current = false;
        if (mounted.current) setCheckingSetup(false);
      }
    }
  }

  const current = detail?.artifact ?? selected;
  const actionEnabled =
    current?.kind === "content"
      ? summary.controls.content_scheduling
      : summary.controls.lesson_publication;
  const validationError = text(detail?.preview?.validation_error);
  const canContinue =
    current?.kind === "content" &&
    current.status === "running" &&
    Boolean(detail?.items.some((item) => item.status === "pending")) &&
    !detail?.items.some((item) =>
      ["running", "failed", "unknown"].includes(item.status),
    );
  const filters = [
    "All prepared work",
    "Needs review",
    "Approved",
    "Needs checking",
    "Completed",
  ];
  const visible = summary.artifacts.filter(
    (artifact) =>
      filter === "All prepared work" ||
      (filter === "Needs review" && artifact.status === "draft") ||
      (filter === "Approved" && artifact.status === "approved") ||
      (filter === "Needs checking" && artifact.status === "needs_attention") ||
      (filter === "Completed" && artifact.status === "completed"),
  );
  const pending = summary.artifacts.filter(
    (artifact) => artifact.status === "draft",
  ).length;

  return (
    <div className="mx-auto max-w-7xl pb-20 lg:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="v2-eyebrow">Operations</div>
          <h1 className="v2-page-title mt-2">Prepared work</h1>
          <p className="mt-2 max-w-2xl text-text-secondary">
            Review what Codex has prepared, approve the exact version and see
            what happened next.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="v2-button-secondary" href="/admin/work">
            Tasks & approvals
          </Link>
          <button
            className="v2-button-secondary"
            disabled={loading || busy}
            onClick={() => {
              void load();
              if (current) void loadDetail(current);
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      <div
        className="my-6 grid gap-3 sm:grid-cols-3"
        aria-label="Action availability"
      >
        <ActionAvailability
          title="Content scheduling"
          enabled={summary.controls.content_scheduling}
        />
        <ActionAvailability
          title="Lesson publication"
          enabled={summary.controls.lesson_publication}
        />
        <ActionAvailability
          title="Payment reminders"
          enabled={summary.controls.payment_reminders}
        />
      </div>
      {!loading &&
        !summary.controls.content_scheduling &&
        !summary.controls.lesson_publication && (
          <p className="v2-surface mb-6 p-4 text-sm text-text-secondary">
            Scheduling and lesson publication are not enabled here yet. You can
            review prepared work and save decisions. Nothing is sent or
            published by approving alone.
          </p>
        )}
      {error && (
        <p
          role="alert"
          className="mb-5 rounded-xl bg-amber-500/10 p-4 text-amber-600"
        >
          {error}
        </p>
      )}
      {loading && !summary.artifacts.length ? (
        <p role="status" className="py-10 text-text-secondary">
          Loading prepared work…
        </p>
      ) : (
        <>
          <div
            className="mb-4 flex flex-wrap gap-2"
            role="group"
            aria-label="Prepared work filters"
          >
            {filters.map((name) => (
              <button
                key={name}
                aria-pressed={filter === name}
                onClick={() => setFilter(name)}
                className={`min-h-11 rounded-xl px-4 py-2 text-sm font-semibold ${filter === name ? "bg-accent text-white" : "v2-surface text-text-secondary"}`}
              >
                {name}
                {name === "Needs review" ? ` (${pending})` : ""}
              </button>
            ))}
          </div>
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(260px,0.75fr)_minmax(0,1.6fr)]">
            <section
              aria-label="Prepared items"
              className="v2-surface min-w-0 overflow-hidden"
            >
              {visible.length ? (
                <div className="max-h-[620px] divide-y divide-current/10 overflow-y-auto">
                  {visible.map((artifact) => (
                    <button
                      key={artifact.id}
                      disabled={busy}
                      aria-pressed={current?.id === artifact.id}
                      onClick={() => void loadDetail(artifact, true)}
                      className={`block w-full p-5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-accent ${current?.id === artifact.id ? "bg-accent/10" : "hover:bg-accent/5"}`}
                    >
                      <span className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold text-text-muted">
                          {artifact.kind === "content" ? "Content" : "Lesson"} ·
                          Version {artifact.version}
                        </span>
                        <span
                          className={`rounded-lg px-2 py-1 ${statusClass(artifact.status)}`}
                        >
                          {statuses[artifact.status]}
                        </span>
                      </span>
                      <strong className="block break-words font-heading text-base">
                        {artifact.title}
                      </strong>
                      <span className="mt-2 block text-xs text-text-muted">
                        Updated {date(artifact.updated_at)}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-6">
                  <h2 className="font-heading font-bold">
                    {summary.artifacts.length
                      ? "No work in this view"
                      : "Prepared work will appear here"}
                  </h2>
                  <p className="mt-2 text-sm text-text-secondary">
                    {summary.artifacts.length
                      ? "Choose another filter to see the other items."
                      : "When a content pack or lesson is submitted, you can review its saved version and track the action here."}
                  </p>
                </div>
              )}
            </section>

            <section
              ref={detailPanel}
              aria-labelledby="prepared-detail-title"
              className="v2-surface min-w-0 scroll-mt-6 overflow-hidden p-4 sm:p-6"
            >
              {!current ? (
                <div className="py-6">
                  <h2
                    id="prepared-detail-title"
                    className="font-heading text-xl font-bold"
                  >
                    Choose an item to review
                  </h2>
                  <p className="mt-2 text-text-secondary">
                    You’ll see the content, intended action and saved results
                    before making a decision.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                        {current.kind === "content"
                          ? "Weekly content"
                          : "Lesson"}{" "}
                        · Version {current.version}
                      </p>
                      <h2
                        id="prepared-detail-title"
                        className="mt-2 break-words font-heading text-xl font-bold"
                      >
                        {current.title}
                      </h2>
                    </div>
                    <span
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${statusClass(current.status)}`}
                    >
                      {statuses[current.status]}
                    </span>
                  </div>
                  <p className="my-4 text-sm text-text-secondary">
                    {current.kind === "content"
                      ? "Check the exact copy, images, dates and accounts below. Approval covers this saved pack only."
                      : "Check the finished video and its summary and workbook. Approval covers this saved lesson and destination only."}
                  </p>
                  {detail?.decisions
                    .filter(
                      (decision) =>
                        decision.artifact_id === current.id &&
                        decision.version === current.version &&
                        decision.manifest_hash === current.manifest_hash,
                    )
                    .map((decision) => (
                      <section
                        key={decision.id}
                        aria-label={`Saved review for version ${decision.version}`}
                        className="my-4 rounded-xl border border-current/10 bg-accent/5 p-4 text-sm"
                      >
                        <p className="font-semibold">
                          {decision.decision === "rejected"
                            ? "Changes requested"
                            : "Approval saved"}
                          {" · "}Version {decision.version}
                        </p>
                        <p className="mt-1 text-xs text-text-muted">
                          Saved {date(decision.created_at)}
                        </p>
                        {decision.note && (
                          <p className="mt-3 whitespace-pre-wrap break-words text-text-secondary">
                            {decision.note}
                          </p>
                        )}
                      </section>
                    ))}
                  {detailLoading && (
                    <p role="status" className="my-4 text-text-secondary">
                      Checking this saved version…
                    </p>
                  )}
                  {detailError && (
                    <p
                      role="alert"
                      className="my-4 rounded-xl bg-amber-500/10 p-4 text-sm text-amber-600"
                    >
                      {detailError}
                    </p>
                  )}
                  {progress && (
                    <div
                      role="status"
                      className="my-4 rounded-xl bg-accent/10 p-4 text-sm text-accent-bright"
                    >
                      <p className="font-semibold">
                        Scheduling progress: {progress.completed} of{" "}
                        {progress.total} posts confirmed
                      </p>
                      <p className="mt-2 text-text-secondary">
                        Keep this page open while the remaining posts are
                        processed. If you leave, reopen this item to check its
                        saved progress and continue. Completed posts will not be
                        repeated.
                      </p>
                    </div>
                  )}
                  {notice && (
                    <p
                      role="status"
                      className="my-4 rounded-xl bg-accent/10 p-4 text-sm text-accent-bright"
                    >
                      {notice}
                    </p>
                  )}
                  {validationError && (
                    <p
                      role="alert"
                      className="my-4 rounded-xl bg-amber-500/10 p-4 text-sm text-amber-600"
                    >
                      This version needs checking before another action:{" "}
                      {validationError}
                    </p>
                  )}
                  {current.kind === "content" && (
                    <section className="my-5 rounded-xl border border-current/10 p-4" aria-labelledby="scheduling-setup-title">
                      <h3 id="scheduling-setup-title" className="font-heading font-bold">Scheduling setup</h3>
                      <p className="mt-2 text-sm text-text-secondary">
                        Check the connected accounts, planned dates and image files. This does not approve or schedule any posts.
                      </p>
                      <button
                        type="button"
                        className="v2-button-secondary mt-3 disabled:opacity-50"
                        disabled={busy || !detail || detailLoading || Boolean(detailError || validationError)}
                        onClick={() => void checkSchedulingSetup()}
                      >
                        {checkingSetup ? "Checking scheduling setup…" : schedulingSetup ? "Check setup again" : "Check scheduling setup"}
                      </button>
                      {setupError && <p role="alert" className="mt-3 text-sm text-amber-600">{setupError}</p>}
                      {schedulingSetup && (
                        <div className="mt-4 space-y-4">
                          <div role="status" className="rounded-lg bg-accent/5 p-3 text-sm">
                            <p className="font-semibold">
                              {schedulingSetup.checks.length
                                ? `Setup checked for ${schedulingSetup.checks.length} ${schedulingSetup.checks.length === 1 ? "post" : "posts"}.`
                                : "There are no pending posts to check. See the saved results below."}
                            </p>
                            <p className="mt-1 text-text-secondary">Nothing was scheduled by this check.</p>
                            {!schedulingSetup.scheduling_enabled && <p className="mt-1 text-text-secondary">Scheduling is switched off.</p>}
                            {!schedulingSetup.approval_saved && <p className="mt-1 text-text-secondary">This version still needs approval.</p>}
                            <p className="mt-2 text-xs text-text-muted">Checked {date(schedulingSetup.checked_at)}. These checks cover pending posts only.</p>
                          </div>
                          <ol className="space-y-3" aria-label="Post setup checks">
                            {schedulingSetup.checks.map((check, index) => (
                              <li key={check.post_id} className="rounded-lg border border-current/10 p-3 text-sm">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <h4 className="font-semibold">Post {index + 1} · {check.platform.charAt(0).toUpperCase() + check.platform.slice(1)}</h4>
                                  <span className="text-xs font-semibold text-text-secondary">
                                    {check.status === "ready" ? "Setup ready"
                                      : check.status === "already_scheduled" ? "Already scheduled"
                                      : check.status === "needs_attention" ? "Needs checking" : "Steps still needed"}
                                  </span>
                                </div>
                                <p className="mt-2 text-text-secondary"><strong>Account:</strong> {check.account_name || "Account name not confirmed"}</p>
                                <p className="mt-1 text-text-secondary"><strong>Planned date:</strong> {check.schedule_label}</p>
                                {check.connection_ready ? (
                                  <p className="mt-2 text-text-secondary">Account, planned date and image files checked.</p>
                                ) : !check.blockers.includes(check.summary) && (
                                  <p className="mt-2 text-text-secondary">{check.summary}</p>
                                )}
                                {check.blockers.length > 0 && (
                                  <div className="mt-3">
                                    <p className="font-semibold">Still needed</p>
                                    <ul className="mt-1 list-disc space-y-1 pl-5 text-text-secondary">
                                      {check.blockers.map((blocker, i) => <li key={i}>{blocker}</li>)}
                                    </ul>
                                  </div>
                                )}
                              </li>
                            ))}
                          </ol>
                          {schedulingSetup.has_more && (
                            <div className="rounded-lg bg-amber-500/5 p-3 text-sm">
                              <p className="font-semibold">{schedulingSetup.remaining_post_ids.length} pending {schedulingSetup.remaining_post_ids.length === 1 ? "post still needs" : "posts still need"} checking.</p>
                              <button
                                type="button"
                                className="v2-button-secondary mt-3 disabled:opacity-50"
                                disabled={busy || detailLoading || Boolean(detailError)}
                                onClick={() => void checkSchedulingSetup(schedulingSetup.remaining_post_ids)}
                              >
                                Check {Math.min(5, schedulingSetup.remaining_post_ids.length)} remaining {Math.min(5, schedulingSetup.remaining_post_ids.length) === 1 ? "post" : "posts"}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </section>
                  )}
                  {current.kind === "content" ? (
                    <ContentReview
                      payload={current.payload}
                      showMedia={Boolean(detail?.preview) && !detailError}
                    />
                  ) : (
                    <LessonReview
                      payload={current.payload}
                      preview={detail?.preview ?? null}
                    />
                  )}
                  {detail?.preview && (
                    <p className="my-4 rounded-xl bg-accent/5 p-3 text-sm text-text-secondary">
                      Checking this item has not posted any content or
                      published a lesson.
                    </p>
                  )}
                  <details className="my-5 text-xs text-text-muted">
                    <summary className="cursor-pointer font-semibold">
                      Version details
                    </summary>
                    <p className="mt-2">Version {current.version}</p>
                    <p className="mt-1 break-all">
                      File fingerprint: {current.manifest_hash}
                    </p>
                    <p className="mt-1">Saved {date(current.created_at)}</p>
                    {current.approved_at && (
                      <p className="mt-1">
                        Approval saved {date(current.approved_at)}
                      </p>
                    )}
                  </details>

                  {current.status === "draft" && (
                    <div className="mt-5 border-t border-current/10 pt-5">
                      <label className="flex cursor-pointer items-start gap-3 text-sm">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 shrink-0 accent-accent"
                          checked={reviewed}
                          disabled={
                            busy ||
                            !detail ||
                            detailLoading ||
                            Boolean(detailError || validationError)
                          }
                          onChange={(e) => setReviewed(e.target.checked)}
                        />
                        <span>
                          {current.kind === "content"
                            ? "I have checked the copy, images, dates and destination accounts shown."
                            : "I have checked this exact edited video, summary and workbook."}
                        </span>
                      </label>
                      <label
                        className="mt-4 block text-sm font-semibold"
                        htmlFor="prepared-decision-note"
                      >
                        Review note{" "}
                        <span className="font-normal text-text-muted">
                          (required when requesting changes)
                        </span>
                      </label>
                      <textarea
                        id="prepared-decision-note"
                        value={note}
                        maxLength={5000}
                        disabled={busy}
                        onChange={(e) => setNote(e.target.value)}
                        rows={3}
                        className="mt-2 block w-full rounded-xl border border-current/15 bg-bg-secondary p-3 text-sm font-normal"
                        placeholder="What needs changing, or anything to keep in mind?"
                      />
                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          disabled={
                            busy ||
                            !reviewed ||
                            !detail ||
                            detailLoading ||
                            Boolean(detailError || validationError)
                          }
                          className="v2-button-primary disabled:opacity-50"
                          onClick={() => void action("decision", "approved")}
                        >
                          Approve this version
                        </button>
                        <button
                          disabled={
                            busy || !note.trim() || !detail || detailLoading
                          }
                          className="v2-button-secondary disabled:opacity-50"
                          onClick={() => void action("decision", "rejected")}
                        >
                          Request changes
                        </button>
                      </div>
                      <p className="mt-3 text-xs text-text-muted">
                        Approving records your decision. Scheduling or
                        publication happens in the separate action below.
                      </p>
                    </div>
                  )}
                  {current.status === "approved" && (
                    <div className="mt-5 border-t border-current/10 pt-5">
                      <h3 className="font-heading font-bold">
                        Ready for the next action
                      </h3>
                      <p className="mt-2 text-sm text-text-secondary">
                        {current.kind === "content"
                          ? "Schedule the approved posts for the dates shown. Each post gets its own result."
                          : text(current.payload.mode) === "draft"
                            ? "Add the approved lesson as a draft in Training. It will remain unpublished."
                            : "Add the approved lesson and publish its dedicated Training module."}
                      </p>
                      {!actionEnabled && (
                        <p className="mt-3 rounded-xl bg-amber-500/10 p-3 text-sm text-amber-600">
                          {current.kind === "content"
                            ? "Scheduling is not enabled here yet. Your approval is saved; no posts have been scheduled."
                            : "Lesson publication is not enabled here yet. Your approval is saved; the lesson has not been added by this action."}
                        </p>
                      )}
                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          disabled={
                            busy ||
                            !actionEnabled ||
                            !detail ||
                            detailLoading ||
                            Boolean(detailError || validationError)
                          }
                          onClick={() => void action("execute")}
                          className="v2-button-primary disabled:opacity-50"
                        >
                          {current.kind === "content"
                            ? "Schedule this week’s content"
                            : text(current.payload.mode) === "draft"
                              ? "Add lesson draft to Training"
                              : "Publish approved lesson"}
                        </button>
                        <button
                          disabled={busy || detailLoading}
                          className="v2-button-secondary"
                          onClick={() => void loadDetail(current)}
                        >
                          Check again
                        </button>
                      </div>
                    </div>
                  )}
                  {current.status === "rejected" && (
                    <p className="mt-5 rounded-xl bg-accent/5 p-4 text-sm text-text-secondary">
                      Changes have been requested. The revised version will
                      appear as a new review.
                    </p>
                  )}
                  {current.status === "needs_attention" && (
                    <p className="mt-5 rounded-xl bg-amber-500/10 p-4 text-sm text-amber-600">
                      One or more results need checking. Successful items will
                      not be repeated automatically. Check whether the uncertain
                      item went through before trying again.
                    </p>
                  )}
                  {current.status === "running" && (
                    <div className="mt-5 border-t border-current/10 pt-5">
                      <h3 className="font-heading font-bold">
                        Scheduling progress
                      </h3>
                      <p className="mt-2 text-sm text-text-secondary">
                        {canContinue
                          ? "You can continue with the remaining posts. Completed posts will not be sent again."
                          : "Check the saved results below. Refresh this version for the latest progress."}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-3">
                        {canContinue && (
                          <button
                            disabled={
                              busy ||
                              !actionEnabled ||
                              detailLoading ||
                              Boolean(detailError || validationError)
                            }
                            className="v2-button-primary disabled:opacity-50"
                            onClick={() => void action("execute")}
                          >
                            Continue scheduling remaining posts
                          </button>
                        )}
                        <button
                          disabled={busy || detailLoading}
                          className="v2-button-secondary"
                          onClick={() => void loadDetail(current)}
                        >
                          Refresh progress
                        </button>
                      </div>
                    </div>
                  )}
                  {current.status === "superseded" && (
                    <p className="mt-5 text-sm text-text-secondary">
                      A newer version has replaced this item. Choose the latest
                      version from the list before approving.
                    </p>
                  )}
                  {detail && (
                    <ActionResults items={detail.items} artifact={current} />
                  )}
                </>
              )}
            </section>
          </div>
          <PaymentReviews
            cases={summary.payments}
            remindersEnabled={summary.controls.payment_reminders}
            focusedCaseId={paymentId}
          />
        </>
      )}
    </div>
  );
}
