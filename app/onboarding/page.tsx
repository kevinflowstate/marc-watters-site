"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";

import "../admin/work/workspace.css";
import "../admin/glass.css";
import "./onboarding.css";
import { intakeFields } from "@/lib/client-intake";
import { Icon } from "@/components/ops/workspace/WorkspaceUI";

type Question = { id: string; label: string; placeholder: string; type: "text" | "tel" | "textarea" };
const groups: { title: string; questions: Question[] }[] = [
  {
    title: "About you",
    questions: [
      { id: "full_name", label: "Full name", placeholder: "Your full name", type: "text" },
      { id: "phone", label: "Mobile number", placeholder: "Include your area or country code", type: "tel" },
      { id: "home_address", label: intakeFields.home_address, placeholder: "House, street, town, postcode and country", type: "textarea" },
    ],
  },
  {
    title: "Your business",
    questions: [
      { id: "business_name", label: "Business name", placeholder: "e.g. Smith Construction Ltd", type: "text" },
      { id: "business_address", label: intakeFields.business_address, placeholder: "House, street, town, postcode and country", type: "textarea" },
      { id: "business_type", label: "What type of work does your business do?", placeholder: "e.g. Residential builds, joinery, fit-outs", type: "text" },
      { id: "staff_count", label: "How many people work in the business?", placeholder: "e.g. 8 including yourself", type: "text" },
      { id: "annual_turnover", label: "Rough annual turnover", placeholder: "e.g. 500k-750k", type: "text" },
    ],
  },
  {
    title: "Where you are heading",
    questions: [
      { id: "biggest_challenge", label: "What is the single biggest challenge in your business right now?", placeholder: "Be honest - this helps Marc tailor the programme to you", type: "textarea" },
      { id: "goals", label: "Where do you want to be in 12 months?", placeholder: "What does success look like for you?", type: "textarea" },
    ],
  },
];
const pairs = new Set(["staff_count", "annual_turnover"]);

