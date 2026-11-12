"use client";

import { useState, useEffect } from "react";
import type { CheckinFormConfig, BusinessPlanFormConfig, FormQuestion } from "@/lib/types";
import { Icon } from "@/components/ops/workspace/WorkspaceUI";

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
      const res = await fetch("/api/admin/invite-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: fullName }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || data?.error) {
        setMessage(`Error: ${data?.error || "Failed to create client account"}`);
      } else {
        const action = data.alreadyExisted ? "Password reset" : "Client account";
        const delivery = data.emailSent
          ? data.alreadyExisted ? "email sent." : "setup email sent."
          : "link generated. Use the Clients page if you need to copy it manually.";
        setMessage(`${action} for ${email}. ${delivery}`);
        setEmail("");
        setFullName("");
      }
    } catch {
      setMessage("Failed to create client account. Please try again.");
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

  const inputClass = "ws-input";

  return (
    <div className="ws ws-page ws-st">
      <div className="ws-ph">
        <div className="min-w-0">
          <h1 className="ws-title">Admin settings</h1>
          <p className="ws-meta mt-1">Manage portal configuration.</p>
        </div>
      </div>

      {/* Create client */}
      <section className="ws-panel" aria-label="Create client account">
        <header className="ws-panel-head ws-st-head">
          <h2 className="ws-h2">Create client account</h2>
          <p className="ws-caption">Add a new client to the portal. They will receive an email to set their password.</p>
        </header>

        <form onSubmit={createClientAccount} className="ws-st-body">
          <div>
            <label className="ws-label" htmlFor="st-name">Full name</label>
            <input
              id="st-name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="John Smith"
              className={inputClass}
            />
          </div>
          <div>
            <label className="ws-label" htmlFor="st-email">Email</label>
            <input
              id="st-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="client@example.com"
              className={inputClass}
            />
          </div>
          <div className="ws-st-save">
            <button
              type="submit"
              disabled={creating || !email.trim() || !fullName.trim()}
              className="ws-btn ws-btn-primary ws-focus"
            >
              {creating ? "Creating..." : "Create client"}
            </button>
          </div>

          {message && (
            <div className={`ws-note ${message.startsWith("Error") ? "is-bad" : "is-ok"}`} role={message.startsWith("Error") ? "alert" : "status"}>
              <Icon name={message.startsWith("Error") ? "alert" : "checkCircle"} size={15} />
              <span>{message}</span>
            </div>
          )}
        </form>
      </section>

      {/* Check-In Form Config */}
      <section className="ws-panel" aria-label="Check-in form">
        <header className="ws-panel-head ws-st-head">
          <h2 className="ws-h2">Check-in form</h2>
          <p className="ws-caption">Configure the weekly check-in questions clients see.</p>
        </header>

        {checkinConfig ? (
          <div className="ws-st-body">
            {/* Check-in day */}
            <div>
              <label className="ws-label" htmlFor="st-day">Check-in day</label>
              <select
                id="st-day"
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
            <div className="ws-st-toggle">
              <div className="min-w-0">
                <div className="ws-st-toggle-t">Mood selector</div>
                <div className="ws-caption">Show mood options at top of check-in form</div>
              </div>
              <button
                type="button"
                onClick={() => setCheckinConfig({ ...checkinConfig, mood_enabled: !checkinConfig.mood_enabled })}
                aria-label="Mood selector"
                aria-pressed={!!checkinConfig.mood_enabled}
                className={`ws-switch ws-focus ${checkinConfig.mood_enabled ? "is-on" : ""}`}
              >
                <span />
              </button>
            </div>

            {/* Questions */}
            <div>
              <label className="ws-label">Questions</label>
              <div className="ws-st-qs">
                {checkinConfig.questions.map((q, idx) => (
                  <div key={q.id} className="ws-st-q">
                    <div className="ws-st-q-f">
                      <input
                        type="text"
                        value={q.label}
                        onChange={(e) => updateCheckinQuestion(idx, { label: e.target.value })}
                        placeholder="Question label"
                        aria-label="Question label"
                        className="ws-input ws-st-q-l"
                      />
                      <input
                        type="text"
                        value={q.placeholder}
                        onChange={(e) => updateCheckinQuestion(idx, { placeholder: e.target.value })}
                        placeholder="Placeholder text"
                        aria-label="Placeholder text"
                        className="ws-input ws-st-q-p"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCheckinQuestion(idx)}
                      className="ws-btn ws-btn-quiet ws-btn-icon ws-focus ws-st-del"
                      aria-label="Remove question"
                    >
                      <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addCheckinQuestion}
                className="ws-btn ws-btn-sm ws-focus ws-st-add"
              >
                <Icon name="plus" size={13} />
                Add question
              </button>
            </div>

            {/* Save */}
            <div className="ws-st-save">
              <button
                type="button"
                onClick={saveCheckinConfig}
                disabled={checkinSaving}
                className="ws-btn ws-btn-primary ws-focus"
              >
                {checkinSaving ? "Saving..." : "Save check-in config"}
              </button>
              {checkinMessage && (
                <span className={`ws-st-msg ${checkinMessage.startsWith("Error") ? "is-bad" : "is-ok"}`}>
                  {checkinMessage}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="ws-st-body ws-caption">Loading config...</div>
        )}
      </section>

      {/* Business Plan Template */}
      <section className="ws-panel" aria-label="Business plan template">
        <header className="ws-panel-head ws-st-head">
          <h2 className="ws-h2">Business plan template</h2>
          <p className="ws-caption">Discovery questions shown when creating or editing a business plan.</p>
        </header>

        {bpConfig ? (
          <div className="ws-st-body">
            <div>
              <label className="ws-label">Discovery questions</label>
              <div className="ws-st-qs">
                {bpConfig.questions.map((q, idx) => (
                  <div key={q.id} className="ws-st-q">
                    <div className="ws-st-q-f">
                      <input
                        type="text"
                        value={q.label}
                        onChange={(e) => updateBpQuestion(idx, { label: e.target.value })}
                        placeholder="Question label"
                        aria-label="Question label"
                        className="ws-input ws-st-q-l"
                      />
                      <input
                        type="text"
                        value={q.placeholder}
                        onChange={(e) => updateBpQuestion(idx, { placeholder: e.target.value })}
                        placeholder="Placeholder text"
                        aria-label="Placeholder text"
                        className="ws-input ws-st-q-p"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeBpQuestion(idx)}
                      className="ws-btn ws-btn-quiet ws-btn-icon ws-focus ws-st-del"
                      aria-label="Remove question"
                    >
                      <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                  </div>
                ))}

                {bpConfig.questions.length === 0 && (
                  <p className="ws-caption ws-st-none">No discovery questions configured. Plans will go straight to the phase builder.</p>
                )}
              </div>

              <button
                type="button"
                onClick={addBpQuestion}
                className="ws-btn ws-btn-sm ws-focus ws-st-add"
              >
                <Icon name="plus" size={13} />
                Add question
              </button>
            </div>

            <div className="ws-st-save">
              <button
                type="button"
                onClick={saveBpConfig}
                disabled={bpSaving}
                className="ws-btn ws-btn-primary ws-focus"
              >
                {bpSaving ? "Saving..." : "Save template"}
              </button>
              {bpMessage && (
                <span className={`ws-st-msg ${bpMessage.startsWith("Error") ? "is-bad" : "is-ok"}`}>
                  {bpMessage}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="ws-st-body ws-caption">Loading config...</div>
        )}
      </section>

      {/* Info */}
      <section className="ws-panel" aria-label="Portal info">
        <header className="ws-panel-head">
          <h2 className="ws-h2">Portal info</h2>
        </header>
        <dl className="ws-props ws-st-props">
          <dt>Portal URL</dt>
          <dd>/portal</dd>
          <dt>Admin URL</dt>
          <dd>/admin</dd>
          <dt>Authentication</dt>
          <dd>Supabase Auth (Email/Password)</dd>
        </dl>
      </section>
    </div>
  );
}
