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
      <div className="ws-tr-q">
        <div className="ws-tr-opts">
          {question.options?.map((option) => {
            const selected = value === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange(question.id, option.value)}
                className={`ws-tr-opt ws-focus${selected ? " is-on" : ""}`}
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
            className="ws-input"
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
      <div className="ws-tr-q">
        <div className="ws-tr-scale-l">
          <span>{question.min_label || min}</span>
          <span>{question.max_label || max}</span>
        </div>
        <div className="ws-tr-scale">
          {values.map((item) => {
            const selected = value === item;
            return (
              <button
                key={item}
                type="button"
                onClick={() => onChange(question.id, item)}
                className={`ws-tr-opt is-num ws-focus${selected ? " is-on" : ""}`}
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
        className="ws-input"
      />
    );
  }

  return (
    <textarea
      value={value}
      onChange={(e) => onChange(question.id, e.target.value)}
      rows={4}
      placeholder={question.placeholder}
      className="ws-input"
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
      <div className="ws-panel ws-tr-check">
        <div className="ws-tr-check-b">
          <span className="ws-skel" style={{ width: 240, height: 16 }} />
          <span className="ws-skel" style={{ width: "100%", height: 12 }} />
          <span className="ws-skel" style={{ width: "100%", height: 64 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="ws-panel ws-tr-check">
      <div className="ws-tr-check-head">
        <div className="min-w-0">
          <span className="ws-chip is-decide">Final step</span>
          <h2 className="ws-tr-check-t">{config.title}</h2>
          <p className="ws-meta mt-1">
            {config.description}
          </p>
        </div>
        {submission && (
          <div className="ws-chip is-ok">
            Saved {new Date(submission.updated_at || submission.submitted_at).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </div>
        )}
      </div>

      {!isUnlocked && !submission ? (
        <div className="ws-tr-check-b">
          <p className="ws-h2">This checklist is locked for now.</p>
          <p className="ws-caption mt-1">
            Marc will let you know when this final onboarding step is ready.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="ws-tr-check-b ws-tr-form-gap">
          {groupedQuestions.map((group) => (
            <section key={group.section} className="ws-tr-check-sec">
              <h3 className="ws-tr-check-h">{group.section}</h3>

              {group.questions.map((question) => (
                <div key={question.id} className="ws-tr-q">
                  <label className="ws-label" style={{ marginBottom: 0 }}>
                    {question.label}
                    {question.required ? <span className="ml-1" style={{ color: "var(--ws-accent-ink)" }}>*</span> : null}
                  </label>
                  {question.help_text && (
                    <p className="ws-caption">{question.help_text}</p>
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

          <div className="ws-tr-q">
            <button
              type="submit"
              disabled={saving}
              className="ws-btn ws-btn-primary ws-focus ws-tr-submit"
            >
              {saving ? "Saving..." : submission ? "Save Updates" : (config.submit_label || "Submit")}
            </button>
            {error && <p className="ws-caption" style={{ color: "var(--ws-bad)", textAlign: "center" }}>{error}</p>}
          </div>
        </form>
      )}
    </div>
  );
}