const tips = [
  { icon: "home", title: "On iPhone", line: "Open the portal in Safari, tap Share, then Add to Home Screen." },
  { icon: "plus", title: "On Android", line: "Open the Chrome menu and choose Install app or Add to Home screen." },
  { icon: "bell", title: "Turn on notifications", line: "Open the installed app, go to Settings, turn on notifications and tap Allow." },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<"video" | "form" | "done">("video");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    fetch("/api/portal/me").then(r => r.ok ? r.json() : null).then(data => {
      if (active && data) setAnswers(current => ({ full_name: data.fullName || "", phone: data.profile?.phone || "", business_name: data.profile?.business_name || "", goals: data.profile?.goals || "", ...current }));
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  function updateAnswer(id: string, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/portal/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answers),
      });

      if (res.ok) {
        setStep("done");
        setTimeout(() => router.push("/portal"), 3000);
      } else {
        setError((await res.json()).error || "Your profile could not be saved.");
      }
    } catch {
      setError("Connection interrupted. Your answers are still here. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const stepIndex = step === "video" ? 0 : step === "form" ? 1 : 2;
  const firstName = (answers.full_name || "").trim().split(/\s+/)[0];
  let fieldIndex = 0;

  function field(q: Question) {
    const required = q.id in intakeFields;
    const i = fieldIndex++;
    return (
      <div className="ob-field" key={q.id} style={{ "--i": i } as CSSProperties}>
        <label htmlFor={q.id}>
          {q.label}
          {!required && <em>Optional</em>}
        </label>
        {q.type === "textarea" ? (
          <textarea
            id={q.id}
            required={required}
            value={answers[q.id] || ""}
            onChange={(e) => updateAnswer(q.id, e.target.value)}
            placeholder={q.placeholder}
            rows={3}
            className="ob-input"
          />
        ) : (
          <input
            id={q.id}
            required={required}
            type={q.type}
            autoComplete={q.id === "full_name" ? "name" : q.id === "phone" ? "tel" : q.id === "business_name" ? "organization" : undefined}
            value={answers[q.id] || ""}
            onChange={(e) => updateAnswer(q.id, e.target.value)}
            placeholder={q.placeholder}
            className="ob-input"
          />
        )}
      </div>
    );
  }

  return (
    <main className="ws ob">
      <div className="ob-wrap lg-stage">
        <div className="ob-brand lg-rise">
          <i aria-hidden="true">CB</i>
          Construction Business Blueprint
        </div>

        <ol className="ob-steps" aria-label="Setup progress">
          {["Welcome", "Profile", "Start"].map((label, i) => (
            <li
              key={label}
              className={`ob-step ${i === stepIndex ? "is-on" : i < stepIndex ? "is-done" : ""}`}
              aria-current={i === stepIndex ? "step" : undefined}
            >
              <div className="ob-step-bar"><i /></div>
              {label}
            </li>
          ))}
        </ol>

        {step === "video" && (
          <section key="welcome" className="lg-card lg-rise ob-sheet" style={{ "--i": 1 } as CSSProperties}>
            <h1>Welcome to the Blueprint{firstName ? `, ${firstName}` : ""}</h1>
            <p className="ob-lead">
              Your portal is where your training, check-ins and messages with Marc live. Add it to your home screen so it works like an app.
            </p>
            <div className="ob-tips">
              {tips.map((t, i) => (
                <div className="ob-tip" key={t.title} style={{ "--i": i } as CSSProperties}>
                  <span className="lg-q-ic" aria-hidden="true">
                    <Icon name={t.icon} size={16} />
                  </span>
                  <span className="ob-tip-copy">
                    <b>{t.title}</b>
                    <span>{t.line}</span>
                  </span>
                </div>
              ))}
            </div>
            <div className="ob-actions">
              <button onClick={() => setStep("form")} className="ob-cta ws-focus">
                Continue to your profile
                <Icon name="arrow" size={16} />
              </button>
            </div>
          </section>
        )}

        {step === "form" && (
          <section key="form" className="lg-card lg-rise ob-sheet" style={{ "--i": 1 } as CSSProperties}>
            <h1>Tell Marc about your business</h1>
            <p className="ob-lead">
              This helps Marc tailor the programme to your situation. The more he knows, the more he can help.
            </p>

            <form onSubmit={event => { event.preventDefault(); void handleSubmit(); }}>
              <div className="ob-form">
                {groups.map((g) => {
                  const rows: Question[][] = [];
                  for (const q of g.questions) {
                    const last = rows.at(-1);
                    if (pairs.has(q.id) && last && last.length === 1 && pairs.has(last[0].id)) last.push(q);
                    else rows.push([q]);
                  }
                  return (
                    <div className="ob-group" key={g.title}>
                      <div className="ob-group-h">{g.title}</div>
                      {rows.map((row) =>
                        row.length > 1 ? (
                          <div className="ob-two" key={row[0].id}>{row.map(field)}</div>
                        ) : (
                          field(row[0])
                        ),
                      )}
                    </div>
                  );
                })}
              </div>

              {error && (
                <div role="alert" className="ws-note is-attn mt-5">
                  <Icon name="alert" size={15} />
                  <span>{error}</span>
                </div>
              )}

              <div className="ob-actions">
                <button type="button" onClick={() => setStep("video")} className="ob-back ws-focus">
                  Back
                </button>
                <button type="submit" disabled={submitting} className="ob-cta ws-focus">
                  {submitting ? (
                    <>
                      <Icon name="refresh" size={16} className="lg-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      Complete setup
                      <Icon name="arrow" size={16} />
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>
        )}

        {step === "done" && (
          <section key="done" className="lg-card lg-rise ob-sheet ob-done" role="status">
            <div className="ob-tick" aria-hidden="true">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1>You&apos;re all set</h1>
            <p className="ob-lead">
              Your portal is ready. Marc will review your profile and your first training modules are waiting for you.
            </p>
            <div className="ob-redirect" aria-hidden="true"><i /></div>
            <p className="ws-caption mt-2">Taking you to your portal…</p>
          </section>
        )}
      </div>
    </main>
  );
}
