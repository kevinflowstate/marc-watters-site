"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ActionResults, ContentReview, LessonReview, contentPostLabel, text } from "@/components/admin/AutomationReviewPanels";
import type { ArtifactDecision, ArtifactItem, OpsArtifact } from "@/lib/ops/action-types";
import { Chip, fullDate, Icon } from "./WorkspaceUI";

export type ActionControls = {
  content_scheduling: boolean | null;
  lesson_publication: boolean | null;
  payment_reminders: boolean | null;
};
export const emptyControls: ActionControls = { content_scheduling: null, lesson_publication: null, payment_reminders: null };

export const artifactStatusLabels: Record<OpsArtifact["status"], string> = {
  draft: "Needs review",
  approved: "Approved",
  rejected: "Changes requested",
  superseded: "Replaced",
  running: "In progress",
  completed: "Completed",
  needs_attention: "Needs checking",
};
export function artifactTone(status: OpsArtifact["status"]): "decide" | "attn" | "ok" | undefined {
  if (status === "draft") return "decide";
  if (status === "needs_attention" || status === "rejected") return "attn";
  if (status === "completed") return "ok";
  return undefined;
}
export function artifactKindLabel(a: Pick<OpsArtifact, "kind">) {
  return a.kind === "content" ? "Weekly content" : "Lesson";
}

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
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { cache: "no-store", ...init });
  const result = await response.json();
  if (!response.ok)
    throw new PreparedWorkError(
      typeof result.error === "string" ? result.error : "The request could not be completed. Please try again.",
      response.status,
    );
  return result as T;
}

