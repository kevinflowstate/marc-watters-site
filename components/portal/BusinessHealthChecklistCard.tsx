"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import {
  BUSINESS_HEALTH_CHECKLIST_TYPE,
  businessHealthChecklistConfig,
} from "@/lib/questionnaires";
import type { ClientQuestionnaireSubmission, FormQuestion, QuestionnaireFormConfig } from "@/lib/types";

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
            onChange={(e) => onChange(`${question.id}__other`, e.target.value)}
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
        onChange={(e) => onChange(question.id, e.target.value)}
        placeholder={question.placeholder}
        className="w-full rounded-xl border border-[rgba(255,255,255,0.06)] bg-bg-card px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors"
      />
    );
  }

  return (
    <textarea
      value={value}
      onChange={(e) => onChange(question.id, e.target.value)}
      rows={4}
      placeholder={question.placeholder}
      className="w-full rounded-xl border border-[rgba(255,255,255,0.06)] bg-bg-card px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors resize-y"
    />
  );
}

export default function BusinessHealthChecklistCard({
  isUnlocked,
}: {
  isUnlocked: boolean;
}) {
  const { toast } = useToast();
  const [config, setConfig] = useState<QuestionnaireFormConfig>(businessHealthChecklistConfig);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [submission, setSubmission] = useState<ClientQuestionnaireSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadChecklist() {
      try {
        const res = await fetch(`/api/portal/questionnaires/${BUSINESS_HEALTH_CHECKLIST_TYPE}`);
        if (!res.ok) throw new Error("Failed to load questionnaire");

        const data = await res.json();
        setConfig(data.config || businessHealthChecklistConfig);
        setSubmission(data.submission || null);
        setResponses(data.submission?.responses || {});
      } catch {
        setConfig(businessHealthChecklistConfig);
      } finally {
        setLoading(false);
      }
    }

    loadChecklist();
  }, []);

  const groupedQuestions = useMemo(() => {
    const groups: Array<{ section: string; questions: FormQuestion[] }> = [];

    for (const question of config.questions) {
      const section = question.section || "Checklist";
      const existing = groups.find((group) => group.section === section);

      if (existing) existing.questions.push(question);
      else groups.push({ section, questions: [question] });
    }

    return groups;
  }, [config.questions]);

  function setResponse(questionId: string, value: string) {
    setResponses((prev) => ({ ...prev, [questionId]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/portal/questionnaires/${BUSINESS_HEALTH_CHECKLIST_TYPE}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = data.error || "Could not save the checklist.";
        setError(message);
        toast(message, "error");
        return;
      }

      const nextSubmission: ClientQuestionnaireSubmission = submission
        ? { ...submission, responses, updated_at: data.submitted_at || new Date().toISOString() }
        : {
            id: "local",
            client_id: "",
            questionnaire_type: BUSINESS_HEALTH_CHECKLIST_TYPE,
            responses,
            submitted_at: data.submitted_at || new Date().toISOString(),
            updated_at: data.submitted_at || new Date().toISOString(),
          };

      setSubmission(nextSubmission);
      toast("Checklist saved - Marc can review it in your portal.");
    } catch {
      setError("Could not save the checklist.");
      toast("Could not save the checklist.", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mt-8 rounded-2xl border border-[rgba(255,255,255,0.04)] bg-bg-card/80 p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-6 w-64 rounded-lg bg-[rgba(255,255,255,0.06)]" />
          <div className="h-4 w-full rounded-lg bg-[rgba(255,255,255,0.04)]" />
          <div className="h-20 w-full rounded-xl bg-[rgba(255,255,255,0.04)]" />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 rounded-2xl border border-[rgba(255,255,255,0.04)] bg-bg-card/80 p-6 sm:p-7">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 inline-flex rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-accent-bright">
            Final Step
          </div>
          <h2 className="text-2xl font-heading font-bold text-text-primary">{config.title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-text-secondary">
            {config.description}
          </p>
        </div>
        {submission && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300">
            Saved {new Date(submission.updated_at || submission.submitted_at).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </div>
        )}
      </div>

      {!isUnlocked && !submission ? (
        <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-bg-primary/70 p-5">
          <p className="text-sm font-medium text-text-primary">This checklist is locked for now.</p>
          <p className="mt-1 text-sm text-text-muted">
            Marc will let you know when this final onboarding step is ready.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-8">
          {groupedQuestions.map((group) => (
            <section key={group.section} className="space-y-5">
              <div>
                <h3 className="text-lg font-heading font-bold text-text-primary">{group.section}</h3>
                <div className="mt-2 h-px w-full bg-[linear-gradient(90deg,rgba(34,114,222,0.5),rgba(255,255,255,0.04),transparent)]" />
              </div>

              {group.questions.map((question) => (
                <div key={question.id} className="space-y-2">
                  <label className="block text-sm font-medium text-text-primary">
                    {question.label}
                    {question.required ? <span className="ml-1 text-accent-bright">*</span> : null}
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

          <div className="space-y-3">
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl gradient-accent px-5 py-4 text-sm font-semibold text-white transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {saving ? "Saving..." : submission ? "Save Updates" : (config.submit_label || "Submit")}
            </button>
            {error && <p className="text-center text-sm text-red-400">{error}</p>}
          </div>
        </form>
      )}
    </div>
  );
}
