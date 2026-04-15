"use client";

import { useState, useEffect } from "react";
import type { BusinessPlan, BusinessPlanPhase, BusinessPlanItem, TrainingModule, BusinessPlanFormConfig } from "@/lib/types";
import TrainingPicker from "./TrainingPicker";

interface BusinessPlanBuilderProps {
  clientId: string;
  existingPlan?: BusinessPlan;
  onSave: (plan: BusinessPlan) => void;
  onCancel: () => void;
  saving?: boolean;
  error?: string | null;
}

function generateId() {
  return crypto.randomUUID();
}

function createEmptyPhase(orderIndex: number): BusinessPlanPhase {
  return {
    id: generateId(),
    name: `Phase ${orderIndex + 1}`,
    notes: "",
    order_index: orderIndex,
    items: [],
    linked_trainings: [],
  };
}

export default function BusinessPlanBuilder({
  clientId,
  existingPlan,
  onSave,
  onCancel,
  saving = false,
  error = null,
}: BusinessPlanBuilderProps) {
  const [summary, setSummary] = useState(existingPlan?.summary || "");
  const [phases, setPhases] = useState<BusinessPlanPhase[]>(
    existingPlan?.phases.length ? existingPlan.phases : [createEmptyPhase(0)]
  );
  const [newItemTexts, setNewItemTexts] = useState<Record<string, string>>({});
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [contentLookup, setContentLookup] = useState<Map<string, { title: string }>>(new Map());
  const [bpConfig, setBpConfig] = useState<BusinessPlanFormConfig | null>(null);
  const [discoveryAnswers, setDiscoveryAnswers] = useState<Record<string, string>>(
    existingPlan?.discovery_answers || {}
  );
  const [pdfUrl, setPdfUrl] = useState(existingPlan?.pdf_url || "");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [trainingRes, configRes] = await Promise.all([
          fetch("/api/admin/training"),
          fetch("/api/admin/form-config?type=business_plan"),
        ]);

        if (trainingRes.ok) {
          const data = await trainingRes.json();
          setModules(data.modules || []);
          const lookup = new Map<string, { title: string }>();
          for (const mod of data.modules || []) {
            for (const c of mod.content || []) {
              lookup.set(c.id, { title: c.title });
            }
          }
          setContentLookup(lookup);
        }

        if (configRes.ok) {
          const data = await configRes.json();
          setBpConfig(data.config);
        }
      } catch { /* ignore */ }
    }
    loadData();
  }, []);

  const isEditing = !!existingPlan;

  function updatePhase(phaseId: string, updates: Partial<BusinessPlanPhase>) {
    setPhases((prev) => prev.map((p) => (p.id === phaseId ? { ...p, ...updates } : p)));
  }

  function addPhase() {
    setPhases((prev) => [...prev, createEmptyPhase(prev.length)]);
  }

  function removePhase(phaseId: string) {
    setPhases((prev) => {
      const filtered = prev.filter((p) => p.id !== phaseId);
      return filtered.map((p, i) => ({ ...p, order_index: i }));
    });
  }

  function addItem(phaseId: string) {
    const text = newItemTexts[phaseId]?.trim();
    if (!text) return;
    const phase = phases.find((p) => p.id === phaseId);
    if (!phase) return;
    const newItem: BusinessPlanItem = {
      id: generateId(),
      category: phase.name,
      title: text,
      completed: false,
    };
    updatePhase(phaseId, { items: [...phase.items, newItem] });
    setNewItemTexts((prev) => ({ ...prev, [phaseId]: "" }));
  }

  function removeItem(phaseId: string, itemId: string) {
    const phase = phases.find((p) => p.id === phaseId);
    if (!phase) return;
    updatePhase(phaseId, { items: phase.items.filter((i) => i.id !== itemId) });
  }

  function toggleTraining(phaseId: string, contentId: string) {
    const phase = phases.find((p) => p.id === phaseId);
    if (!phase) return;
    const linked = phase.linked_trainings.includes(contentId)
      ? phase.linked_trainings.filter((id) => id !== contentId)
      : [...phase.linked_trainings, contentId];
    updatePhase(phaseId, { linked_trainings: linked });
  }

  function handleSave() {
    const plan: BusinessPlan = {
      id: existingPlan?.id || generateId(),
      client_id: clientId,
      summary,
      status: "active",
      created_at: existingPlan?.created_at || new Date().toISOString(),
      phases,
      discovery_answers: Object.keys(discoveryAnswers).length > 0 ? discoveryAnswers : undefined,
      pdf_url: pdfUrl || undefined,
    };
    onSave(plan);
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />

      {/* Slide-over panel */}
      <div className="relative ml-auto w-full max-w-2xl bg-bg-primary border-l border-[rgba(255,255,255,0.06)] overflow-y-auto animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-bg-primary/95 backdrop-blur-sm border-b border-[rgba(255,255,255,0.06)] px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-heading font-bold text-text-primary">
            {isEditing ? "Edit Business Plan" : "Create Business Plan"}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              disabled={saving}
              className="px-4 py-2 text-xs font-medium text-text-muted hover:text-text-primary border border-[rgba(255,255,255,0.08)] rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !summary.trim() || phases.length === 0}
              className="px-4 py-2 text-xs font-semibold text-white gradient-accent rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
            >
              {saving ? "Saving..." : "Save Plan"}
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Discovery Questions */}
          {bpConfig && bpConfig.questions.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
                Discovery Questions
              </label>
              <div className="space-y-3">
                {bpConfig.questions.map((q) => (
                  <div key={q.id}>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">{q.label}</label>
                    <textarea
                      value={discoveryAnswers[q.id] || ""}
                      onChange={(e) => setDiscoveryAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                      rows={2}
                      placeholder={q.placeholder}
                      className="w-full bg-bg-card border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors resize-none"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          {/* PDF Upload */}
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
              Plan Document (PDF)
            </label>
            {pdfUrl ? (
              <div className="flex items-center gap-3 bg-bg-card border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3">
                <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-accent-bright no-underline hover:underline flex-1 truncate">
                  View uploaded PDF
                </a>
                <button
                  onClick={() => setPdfUrl("")}
                  className="text-xs text-text-muted hover:text-red-400 transition-colors cursor-pointer"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploading(true);
                    const fd = new FormData();
                    fd.append("file", file);
                    fd.append("bucket", "plan-documents");
                    try {
                      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
                      if (res.ok) {
                        const data = await res.json();
                        setPdfUrl(data.url);
                      } else {
                        alert("Upload failed");
                      }
                    } finally {
                      setUploading(false);
                    }
                  }}
                  className="w-full bg-bg-card border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-accent/10 file:text-accent-bright hover:file:bg-accent/20"
                />
                {uploading && <p className="text-xs text-text-muted mt-1">Uploading...</p>}
                <p className="text-xs text-text-muted mt-1">Upload the PDF version of this plan. Clients can view and download it.</p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
              Plan Summary
            </label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              placeholder="Overview of the project - what's the big picture goal for this client?"
              className="w-full bg-bg-card border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors resize-none"
            />
          </div>

          {/* Phases */}
          <div className="space-y-4">
            {phases.map((phase, idx) => (
              <div key={phase.id} className="bg-bg-card/80 border border-[rgba(255,255,255,0.06)] rounded-2xl overflow-hidden">
                {/* Phase header */}
                <div className="px-4 py-3 border-b border-[rgba(255,255,255,0.04)] flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center text-xs font-bold text-accent-bright flex-shrink-0">
                    {idx + 1}
                  </div>
                  <input
                    type="text"
                    value={phase.name}
                    onChange={(e) => updatePhase(phase.id, { name: e.target.value })}
                    className="flex-1 bg-transparent text-sm font-semibold text-text-primary placeholder:text-text-muted focus:outline-none"
                    placeholder="Phase name..."
                  />
                  {phases.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePhase(phase.id)}
                      className="text-text-muted hover:text-red-400 transition-colors p-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>

                <div className="p-4 space-y-4">
                  {/* Notes */}
                  <div>
                    <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">Notes</label>
                    <textarea
                      value={phase.notes}
                      onChange={(e) => updatePhase(phase.id, { notes: e.target.value })}
                      rows={2}
                      placeholder="Notes for this phase..."
                      className="w-full bg-bg-primary border border-[rgba(255,255,255,0.04)] rounded-lg px-3 py-2 text-xs text-text-secondary placeholder:text-text-muted focus:outline-none focus:border-accent/30 transition-colors resize-none"
                    />
                  </div>

                  {/* Action items */}
                  <div>
                    <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">Action Items</label>
                    <div className="space-y-1">
                      {phase.items.map((item) => (
                        <div key={item.id} className="flex items-center gap-2 group py-1">
                          <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                            item.completed ? "bg-emerald-500 border-emerald-500" : "border-[rgba(255,255,255,0.12)]"
                          }`}>
                            {item.completed && (
                              <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span className={`text-xs flex-1 ${item.completed ? "text-text-muted line-through" : "text-text-secondary"}`}>
                            {item.title}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeItem(phase.id, item.id)}
                            className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-400 transition-all p-0.5"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="text"
                        value={newItemTexts[phase.id] || ""}
                        onChange={(e) => setNewItemTexts((prev) => ({ ...prev, [phase.id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(phase.id); } }}
                        placeholder="Add action item..."
                        className="flex-1 bg-bg-primary border border-[rgba(255,255,255,0.04)] rounded-lg px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/30 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => addItem(phase.id)}
                        disabled={!newItemTexts[phase.id]?.trim()}
                        className="px-2.5 py-1.5 text-xs font-medium text-accent-bright bg-accent/10 hover:bg-accent/20 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  {/* Linked trainings */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-wider">Linked Training</label>
                      <TrainingPicker
                        selectedIds={phase.linked_trainings}
                        onToggle={(id) => toggleTraining(phase.id, id)}
                        modules={modules}
                      />
                    </div>
                    {phase.linked_trainings.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {phase.linked_trainings.map((id) => {
                          const info = contentLookup.get(id);
                          if (!info) return null;
                          return (
                            <span
                              key={id}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-accent/10 border border-accent/15 rounded-lg text-[10px] text-text-secondary"
                            >
                              <span className="truncate max-w-[160px]">{info.title}</span>
                              <button
                                type="button"
                                onClick={() => toggleTraining(phase.id, id)}
                                className="text-text-muted hover:text-red-400 transition-colors flex-shrink-0"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Add Phase button */}
          <button
            type="button"
            onClick={addPhase}
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-[rgba(255,255,255,0.08)] hover:border-accent/30 rounded-2xl text-sm text-text-muted hover:text-accent-bright transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Phase
          </button>
        </div>
      </div>
    </div>
  );
}
