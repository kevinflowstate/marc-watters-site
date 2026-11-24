"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { installWelcome, intakeFields } from "@/lib/client-intake";

const questions = [
  {id:"full_name",label:"Full name",placeholder:"Your full name",type:"text" as const},
  {id:"phone",label:"Mobile number",placeholder:"Include your area or country code",type:"tel" as const},
  {id:"home_address",label:intakeFields.home_address,placeholder:"House, street, town, postcode and country",type:"textarea" as const},
  {id:"business_address",label:intakeFields.business_address,placeholder:"House, street, town, postcode and country",type:"textarea" as const},
  { id: "business_name", label: "Business Name", placeholder: "e.g. Smith Construction Ltd", type: "text" as const },
  { id: "business_type", label: "What type of work does your business do?", placeholder: "e.g. Residential builds, joinery, fit-outs", type: "text" as const },
  { id: "staff_count", label: "How many people work in the business?", placeholder: "e.g. 8 including yourself", type: "text" as const },
  { id: "annual_turnover", label: "Rough annual turnover", placeholder: "e.g. 500k-750k", type: "text" as const },
  { id: "biggest_challenge", label: "What is the single biggest challenge in your business right now?", placeholder: "Be honest - this helps Marc tailor the programme to you", type: "textarea" as const },
  { id: "goals", label: "Where do you want to be in 12 months?", placeholder: "What does success look like for you?", type: "textarea" as const },
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

  return (
    <main className="min-h-screen bg-bg-primary flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Progress indicator */}
        <div className="flex items-center gap-3 mb-8">
          {["Welcome", "Profile", "Start"].map((label, i) => {
            const stepIndex = step === "video" ? 0 : step === "form" ? 1 : 2;
            const isActive = i === stepIndex;
            const isDone = i < stepIndex;
            return (
              <div key={label} className="flex items-center gap-2 flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${
                  isDone ? "bg-emerald-500 text-white" : isActive ? "gradient-accent text-white" : "bg-[rgba(255,255,255,0.06)] text-text-muted"
                }`}>
                  {isDone ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <span className={`text-xs font-medium ${isActive ? "text-text-primary" : "text-text-muted"}`}>{label}</span>
                {i < 2 && <div className={`flex-1 h-px ${isDone ? "bg-emerald-500/40" : "bg-[rgba(255,255,255,0.06)]"}`} />}
              </div>
            );
          })}
        </div>

        {/* Step 1: Video */}
        {step === "video" && (
          <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(255,255,255,0.06)] rounded-2xl overflow-hidden">
            <div className="p-6 sm:p-8">
              <h1 className="text-2xl font-heading font-bold text-text-primary mb-2">Welcome to the Blueprint</h1>
              <p className="text-text-secondary text-sm leading-relaxed mb-6">
                {installWelcome}
              </p>
            </div>

            <div className="p-6 sm:p-8">
              <button
                onClick={() => setStep("form")}
                className="w-full py-3.5 gradient-accent text-white rounded-xl text-sm font-semibold cursor-pointer transition-opacity hover:opacity-90"
              >
                Continue to Your Profile
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Questionnaire */}
        {step === "form" && (
          <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(255,255,255,0.06)] rounded-2xl p-6 sm:p-8">
            <h1 className="text-2xl font-heading font-bold text-text-primary mb-2">Tell Marc About Your Business</h1>
            <p className="text-text-secondary text-sm leading-relaxed mb-8">
              This helps Marc tailor the programme to your specific situation. Be honest - the more he knows, the more he can help.
            </p>

            <form onSubmit={event => { event.preventDefault(); void handleSubmit(); }}>
            <div className="space-y-5">
              {questions.map((q) => (
                <div key={q.id}>
                  <label htmlFor={q.id} className="block text-sm font-medium text-text-primary mb-2">{q.label}{q.id in intakeFields ? " (required)" : ""}</label>
                  {q.type === "textarea" ? (
                    <textarea id={q.id} required={q.id in intakeFields}
                      value={answers[q.id] || ""}
                      onChange={(e) => updateAnswer(q.id, e.target.value)}
                      placeholder={q.placeholder}
                      rows={3}
                      className="w-full bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40 resize-none"
                    />
                  ) : (
                    <input
                      id={q.id} required={q.id in intakeFields} type={q.type}
                      value={answers[q.id] || ""}
                      onChange={(e) => updateAnswer(q.id, e.target.value)}
                      placeholder={q.placeholder}
                      className="w-full bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40"
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-8">
              <button
                type="button" onClick={() => setStep("video")}
                className="px-5 py-3 text-text-muted text-sm hover:text-text-secondary cursor-pointer"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-3.5 gradient-accent text-white rounded-xl text-sm font-semibold cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Complete Setup"}
              </button>
            </div>
            {error && <p role="alert" className="mt-3 text-red-300">{error}</p>}
            </form>
          </div>
        )}

        {/* Step 3: Done */}
        {step === "done" && (
          <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(255,255,255,0.06)] rounded-2xl p-8 sm:p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-heading font-bold text-text-primary mb-2">You&apos;re All Set</h1>
            <p className="text-text-secondary text-sm leading-relaxed mb-6">
              Your portal is ready. Marc will review your profile and your first training modules are waiting for you.
            </p>
            <p className="text-text-muted text-xs">Redirecting to your portal...</p>
          </div>
        )}
      </div>
    </main>
  );
}
