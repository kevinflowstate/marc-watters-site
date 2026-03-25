"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/Toast";
import type { CheckinFormConfig } from "@/lib/types";

const moodColorMap: Record<string, string> = {
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  blue: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  red: "border-red-500/30 bg-red-500/10 text-red-400",
};

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
        }
      } catch {
        // Fallback config if fetch fails
        setConfig({
          checkin_day: "monday",
          mood_enabled: true,
          mood_options: [
            { value: "great", label: "Great", color: "emerald" },
            { value: "good", label: "Good", color: "blue" },
            { value: "okay", label: "Okay", color: "amber" },
            { value: "struggling", label: "Struggling", color: "red" },
          ],
          questions: [
            { id: "wins", label: "Wins this week", placeholder: "What went well? Any progress or breakthroughs?", type: "textarea", required: false },
            { id: "challenges", label: "Challenges", placeholder: "What are you finding difficult or stuck on?", type: "textarea", required: false },
            { id: "questions", label: "Questions for Marc", placeholder: "Anything you need help with or want to discuss?", type: "textarea", required: false },
          ],
        });
      }
    }
    loadConfig();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
      <div className="max-w-2xl">
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
      <div className="max-w-2xl">
        <div className="mb-8">
          <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-8 w-48 mb-2" />
          <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-4 w-72" />
        </div>
        <div className="space-y-6">
          <div>
            <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-4 w-52 mb-3" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse bg-[rgba(255,255,255,0.04)] rounded-xl h-12 border border-[rgba(255,255,255,0.06)]" />
              ))}
            </div>
          </div>
          {[...Array(3)].map((_, i) => (
            <div key={i}>
              <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-4 w-32 mb-2" />
              <div className="animate-pulse bg-[rgba(255,255,255,0.04)] rounded-xl h-24 border border-[rgba(255,255,255,0.06)]" />
            </div>
          ))}
          <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-xl h-14" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold text-text-primary">Weekly Check-In</h1>
        <p className="text-text-secondary mt-1">Let Marc know how you&apos;re getting on this week.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Mood */}
        {config.mood_enabled && config.mood_options.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-text-primary mb-3">How are you feeling this week?</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {config.mood_options.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMood(m.value)}
                  className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all cursor-pointer ${
                    mood === m.value
                      ? (moodColorMap[m.color] || "border-accent/30 bg-accent/10 text-accent-bright")
                      : "border-[rgba(255,255,255,0.06)] text-text-muted hover:border-[rgba(255,255,255,0.12)]"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Dynamic questions */}
        {config.questions.map((q) => (
          <div key={q.id}>
            <label className="block text-sm font-medium text-text-primary mb-2">{q.label}</label>
            <textarea
              value={responses[q.id] || ""}
              onChange={(e) => setResponses((prev) => ({ ...prev, [q.id]: e.target.value }))}
              rows={3}
              placeholder={q.placeholder}
              className="w-full bg-bg-card border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors resize-none"
            />
          </div>
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