/** Review and act on one prepared item (content pack or lesson). Same API calls and payloads as before. */
export function PreparedWorkPanel({
  artifact: initial,
  controls,
  onChanged,
  onBusy,
}: {
  artifact: OpsArtifact;
  controls: ActionControls;
  onChanged: () => Promise<void> | void;
  onBusy?: (busy: boolean) => void;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(false);
  const busy = actionBusy || checkingSetup;
  const [schedulingSetup, setSchedulingSetup] = useState<SchedulingSetup | null>(null);
  const [setupError, setSetupError] = useState("");
  const [notice, setNotice] = useState("");
  const [note, setNote] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null);
  const setupRequest = useRef(0);
  const setupRunning = useRef(false);
  const setupAbort = useRef<AbortController | null>(null);
  const selection = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    onBusy?.(busy);
  }, [busy, onBusy]);

  const loadDetail = useCallback(async (id: string) => {
    const current = ++selection.current;
    setupAbort.current?.abort();
    setupAbort.current = null;
    setupRequest.current += 1;
    setupRunning.current = false;
    setCheckingSetup(false);
    setSchedulingSetup(null);
    setSetupError("");
    setDetailError("");
    setDetailLoading(true);
    try {
      const result = await request<Detail>(`/api/admin/ops/artifacts/${id}`);
      if (selection.current !== current) return;
      setDetail(result);
    } catch (e) {
      if (selection.current === current) setDetailError(e instanceof Error ? e.message : "Could not check this version.");
    } finally {
      if (selection.current === current) setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    setDetail(null);
    setNote("");
    setNotice("");
    setReviewed(false);
    void loadDetail(initial.id);
    return () => {
      mounted.current = false;
      selection.current += 1;
      setupAbort.current?.abort();
      setupRequest.current += 1;
    };
  }, [initial.id, loadDetail]);

  const current = detail?.artifact ?? initial;

  async function action(kind: "decision" | "execute", decision?: "approved" | "rejected") {
    if (!detail || busy || setupRunning.current) return;
    const displayed = detail.artifact;
    const contentRun = kind === "execute" && displayed.kind === "content";
    const total = displayed.item_keys.length;
    let completed = detail.items.filter((item) => item.status === "succeeded").length;
    let result: { artifact?: OpsArtifact; items?: ArtifactItem[]; continuation_required?: boolean; in_progress?: boolean } = {};
    setActionBusy(true);
    setDetailError("");
    setNotice("");
    setProgress(contentRun ? { completed, total } : null);
    try {
      for (let turn = 0; turn < (contentRun ? 50 : 1); turn++) {
        result = await request(`/api/admin/ops/artifacts/${displayed.id}/${kind}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            version: displayed.version,
            manifest_hash: displayed.manifest_hash,
            ...(kind === "decision" ? { decision, ...(note.trim() ? { note: note.trim() } : {}) } : {}),
          }),
        });
        if (!mounted.current) return;
        if (!contentRun) break;
        if (
          !result.artifact ||
          !Array.isArray(result.items) ||
          result.artifact.id !== displayed.id ||
          result.artifact.version !== displayed.version ||
          result.artifact.manifest_hash !== displayed.manifest_hash
        )
          throw Error("The saved result could not be matched to this version. Refresh before continuing.");
        setDetail({ artifact: result.artifact, items: result.items, decisions: detail.decisions, preview: detail.preview });
        const updatedCount = result.items.filter((item) => item.status === "succeeded").length;
        setProgress({ completed: updatedCount, total });
        const needsChecking = result.items.some((item) => ["failed", "unknown"].includes(item.status));
        const stillRunning = result.items.some((item) => item.status === "running");
        if (needsChecking || stillRunning || result.in_progress || !result.continuation_required) {
          completed = updatedCount;
          break;
        }
        if (updatedCount <= completed) throw Error("No new completed post was confirmed. Refresh the saved results before continuing.");
        completed = updatedCount;
        if (turn === 49) throw Error("The remaining posts are saved as pending. Refresh, then continue from the saved progress.");
      }
      await loadDetail(displayed.id);
      await onChanged();
      setNotice(
        kind === "execute"
          ? contentRun
            ? `${completed} of ${total} posts have a confirmed result.`
            : "Done. The saved result is below."
          : decision === "approved"
            ? "Approved. Scheduling is the next step."
            : "Changes requested. A revised version will come back for review.",
      );
    } catch (e) {
      if (mounted.current) {
        setDetailError(e instanceof Error ? e.message : "Could not save. Reload this version before trying again.");
        setReviewed(false);
      }
    } finally {
      if (mounted.current) {
        setActionBusy(false);
        setProgress(null);
      }
    }
  }

  async function checkSchedulingSetup(postIds?: string[]) {
    if (!detail || detail.artifact.kind !== "content" || busy || setupRunning.current || detailLoading || detailError) return;
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
      const checked = await request<SchedulingSetup>(`/api/admin/ops/artifacts/${displayed.id}/preflight`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          version: displayed.version,
          manifest_hash: displayed.manifest_hash,
          ...(postIds ? { post_ids: postIds.slice(0, 5) } : {}),
        }),
      });
      if (!mounted.current || selection.current !== currentSelection || setupRequest.current !== run) return;
      if (
        checked.dry_run !== true ||
        !Array.isArray(checked.checks) ||
        checked.checks.length > 5 ||
        !checked.checks.every((check) => displayed.item_keys.includes(check.post_id)) ||
        !Array.isArray(checked.remaining_post_ids) ||
        !checked.remaining_post_ids.every((id) => displayed.item_keys.includes(id))
      )
        throw Error("The scheduling checks could not be matched to this version. Refresh and try again.");
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
      if (!mounted.current || selection.current !== currentSelection || setupRequest.current !== run) return;
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

  const actionSetting = current.kind === "content" ? controls.content_scheduling : controls.lesson_publication;
  const actionEnabled = actionSetting === true;
  const validationError = text(detail?.preview?.validation_error);
  const blocked = busy || !detail || detailLoading || Boolean(detailError || validationError);
  const canContinue =
    current.kind === "content" &&
    current.status === "running" &&
    Boolean(detail?.items.some((item) => item.status === "pending")) &&
    !detail?.items.some((item) => ["running", "failed", "unknown"].includes(item.status));
  const decisions = (detail?.decisions || []).filter(
    (d) => d.artifact_id === current.id && d.version === current.version && d.manifest_hash === current.manifest_hash,
  );
  const executeLabel =
    current.kind === "content"
      ? "Schedule this week’s posts"
      : text(current.payload.mode) === "draft"
        ? "Add lesson draft to Training"
        : "Publish lesson";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={artifactTone(current.status)}>{artifactStatusLabels[current.status]}</Chip>
        <span className="ws-caption">
          {artifactKindLabel(current)} · version {current.version} · saved {fullDate(current.created_at)}
        </span>
      </div>

      {decisions.map((decision) => (
        <div key={decision.id} className={`ws-note mt-4 ${decision.decision === "rejected" ? "is-attn" : "is-ok"}`}>
          <Icon name={decision.decision === "rejected" ? "alert" : "checkCircle"} size={16} className="mt-0.5 flex-none" />
          <span>
            <strong>{decision.decision === "rejected" ? "Changes requested" : "Approved"}</strong> · {fullDate(decision.created_at)}
            {decision.note && <span className="ws-prose mt-1 block">{decision.note}</span>}
          </span>
        </div>
      ))}
      {detailLoading && <p role="status" className="ws-caption mt-4">Checking this saved version…</p>}
      {detailError && <p role="alert" className="ws-note is-bad mt-4">{detailError}</p>}
      {progress && (
        <div role="status" className="ws-note is-info mt-4">
          <span>
            <strong>Scheduling {progress.completed} of {progress.total} posts.</strong> Keep this open until it finishes. Completed posts are never repeated.
          </span>
        </div>
      )}
      {notice && <p role="status" className="ws-note is-ok mt-4">{notice}</p>}
      {validationError && <p role="alert" className="ws-note is-attn mt-4">This version needs checking before another action: {validationError}</p>}

      <div className="ws-section">
        {current.kind === "content" ? (
          <ContentReview payload={current.payload} artifact={current} showMedia={Boolean(detail?.preview) && !detailError} />
        ) : (
          <LessonReview payload={current.payload} preview={detail?.preview ?? null} />
        )}
      </div>

      {current.kind === "content" && current.status !== "superseded" && (
        <section className="ws-section" aria-labelledby="scheduling-setup-title">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="scheduling-setup-title" className="ws-h2">Scheduling check</h3>
            <button type="button" className="ws-btn" disabled={blocked} onClick={() => void checkSchedulingSetup()}>
              {checkingSetup ? <Icon name="refresh" size={14} className="ws-spin" /> : <Icon name="plug" size={14} />}
              {checkingSetup ? "Checking…" : schedulingSetup ? "Check again" : "Check accounts and dates"}
            </button>
          </div>
          <p className="ws-caption mt-1">Confirms the connected accounts, planned dates and image files. Nothing is scheduled by this check.</p>
          {setupError && <p role="alert" className="ws-note is-attn mt-3">{setupError}</p>}
          {schedulingSetup && (
            <div className="mt-3 space-y-2">
              <p className="ws-caption">
                {schedulingSetup.checks.length
                  ? `${schedulingSetup.checks.length} ${schedulingSetup.checks.length === 1 ? "post" : "posts"} checked ${fullDate(schedulingSetup.checked_at)}.`
                  : "No pending posts to check."}
                {!schedulingSetup.scheduling_enabled && " Scheduling is switched off."}
                {!schedulingSetup.approval_saved && " This version still needs approval."}
              </p>
              <ol className="space-y-2" aria-label="Post checks">
                {schedulingSetup.checks.map((check) => (
                  <li key={check.post_id} className="ws-panel p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong>
                        {contentPostLabel(current.payload, check.post_id)} · {check.platform.charAt(0).toUpperCase() + check.platform.slice(1)}
                      </strong>
                      <Chip tone={check.status === "ready" ? "ok" : check.status === "already_scheduled" ? undefined : "attn"}>
                        {check.status === "ready" ? "Ready" : check.status === "already_scheduled" ? "Already scheduled" : check.status === "needs_attention" ? "Needs checking" : "Not ready"}
                      </Chip>
                    </div>
                    <dl className="ws-kv mt-2">
                      <dt>Account</dt><dd>{check.account_name || "Not confirmed"}</dd>
                      <dt>Planned</dt><dd>{check.schedule_label}</dd>
                    </dl>
                    {!check.connection_ready && !check.blockers.includes(check.summary) && <p className="ws-caption mt-2">{check.summary}</p>}
                    {check.blockers.length > 0 && (
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[color:var(--ws-ink-2)]">
                        {check.blockers.map((b, i) => <li key={i}>{b}</li>)}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
              {schedulingSetup.has_more && (
                <button type="button" className="ws-btn" disabled={busy || detailLoading || Boolean(detailError)} onClick={() => void checkSchedulingSetup(schedulingSetup.remaining_post_ids)}>
                  Check {Math.min(5, schedulingSetup.remaining_post_ids.length)} more
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {current.status === "draft" && (
        <section className="ws-section" aria-label="Decision">
          <label className="ws-check">
            <input type="checkbox" checked={reviewed} disabled={blocked} onChange={(e) => setReviewed(e.target.checked)} />
            <span>
              {current.kind === "content"
                ? "I’ve checked the copy, images, dates and accounts."
                : "I’ve checked the edited video, summary and workbook."}
            </span>
          </label>
          <label className="mt-4 block">
            <span className="ws-label">Note <span className="font-normal opacity-70">(required to request changes)</span></span>
            <textarea className="ws-input" value={note} maxLength={5000} disabled={busy} rows={3} onChange={(e) => setNote(e.target.value)} placeholder="What should change, or anything to keep in mind." />
          </label>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="ws-btn ws-btn-primary" disabled={blocked || !reviewed} onClick={() => void action("decision", "approved")}>
              Approve this version
            </button>
            <button type="button" className="ws-btn" disabled={busy || !note.trim() || !detail || detailLoading} onClick={() => void action("decision", "rejected")}>
              Request changes
            </button>
          </div>
        </section>
      )}

      {current.status === "approved" && (
        <section className="ws-section" aria-label="Next step">
          <h3 className="ws-h2">Approved</h3>
          <p className="ws-caption mt-1">
            {current.kind === "content"
              ? "Scheduling is a separate step. Each post gets its own saved result."
              : text(current.payload.mode) === "draft"
                ? "Adds the lesson to Training as an unpublished draft."
                : "Adds the lesson and publishes its Training module."}
          </p>
          {!actionEnabled && (
            <p className="ws-note is-attn mt-3">
              {actionSetting === null
                ? "The action setting could not be confirmed. Refresh before continuing."
                : current.kind === "content"
                  ? "Scheduling is switched off, so this button is disabled."
                  : "Lesson publication is switched off, so this button is disabled."}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="ws-btn ws-btn-primary" disabled={blocked || !actionEnabled} onClick={() => void action("execute")}>
              {executeLabel}
            </button>
            <button type="button" className="ws-btn" disabled={busy || detailLoading} onClick={() => void loadDetail(current.id)}>
              Refresh
            </button>
          </div>
        </section>
      )}

      {current.status === "running" && (
        <section className="ws-section" aria-label="Progress">
          <h3 className="ws-h2">In progress</h3>
          <p className="ws-caption mt-1">
            {canContinue ? "Continue with the remaining posts. Completed posts are not sent again." : "Check the saved results below and refresh for the latest progress."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {canContinue && (
              <button type="button" className="ws-btn ws-btn-primary" disabled={blocked || !actionEnabled} onClick={() => void action("execute")}>
                Continue scheduling
              </button>
            )}
            <button type="button" className="ws-btn" disabled={busy || detailLoading} onClick={() => void loadDetail(current.id)}>
              Refresh
            </button>
          </div>
        </section>
      )}
      {current.status === "rejected" && <p className="ws-note mt-5">Changes requested. The revised version will appear as a new item.</p>}
      {current.status === "needs_attention" && (
        <p className="ws-note is-attn mt-5">One or more results need checking. Confirm whether the uncertain item went through before trying again.</p>
      )}
      {current.status === "superseded" && <p className="ws-note mt-5">A newer version has replaced this item.</p>}

      {detail && <ActionResults items={detail.items} artifact={current} />}

      <details className="ws-details mt-6">
        <summary>Version details</summary>
        <dl className="ws-kv mt-3">
          <dt>Version</dt><dd>{current.version}</dd>
          <dt>Fingerprint</dt><dd className="break-all text-xs">{current.manifest_hash}</dd>
          <dt>Saved</dt><dd>{fullDate(current.created_at)}</dd>
          {current.approved_at && <><dt>Approved</dt><dd>{fullDate(current.approved_at)}</dd></>}
        </dl>
      </details>
    </div>
  );
}
