"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useToast } from "@/components/ui/Toast";
import { InlineNotice, PageSkeleton, ProgressSummary } from "@/components/ui/PortalState";
import { defaultCheckinConfig } from "@/lib/checkins";
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
  const [error, setError] = useState(false);

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch("/api/admin/form-config?type=checkin");
        if (res.ok) {
          const data = await res.json();
          setConfig(data.config);
          return;
        }
      } catch {
        // Fall through to default config
      }

      setConfig(defaultCheckinConfig);
    }

    loadConfig();
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
    const answered = questions.filter((question) => Boolean(responses[question.id]?.trim())).length + (moodRequired && mood ? 1 : 0);

    return {
      answered,
      total,
      percentage: total > 0 ? Math.round((answered / total) * 100) : 0,
    };
  }, [groupedQuestions, mood, moodRequired, responses]);

  function setResponse(questionId: string, value: string) {
    setResponses((prev) => ({ ...prev, [questionId]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (moodRequired && !mood) return;
    setError(false);
    setSubmitting(true);

    try {
      const res = await fetch("/api/portal/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mood: mood || "good", responses }),
      });

      if (res.ok) {
        setSubmitted(true);
        toast("Check-in submitted - Marc will review it this week");
      } else {
        const data = await res.json().catch(() => ({}));
        setError(true);
        toast(data.error || "Something went wrong. Please try again.", "error");
        setTimeout(() => setError(false), 5000);
      }
    } catch {
      setError(true);
      toast("Something went wrong. Please try again.", "error");
      setTimeout(() => setError(false), 5000);
    }

    setSubmitting(false);
  }

  function resetForm() {
    setSubmitted(false);
    setMood(null);
    setResponses({});
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
          <div className="v2-eyebrow mb-3 text-emerald-300">Sent successfully</div>
          <h2 className="v2-page-title">Check-In Submitted</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-text-secondary">Marc will review your check-in and respond shortly. You can return to the portal while he reviews it.</p>
          <button
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
        {moodRequired && (
          <section className="v2-surface p-4 sm:p-5">
            <div className="mb-4">
              <div className="text-xs font-semibold text-accent-light">Start here</div>
              <label className="mt-1 block text-base font-semibold text-text-primary">How are you feeling this week?</label>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {moodOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMood(option.value)}
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
              <div key={question.id} className="space-y-3 py-5">
                <label className="block text-sm font-medium text-text-primary">
                  {question.label}
                  {question.required && <span className="text-accent-bright"> *</span>}
                </label>
                {question.help_text && (
                  <p className="text-xs leading-relaxed text-text-muted">{question.help_text}</p>
                )}
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

        {error && (
          <InlineNotice tone="error">Something went wrong. Your answers are still here, so you can try submitting again.</InlineNotice>
        )}
        <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-10 rounded-[var(--cbb-radius-md)] border border-white/[0.08] bg-bg-primary/90 p-3 shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
          <button
            type="submit"
            disabled={(moodRequired && !mood) || submitting}
            className="v2-button-primary min-h-12 w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Submitting Check-In…" : "Submit Check-In"}
          </button>
        </div>
      </form>
    </div>
  );
}
