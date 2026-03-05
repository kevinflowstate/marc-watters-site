"use client";

import { useState, useEffect } from "react";
import type { CheckinFormConfig, BusinessPlanFormConfig, FormQuestion } from "@/lib/types";

function generateQuestionId() {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

export default function AdminSettingsPage() {
  // Create client form
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");

  // Check-in config
  const [checkinConfig, setCheckinConfig] = useState<CheckinFormConfig | null>(null);
  const [checkinSaving, setCheckinSaving] = useState(false);
  const [checkinMessage, setCheckinMessage] = useState("");

  // Business plan config
  const [bpConfig, setBpConfig] = useState<BusinessPlanFormConfig | null>(null);
  const [bpSaving, setBpSaving] = useState(false);
  const [bpMessage, setBpMessage] = useState("");

  useEffect(() => {
    async function loadConfigs() {
      const [checkinRes, bpRes] = await Promise.all([
        fetch("/api/admin/form-config?type=checkin"),
        fetch("/api/admin/form-config?type=business_plan"),
      ]);

      if (checkinRes.ok) {
        const data = await checkinRes.json();
        setCheckinConfig(data.config);
      }
      if (bpRes.ok) {
        const data = await bpRes.json();
        setBpConfig(data.config);
      }
    }
    loadConfigs();
  }, []);

  async function createClientAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !fullName.trim()) return;
    setCreating(true);
    setMessage("");

    try {
      const res = await fetch("/api/admin/create-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, full_name: fullName }),
      });

      const data = await res.json();
      if (data.error) {
        setMessage(`Error: ${data.error}`);
      } else {
        setMessage(`Client account created for ${email}. They will receive a password reset email.`);
        setEmail("");
        setFullName("");
      }
    } catch {
      setMessage("Failed to create client. Check the console for details.");
    }

    setCreating(false);
  }

  async function saveCheckinConfig() {
    if (!checkinConfig) return;
    setCheckinSaving(true);
    setCheckinMessage("");

    try {
      const res = await fetch("/api/admin/form-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "checkin", config: checkinConfig }),
      });

      if (res.ok) {
        setCheckinMessage("Saved");
        setTimeout(() => setCheckinMessage(""), 2000);
      } else {
        const data = await res.json();
        setCheckinMessage(`Error: ${data.error}`);
      }
    } catch {
      setCheckinMessage("Failed to save");
    }

    setCheckinSaving(false);
  }

  async function saveBpConfig() {
    if (!bpConfig) return;
    setBpSaving(true);
    setBpMessage("");

    try {
      const res = await fetch("/api/admin/form-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "business_plan", config: bpConfig }),
      });

      if (res.ok) {
        setBpMessage("Saved");
        setTimeout(() => setBpMessage(""), 2000);
      } else {
        const data = await res.json();
        setBpMessage(`Error: ${data.error}`);
      }
    } catch {
      setBpMessage("Failed to save");
    }

    setBpSaving(false);
  }

  function updateCheckinQuestion(index: number, updates: Partial<FormQuestion>) {
    if (!checkinConfig) return;
    const questions = [...checkinConfig.questions];
    questions[index] = { ...questions[index], ...updates };
    setCheckinConfig({ ...checkinConfig, questions });
  }

  function removeCheckinQuestion(index: number) {
    if (!checkinConfig) return;
    const questions = checkinConfig.questions.filter((_, i) => i !== index);
    setCheckinConfig({ ...checkinConfig, questions });
  }

  function addCheckinQuestion() {
    if (!checkinConfig) return;
    const newQ: FormQuestion = {
      id: generateQuestionId(),
      label: "",
      placeholder: "",
      type: "textarea",
      required: false,
    };
    setCheckinConfig({ ...checkinConfig, questions: [...checkinConfig.questions, newQ] });
  }

  function updateBpQuestion(index: number, updates: Partial<FormQuestion>) {
    if (!bpConfig) return;
    const questions = [...bpConfig.questions];
    questions[index] = { ...questions[index], ...updates };
    setBpConfig({ ...bpConfig, questions });
  }

  function removeBpQuestion(index: number) {
    if (!bpConfig) return;
    const questions = bpConfig.questions.filter((_, i) => i !== index);
    setBpConfig({ ...bpConfig, questions });
  }

  function addBpQuestion() {
    if (!bpConfig) return;
    const newQ: FormQuestion = {
      id: generateQuestionId(),
      label: "",
      placeholder: "",
      type: "textarea",
    };
    setBpConfig({ ...bpConfig, questions: [...bpConfig.questions, newQ] });
  }

  const inputClass = "w-full bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40";

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold text-text-primary">Admin Settings</h1>
        <p className="text-text-secondary mt-1">Manage portal configuration.</p>
      </div>

      {/* Create client */}
      <div className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-heading font-bold text-text-primary mb-4">Create Client Account</h2>
        <p className="text-text-muted text-sm mb-4">Add a new client to the portal. They will receive an email to set their password.</p>

        <form onSubmit={createClientAccount} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="John Smith"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="client@example.com"
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            disabled={creating || !email.trim() || !fullName.trim()}
            className="px-6 py-3 gradient-accent text-white rounded-xl text-sm font-semibold disabled:opacity-40 cursor-pointer transition-opacity"
          >
            {creating ? "Creating..." : "Create Client"}
          </button>
        </form>

        {message && (
          <div className={`mt-4 p-3 rounded-xl text-sm ${message.startsWith("Error") ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"}`}>
            {message}
          </div>
        )}
      </div>

      {/* Check-In Form Config */}
      <div className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-heading font-bold text-text-primary mb-1">Check-In Form</h2>
        <p className="text-text-muted text-sm mb-5">Configure the weekly check-in questions clients see.</p>

        {checkinConfig ? (
          <div className="space-y-5">
            {/* Check-in day */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">Check-in day</label>
              <select
                value={checkinConfig.checkin_day}
                onChange={(e) => setCheckinConfig({ ...checkinConfig, checkin_day: e.target.value })}
                className={inputClass}
              >
                {DAYS.map((d) => (
                  <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                ))}
              </select>
            </div>

            {/* Mood toggle */}
            <div className="flex items-center justify-between py-2">
              <div>
                <div className="text-sm font-medium text-text-primary">Mood selector</div>
                <div className="text-xs text-text-muted mt-0.5">Show mood options at top of check-in form</div>
              </div>
              <button
                type="button"
                onClick={() => setCheckinConfig({ ...checkinConfig, mood_enabled: !checkinConfig.mood_enabled })}
                className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${checkinConfig.mood_enabled ? "bg-accent" : "bg-[rgba(255,255,255,0.1)]"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${checkinConfig.mood_enabled ? "translate-x-5" : ""}`} />
              </button>
            </div>

            {/* Questions */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-3">Questions</label>
              <div className="space-y-3">
                {checkinConfig.questions.map((q, idx) => (
                  <div key={q.id} className="bg-bg-primary border border-[rgba(255,255,255,0.04)] rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          value={q.label}
                          onChange={(e) => updateCheckinQuestion(idx, { label: e.target.value })}
                          placeholder="Question label"
                          className="w-full bg-transparent border-b border-[rgba(255,255,255,0.06)] pb-1 text-sm font-medium text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40"
                        />
                        <input
                          type="text"
                          value={q.placeholder}
                          onChange={(e) => updateCheckinQuestion(idx, { placeholder: e.target.value })}
                          placeholder="Placeholder text"
                          className="w-full bg-transparent text-xs text-text-secondary placeholder:text-text-muted focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCheckinQuestion(idx)}
                        className="text-text-muted hover:text-red-400 transition-colors p-1 mt-0.5 cursor-pointer"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addCheckinQuestion}
                className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-[rgba(255,255,255,0.08)] hover:border-accent/30 rounded-xl text-xs text-text-muted hover:text-accent-bright transition-colors cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Question
              </button>
            </div>

            {/* Save */}
            <div className="flex items-center gap-3">
              <button
                onClick={saveCheckinConfig}
                disabled={checkinSaving}
                className="px-6 py-3 gradient-accent text-white rounded-xl text-sm font-semibold disabled:opacity-40 transition-opacity"
              >
                {checkinSaving ? "Saving..." : "Save Check-In Config"}
              </button>
              {checkinMessage && (
                <span className={`text-sm ${checkinMessage.startsWith("Error") ? "text-red-400" : "text-emerald-400"}`}>
                  {checkinMessage}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="text-text-muted text-sm">Loading config...</div>
        )}
      </div>

      {/* Business Plan Template */}
      <div className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-heading font-bold text-text-primary mb-1">Business Plan Template</h2>
        <p className="text-text-muted text-sm mb-5">Discovery questions shown when creating or editing a business plan.</p>

        {bpConfig ? (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-3">Discovery Questions</label>
              <div className="space-y-3">
                {bpConfig.questions.map((q, idx) => (
                  <div key={q.id} className="bg-bg-primary border border-[rgba(255,255,255,0.04)] rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          value={q.label}
                          onChange={(e) => updateBpQuestion(idx, { label: e.target.value })}
                          placeholder="Question label"
                          className="w-full bg-transparent border-b border-[rgba(255,255,255,0.06)] pb-1 text-sm font-medium text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40"
                        />
                        <input
                          type="text"
                          value={q.placeholder}
                          onChange={(e) => updateBpQuestion(idx, { placeholder: e.target.value })}
                          placeholder="Placeholder text"
                          className="w-full bg-transparent text-xs text-text-secondary placeholder:text-text-muted focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeBpQuestion(idx)}
                        className="text-text-muted hover:text-red-400 transition-colors p-1 mt-0.5 cursor-pointer"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}

                {bpConfig.questions.length === 0 && (
                  <p className="text-text-muted text-xs py-2">No discovery questions configured. Plans will go straight to the phase builder.</p>
                )}
              </div>

              <button
                type="button"
                onClick={addBpQuestion}
                className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-[rgba(255,255,255,0.08)] hover:border-accent/30 rounded-xl text-xs text-text-muted hover:text-accent-bright transition-colors cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Question
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={saveBpConfig}
                disabled={bpSaving}
                className="px-6 py-3 gradient-accent text-white rounded-xl text-sm font-semibold disabled:opacity-40 transition-opacity"
              >
                {bpSaving ? "Saving..." : "Save Template"}
              </button>
              {bpMessage && (
                <span className={`text-sm ${bpMessage.startsWith("Error") ? "text-red-400" : "text-emerald-400"}`}>
                  {bpMessage}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="text-text-muted text-sm">Loading config...</div>
        )}
      </div>

      {/* Info */}
      <div className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-6">
        <h2 className="text-lg font-heading font-bold text-text-primary mb-4">Portal Info</h2>
        <div className="space-y-3">
          <div className="flex justify-between py-2 border-b border-[rgba(255,255,255,0.04)]">
            <span className="text-sm text-text-muted">Portal URL</span>
            <span className="text-sm text-text-primary">/portal</span>
          </div>
          <div className="flex justify-between py-2 border-b border-[rgba(255,255,255,0.04)]">
            <span className="text-sm text-text-muted">Admin URL</span>
            <span className="text-sm text-text-primary">/admin</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-sm text-text-muted">Authentication</span>
            <span className="text-sm text-text-primary">Supabase Auth (Email/Password)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
