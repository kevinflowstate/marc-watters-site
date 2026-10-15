"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useToast } from "@/components/ui/Toast";
import { InlineNotice, PageSkeleton, ProgressSummary } from "@/components/ui/PortalState";
import { defaultCheckinConfig, deriveCheckinMood } from "@/lib/checkins";
import { acquireDraftLock, checkinErrors, draftKey, questionError, readDraft, validReceipt, writeDraft, type CheckinDraft, type CheckinReceipt } from "@/lib/checkin-submission";
import type { CheckinFormConfig, FormQuestion } from "@/lib/types";

const moodColorMap: Record<string, string> = {
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  blue: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  red: "border-red-500/30 bg-red-500/10 text-red-400",
};

function QuestionField({
  question,
  value,
  otherValue,
  onChange,
}: {
  question: FormQuestion;
  value: string;
  otherValue: string;
  onChange: (questionId: string, nextValue: string) => void;
}) {
  if (question.type === "single_choice") {
    return (
      <div className="space-y-3">
        <div className="grid gap-2">
          {question.options?.map((option) => {
            const selected = value === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange(question.id, option.value)}
                aria-pressed={selected}
                className={`min-h-12 w-full rounded-[var(--cbb-radius-sm)] border px-4 py-3 text-left text-sm transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
                  selected
                    ? "border-accent/45 bg-accent/12 text-blue-100"
                    : "border-white/[0.08] bg-white/[0.025] text-text-secondary hover:border-white/[0.16] hover:bg-white/[0.04]"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {question.allow_other && value === "other" && (
          <input
            type="text"
            value={otherValue}
            onChange={(event) => onChange(`${question.id}__other`, event.target.value)}
            placeholder="Add your answer"
            className="min-h-12 w-full rounded-[var(--cbb-radius-sm)] border border-white/[0.09] bg-bg-primary/60 px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/10 transition-colors"
          />
        )}
      </div>
    );
  }

  if (question.type === "scale") {
    const min = question.min || 1;
    const max = question.max || 10;
    const numericValue = Number(value);
    const hasValue = value !== "" && Number.isFinite(numericValue);
    const fallbackValue = Math.round((min + max) / 2);
    const sliderValue = hasValue ? numericValue : fallbackValue;
    const percentage = max > min ? ((sliderValue - min) / (max - min)) * 100 : 0;
    const minLabel = question.min_label && question.min_label !== String(min) ? question.min_label : null;
    const maxLabel = question.max_label && question.max_label !== String(max) ? question.max_label : null;
    const rangeStyle = {
      "--range-progress": `${hasValue ? percentage : 0}%`,
      "--range-active": hasValue ? "var(--color-accent)" : "rgba(255, 255, 255, 0.1)",
      "--range-thumb": hasValue ? "var(--color-accent-bright)" : "var(--color-text-muted)",
    } as CSSProperties;

    return (
      <div className="rounded-[var(--cbb-radius-sm)] border border-white/[0.08] bg-white/[0.025] px-4 py-4 sm:px-5">
        <div className="mb-1 flex min-h-9 items-center justify-between gap-4">
          <span className="text-xs font-medium text-text-muted">
            {hasValue ? "Selected score" : "Move the slider to answer"}
          </span>
          <output
            htmlFor={`scale-${question.id}`}
            className={`flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-base font-bold tabular-nums transition-colors ${
              hasValue
                ? "border-accent/35 bg-accent/12 text-accent-bright"
                : "border-white/[0.08] bg-white/[0.025] text-text-muted"
            }`}
            aria-live="polite"
          >
            {hasValue ? value : "—"}
          </output>
        </div>
        <input
          id={`scale-${question.id}`}
          type="range"
          min={min}
          max={max}
          step={1}
          value={sliderValue}
          onChange={(event) => onChange(question.id, event.target.value)}
          aria-label={question.label}
          aria-valuetext={hasValue ? `${value} out of ${max}` : "Not answered"}
          className="portal-v2-range"
          style={rangeStyle}
        />
        <div className="flex items-start justify-between gap-4 text-xs font-medium text-text-muted">
          <span className="max-w-[45%] text-left">
            <span className="mr-1 text-text-secondary">{min}</span>
            {minLabel && <span>· {minLabel}</span>}
          </span>
          <span className="max-w-[45%] text-right">
            {maxLabel && <span>{maxLabel} ·</span>}
            <span className="ml-1 text-text-secondary">{max}</span>
          </span>
        </div>
      </div>
    );
  }

  if (question.type === "text") {
    return (
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(question.id, event.target.value)}
        placeholder={question.placeholder}
        className="min-h-12 w-full rounded-[var(--cbb-radius-sm)] border border-white/[0.09] bg-bg-primary/60 px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/10 transition-colors"
      />
    );
  }

  return (
    <textarea
      value={value}
      onChange={(event) => onChange(question.id, event.target.value)}
      rows={4}
      placeholder={question.placeholder}
      className="w-full rounded-[var(--cbb-radius-sm)] border border-white/[0.09] bg-bg-primary/60 px-4 py-3 text-sm leading-relaxed text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/10 transition-colors resize-y"
    />
  );
}

export default function CheckInPage() {
  const { toast } = useToast();
  const [config, setConfig] = useState<CheckinFormConfig | null>(null);
  const [mood, setMood] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [receipt, setReceipt] = useState<CheckinReceipt | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [draftConflict, setDraftConflict] = useState(false);
  const [pending, setPending] = useState(false);
  const [signInRequired, setSignInRequired] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const rawDraftRef = useRef<string | null>(null);
  const draftRef = useRef<CheckinDraft | null>(null);
  const inFlightRef = useRef(false);
  const releaseLockRef = useRef<(() => void) | null>(null);

  function showDraft(draft: CheckinDraft) {
    draftRef.current = draft;
    setResponses(draft.responses);
    setMood(draft.mood);
    setPending(draft.pending);
    setReceipt(draft.receipt || null);
    setSubmitted(Boolean(draft.receipt));
  }

  function persistDraft(draft: CheckinDraft) {
    const userId = userIdRef.current;
    if (!userId) return false;
    let result: ReturnType<typeof writeDraft>;
    try { result = writeDraft(window.localStorage, draftKey(userId), rawDraftRef.current, draft); }
    catch { result = { status: "unavailable" }; }
    if (result.status === "conflict") {
      setDraftConflict(true);
      return false;
    }
    if (result.status === "saved") {
      rawDraftRef.current = result.raw;
      setStorageWarning(null);
    } else {
      setStorageWarning("This browser could not save a draft. Keep this page open until your check-in is confirmed, or copy your answers before leaving.");
    }
    showDraft(draft);
    return true;
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [meRes, configRes] = await Promise.all([
          fetch("/api/portal/me", { cache: "no-store" }),
          fetch("/api/admin/form-config?type=checkin", { cache: "no-store" }),
        ]);
        if (meRes.status === 401 || configRes.status === 401) {
          if (!cancelled) setSignInRequired(true);
          throw new Error("Please sign in to load your check-in and saved draft.");
        }
        if (!meRes.ok || !configRes.ok) throw new Error("Your check-in could not be loaded. Please try again; saved answers have been kept.");
        const [me, data] = await Promise.all([meRes.json(), configRes.json()]);
        if (!me.userId) throw new Error("Your account could not be confirmed. Please sign in again.");
        if (cancelled) return;
        const currentConfig = data.config || defaultCheckinConfig;
        if (navigator.locks) {
          const acquired = await acquireDraftLock(navigator.locks, draftKey(me.userId), (release) => {
            releaseLockRef.current = release;
            if (cancelled) release();
          });
          if (cancelled) { releaseLockRef.current?.(); return; }
          if (!acquired) setDraftConflict(true);
        }
        userIdRef.current = me.userId;
        setConfig(currentConfig);
        let raw: string | null = null;
        try { raw = window.localStorage.getItem(draftKey(me.userId)); }
        catch { setStorageWarning("This browser could not restore a draft. Keep this page open until your check-in is confirmed."); }
        rawDraftRef.current = raw;
        const saved = readDraft(raw);
        showDraft(saved || {
          version: 1, submissionId: crypto.randomUUID(), responses: {}, mood: null,
          configVersion: JSON.stringify(currentConfig), updatedAt: Date.now(), pending: false,
        });
        if (saved?.pending) setError("A previous submission has not been confirmed. Retry to check and safely finish that same submission.");
        if (saved && saved.configVersion !== JSON.stringify(currentConfig) && !saved.pending) {
          setError("The questions have been updated. Your saved answers are restored; please review them before submitting.");
        }
      } catch (cause) {
        if (!cancelled) setLoadError(cause instanceof Error ? cause.message : "Your check-in could not be loaded.");
      }
    }
    void load();
    function storageChanged(event: StorageEvent) {
      if (userIdRef.current && event.key === draftKey(userIdRef.current) && event.newValue !== rawDraftRef.current) setDraftConflict(true);
    }
    window.addEventListener("storage", storageChanged);
    return () => { cancelled = true; releaseLockRef.current?.(); window.removeEventListener("storage", storageChanged); };
  }, []);

  const groupedQuestions = useMemo(() => {
    const source = config?.questions || [];
    const groups: Array<{ section: string; questions: FormQuestion[] }> = [];

    for (const question of source) {
      const section = question.section || "Check-In";
      const existing = groups.find((group) => group.section === section);
      if (existing) existing.questions.push(question);
      else groups.push({ section, questions: [question] });
    }

    return groups;
  }, [config?.questions]);

  const moodOptions = config?.mood_options || [];
  const moodRequired = Boolean(config?.mood_enabled && moodOptions.length > 0);
  const progress = useMemo(() => {
    const questions = groupedQuestions.flatMap((group) => group.questions);
    const total = questions.length + (moodRequired ? 1 : 0);
    const answered = questions.filter((question) => Boolean(responses[question.id]?.trim()) && !questionError(question, responses)).length + (moodRequired && mood ? 1 : 0);

    return {
      answered,
      total,
      percentage: total > 0 ? Math.round((answered / total) * 100) : 0,
    };
  }, [groupedQuestions, mood, moodRequired, responses]);

  function setResponse(questionId: string, value: string) {
    if (draftRef.current?.pending || draftConflict || !config) return;
    const nextResponses = { ...responses, [questionId]: value };
    persistDraft({ ...draftRef.current!, responses: nextResponses, updatedAt: Date.now(), configVersion: JSON.stringify(config) });
    if (Object.keys(fieldErrors).length) setFieldErrors(checkinErrors(config, nextResponses, mood));
  }

  function changeMood(value: string) {
    if (draftRef.current?.pending || draftConflict || !config) return;
    persistDraft({ ...draftRef.current!, mood: value, updatedAt: Date.now() });
    if (Object.keys(fieldErrors).length) setFieldErrors(checkinErrors(config, responses, value));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (inFlightRef.current || draftConflict || !draftRef.current || !config) return;
    const wasPending = draftRef.current.pending;
    if (!wasPending) {
      const validation = checkinErrors(config, responses, mood);
      setFieldErrors(validation);
      const firstField = Object.keys(validation)[0];
      if (firstField) {
        setError(validation[firstField]);
        document.getElementById(`checkin-${firstField}`)?.focus();
        return;
      }
    }
    inFlightRef.current = true;
    setSubmitting(true);
    setError(null);
    setSignInRequired(false);
    const snapshot: CheckinDraft = {
      ...draftRef.current, pending: true, updatedAt: Date.now(),
      mood: wasPending ? draftRef.current.mood : (moodRequired ? mood : deriveCheckinMood(responses)),
    };
    if (!persistDraft(snapshot)) { inFlightRef.current = false; setSubmitting(false); return; }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch("/api/portal/checkin", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ userId: userIdRef.current, submissionId: snapshot.submissionId, mood: snapshot.mood, responses: snapshot.responses }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success === true && validReceipt(data.receipt, snapshot.submissionId)) {
        // Keep a receipt marker. If storage is blocked, the pending snapshot remains safe to retry.
        persistDraft({ ...snapshot, pending: false, responses: {}, mood: null, receipt: data.receipt, updatedAt: Date.now() });
        setReceipt(data.receipt);
        setSubmitted(true);
        toast("Check-in saved - Marc will review it this week");
      } else {
        setSignInRequired(res.status === 401);
        setError(`${data.error || "We could not confirm the save. Please retry the same submission."}${data.requestId ? ` Reference: ${data.requestId}` : ""}`);
        // The server retires the old ID under the save lock, so a late request cannot save it after editing resumes.
        if (data.cancelled === true) {
          const currentConfig = data.config?.questions ? data.config : config;
          setConfig(currentConfig);
          persistDraft({ ...snapshot, submissionId: crypto.randomUUID(), pending: false, configVersion: JSON.stringify(currentConfig) });
          setFieldErrors(checkinErrors(currentConfig, snapshot.responses, snapshot.mood));
        }
      }
    } catch {
      setError("The connection was interrupted and we could not confirm the save. Your answers are kept. Retry below to safely check the same submission.");
    } finally {
      window.clearTimeout(timeout);
      inFlightRef.current = false;
      setSubmitting(false);
    }
  }

  function resetForm() {
    if (draftConflict || !config) return;
    persistDraft({ version: 1, submissionId: crypto.randomUUID(), responses: {}, mood: null,
      configVersion: JSON.stringify(config), updatedAt: Date.now(), pending: false });
    setError(null);
    setFieldErrors({});
  }

  if (loadError) {
    return <div className="max-w-3xl space-y-4"><InlineNotice tone="error">{loadError}</InlineNotice>
      {signInRequired ? <a className="v2-button-primary" href="/login?redirect=%2Fportal%2Fcheckin">Sign in</a> :
        <button className="v2-button-secondary" onClick={() => window.location.reload()}>Try loading again</button>}
    </div>;
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-3xl pt-4 sm:pt-12">
        <div className="v2-surface-strong px-6 py-10 text-center sm:px-10 sm:py-14">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-500/10">
            <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="v2-eyebrow mb-3 text-emerald-300">Saved successfully</div>
          <h2 className="v2-page-title">Check-In Submitted</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-text-secondary">Marc will review your check-in and respond shortly. You can return to the portal while he reviews it.</p>
          {receipt && <p className="mt-4 text-sm text-text-secondary">Saved {new Date(receipt.created_at).toLocaleString("en-GB")} · <a className="text-accent-bright underline" href={`/portal/checkins/${receipt.id}`}>View saved check-in</a></p>}
          {storageWarning && <InlineNotice tone="error">{storageWarning}</InlineNotice>}
          {draftConflict && <InlineNotice tone="error">Another tab changed your draft. Finish in that tab before starting another check-in here.</InlineNotice>}
          <button
            disabled={draftConflict}
            onClick={resetForm}
            className="v2-button-secondary mt-7 cursor-pointer"
          >
            Submit Another
          </button>
        </div>
      </div>
    );
  }

  if (!config) {
    return <div className="max-w-4xl"><PageSkeleton rows={5} /></div>;
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6 sm:mb-8">
        <div className="v2-eyebrow mb-3">Weekly reflection</div>
        <h1 className="v2-page-title">Weekly Check-In</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">Let Marc know how the business felt this week and where next week needs to go.</p>
      </div>

      <div className="mb-6">
        <ProgressSummary
          value={progress.percentage}
          label="Check-In progress"
          detail={`${progress.answered} of ${progress.total} answers completed`}
        />
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
        {storageWarning ? <InlineNotice tone="error">{storageWarning}</InlineNotice> : <p className="text-xs text-text-muted">Unsent answers are kept on this browser for your account for up to 30 days. Unconfirmed submissions are kept until resolved.</p>}
        {draftConflict && <InlineNotice tone="error">Another tab changed your draft. Your answers are still visible here. Keep this page open and finish in the other tab to avoid overwriting its answers.</InlineNotice>}
        {pending && <InlineNotice>These answers are waiting for save confirmation. Retry the same submission below before changing them.</InlineNotice>}
        <fieldset disabled={pending || draftConflict || submitting} className="min-w-0 space-y-5 sm:space-y-6">
        {moodRequired && (
          <section id="checkin-mood" tabIndex={-1} className="v2-surface p-4 sm:p-5">
            <div className="mb-4">
              <div className="text-xs font-semibold text-accent-light">Start here</div>
              <label className="mt-1 block text-base font-semibold text-text-primary">How are you feeling this week?</label>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {moodOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => changeMood(option.value)}
                  aria-pressed={mood === option.value}
                  className={`min-h-12 px-4 py-3 rounded-[var(--cbb-radius-sm)] border text-sm font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
                    mood === option.value
                      ? (moodColorMap[option.color] || "border-accent/30 bg-accent/10 text-accent-bright")
                      : "border-white/[0.08] bg-white/[0.02] text-text-muted hover:border-white/[0.16] hover:text-text-secondary"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>
        )}

        {groupedQuestions.map((group, groupIndex) => (
          <section key={group.section} className="v2-surface overflow-hidden">
            <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-4 sm:px-5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-accent/25 bg-accent/10 text-xs font-bold text-accent-bright">
                {groupIndex + 1}
              </div>
              <h2 className="v2-section-title">{group.section}</h2>
            </div>

            <div className="divide-y divide-white/[0.055] px-4 sm:px-5">
            {group.questions.map((question) => (
              <div id={`checkin-${question.id}`} tabIndex={-1} key={question.id} className="space-y-3 py-5">
                <label className="block text-sm font-medium text-text-primary">
                  {question.label}
                  {question.required && <span className="text-accent-bright"> *</span>}
                </label>
                {question.help_text && (
                  <p className="text-xs leading-relaxed text-text-muted">{question.help_text}</p>
                )}
                {fieldErrors[question.id] && <p role="alert" className="text-sm text-red-400">{fieldErrors[question.id]}</p>}
                <QuestionField
                  question={question}
                  value={responses[question.id] || ""}
                  otherValue={responses[`${question.id}__other`] || ""}
                  onChange={setResponse}
                />
              </div>
            ))}
            </div>
          </section>
        ))}

        </fieldset>
        {error && <div role="alert"><InlineNotice tone="error">{error}</InlineNotice></div>}
        {signInRequired && <a className="v2-button-secondary" href="/login?redirect=%2Fportal%2Fcheckin">Sign in again, then return to this draft</a>}
        <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-10 rounded-[var(--cbb-radius-md)] border border-white/[0.08] bg-bg-primary/90 p-3 shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
          <button
            type="submit"
            disabled={submitting || draftConflict}
            className="v2-button-primary min-h-12 w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Confirming save…" : pending ? "Retry and confirm this check-in" : "Submit Check-In"}
          </button>
        </div>
      </form>
    </div>
  );
}
