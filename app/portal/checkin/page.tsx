"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CheckInMood } from "@/lib/types";

const moods: { value: CheckInMood; label: string; color: string }[] = [
  { value: "great", label: "Great", color: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" },
  { value: "good", label: "Good", color: "border-blue-500/30 bg-blue-500/10 text-blue-400" },
  { value: "okay", label: "Okay", color: "border-amber-500/30 bg-amber-500/10 text-amber-400" },
  { value: "struggling", label: "Struggling", color: "border-red-500/30 bg-red-500/10 text-red-400" },
];

export default function CheckInPage() {
  const [mood, setMood] = useState<CheckInMood | null>(null);
  const [wins, setWins] = useState("");
  const [challenges, setChallenges] = useState("");
  const [questions, setQuestions] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mood) return;
    setSubmitting(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("client_profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) return;

    // Get current week number
    const { data: lastCheckin } = await supabase
      .from("checkins")
      .select("week_number")
      .eq("client_id", profile.id)
      .order("week_number", { ascending: false })
      .limit(1)
      .single();

    const weekNumber = (lastCheckin?.week_number || 0) + 1;

    await supabase.from("checkins").insert({
      client_id: profile.id,
      week_number: weekNumber,
      mood,
      wins: wins || null,
      challenges: challenges || null,
      questions: questions || null,
    });

    // Update last checkin timestamp
    await supabase
      .from("client_profiles")
      .update({ last_checkin: new Date().toISOString() })
      .eq("id", profile.id);

    setSubmitted(true);
    setSubmitting(false);
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
            onClick={() => { setSubmitted(false); setMood(null); setWins(""); setChallenges(""); setQuestions(""); }}
            className="mt-6 px-6 py-3 gradient-accent text-white rounded-xl text-sm font-medium"
          >
            Submit Another
          </button>
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
        <div>
          <label className="block text-sm font-medium text-text-primary mb-3">How are you feeling this week?</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {moods.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMood(m.value)}
                className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                  mood === m.value ? m.color : "border-[rgba(255,255,255,0.06)] text-text-muted hover:border-[rgba(255,255,255,0.12)]"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Wins */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">Wins this week</label>
          <textarea
            value={wins}
            onChange={(e) => setWins(e.target.value)}
            rows={3}
            placeholder="What went well? Any progress or breakthroughs?"
            className="w-full bg-bg-card border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors resize-none"
          />
        </div>

        {/* Challenges */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">Challenges</label>
          <textarea
            value={challenges}
            onChange={(e) => setChallenges(e.target.value)}
            rows={3}
            placeholder="What are you finding difficult or stuck on?"
            className="w-full bg-bg-card border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors resize-none"
          />
        </div>

        {/* Questions */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">Questions for Marc</label>
          <textarea
            value={questions}
            onChange={(e) => setQuestions(e.target.value)}
            rows={3}
            placeholder="Anything you need help with or want to discuss?"
            className="w-full bg-bg-card border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={!mood || submitting}
          className="w-full py-4 gradient-accent text-white rounded-xl text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          {submitting ? "Submitting..." : "Submit Check-In"}
        </button>
      </form>
    </div>
  );
}
