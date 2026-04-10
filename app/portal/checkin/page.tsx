"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ui/Toast";
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
                className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition-colors cursor-pointer ${
                  selected
                    ? "border-accent/40 bg-accent/10 text-accent-bright"
                    : "border-[rgba(255,255,255,0.06)] bg-bg-card text-text-secondary hover:border-[rgba(255,255,255,0.12)]"
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
            className="w-full rounded-xl border border-[rgba(255,255,255,0.06)] bg-bg-card px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors"
          />
        )}
      </div>
    );
  }

  if (question.type === "scale") {
    const min = question.min || 1;
    const max = question.max || 10;
    const values = Array.from({ length: max - min + 1 }, (_, index) => String(min + index));

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-text-muted">
          <span>{question.min_label || min}</span>
          <span>{question.max_label || max}</span>
        </div>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
          {values.map((item) => {
            const selected = value === item;
            return (
              <button
                key={item}
                type="button"
                onClick={() => onChange(question.id, item)}
                className={`rounded-xl border px-0 py-3 text-sm font-semibold transition-colors cursor-pointer ${
                  selected
                    ? "border-accent/40 bg-accent/10 text-accent-bright"
                    : "border-[rgba(255,255,255,0.06)] bg-bg-card text-text-secondary hover:border-[rgba(255,255,255,0.12)]"
                }`}
              >
                {item}
              </button>
            );
          })}
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
        className="w-full rounded-xl border border-[rgba(255,255,255,0.06)] bg-bg-card px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors"
      />
    );
  }

  return (
    <textarea
      value={value}
      onChange={(event) => onChange(question.id, event.target.value)}
      rows={4}
      placeholder={question.placeholder}
      className="w-full rounded-xl border border-[rgba(255,255,255,0.06)] bg-bg-card px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors resize-y"
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

  function setResponse(questionId: string, value: string) {
    setResponses((prev) => ({ ...prev, [questionId]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (config?.mood_enabled && !mood) return;
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
      <div className="max-w-3xl">
        <div className="bg-bg-card border border-emerald-500/20 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-heading font-bold text-text-primary mb-2">Check-In Submitted</h2>
          <p className="text-text-secondary">Marc will review your check-in and respond shortly.</p>
          <button
            onClick={resetForm}
            className="mt-6 px-6 py-3 gradient-accent text-white rounded-xl text-sm font-medium cursor-pointer"
          >
            Submit Another
          </button>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="max-w-3xl">
        <div className="mb-8">
          <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-8 w-48 mb-2" />
          <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-4 w-72" />
        </div>
        <div className="space-y-6">
          {[...Array(5)].map((_, i) => (
            <div key={i}>
              <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-4 w-40 mb-2" />
              <div className="animate-pulse bg-[rgba(255,255,255,0.04)] rounded-xl h-24 border border-[rgba(255,255,255,0.06)]" />
            </div>
          ))}
          <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-xl h-14" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold text-text-primary">Weekly Check-In</h1>
        <p className="text-text-secondary mt-1">Let Marc know how the business felt this week and where next week needs to go.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {config.mood_enabled && config.mood_options.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-text-primary mb-3">How are you feeling this week?</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {config.mood_options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMood(option.value)}
                  className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all cursor-pointer ${
                    mood === option.value
                      ? (moodColorMap[option.color] || "border-accent/30 bg-accent/10 text-accent-bright")
                      : "border-[rgba(255,255,255,0.06)] text-text-muted hover:border-[rgba(255,255,255,0.12)]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {groupedQuestions.map((group) => (
          <section key={group.section} className="space-y-5">
            <div>
              <h2 className="text-lg font-heading font-bold text-text-primary">{group.section}</h2>
              <div className="mt-2 h-px w-full bg-[linear-gradient(90deg,rgba(34,114,222,0.5),rgba(255,255,255,0.04),transparent)]" />
            </div>

            {group.questions.map((question) => (
              <div key={question.id} className="space-y-2">
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
          </section>
        ))}

        <button
          type="submit"
          disabled={(config.mood_enabled && !mood) || submitting}
          className="w-full py-4 gradient-accent text-white rounded-xl text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-opacity"
        >
          {submitting ? "Submitting..." : "Submit Check-In"}
        </button>
        {error && (
          <p className="text-red-400 text-sm text-center">Something went wrong. Please try again.</p>
        )}
      </form>
    </div>
  );
}
