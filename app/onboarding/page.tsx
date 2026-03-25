"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const questions = [
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

  function updateAnswer(id: string, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/portal/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: answers.business_name,
          businessType: answers.business_type,
          goals: answers.goals,
        }),
      });

      if (res.ok) {
        setStep("done");
        setTimeout(() => router.push("/portal"), 3000);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-bg-primary flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Progress indicator */}
        <div className="flex items-center gap-3 mb-8">
          {["Watch", "Profile", "Start"].map((label, i) => {
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
                Watch this short video from Marc before you get started. It covers what to expect, how the programme works, and what you need to do in your first week.
              </p>
            </div>

            {/* Video embed placeholder */}
            <div className="relative w-full bg-black" style={{ paddingBottom: "56.25%" }}>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-8 h-8 text-accent-bright ml-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                  <p className="text-text-muted text-sm">Onboarding video - to be added by Marc</p>
                </div>
              </div>
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

            <div className="space-y-5">
              {questions.map((q) => (
                <div key={q.id}>
                  <label className="block text-sm font-medium text-text-primary mb-2">{q.label}</label>
                  {q.type === "textarea" ? (
                    <textarea
                      value={answers[q.id] || ""}
                      onChange={(e) => updateAnswer(q.id, e.target.value)}
                      placeholder={q.placeholder}
                      rows={3}
                      className="w-full bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40 resize-none"
                    />
                  ) : (
                    <input
                      type="text"
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
                onClick={() => setStep("video")}
                className="px-5 py-3 text-text-muted text-sm hover:text-text-secondary cursor-pointer"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 py-3.5 gradient-accent text-white rounded-xl text-sm font-semibold cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Complete Setup"}
              </button>
            </div>
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
            <h1 className="text-2xl font-heading font-bold text-text-primary mb-2">You're All Set</h1>
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
