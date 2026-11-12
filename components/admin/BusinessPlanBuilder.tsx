"use client";

import { useState, useEffect } from "react";
import type { BusinessPlan, BusinessPlanPhase, TrainingModule, BusinessPlanFormConfig } from "@/lib/types";
import {
  appendPlanItem,
  commitPlanItemDrafts,
} from "@/lib/business-plan-drafts";
import { createClient } from "@/lib/supabase/client";
import TrainingPicker from "./TrainingPicker";
import { Icon, StatusIcon } from "@/components/ops/workspace/WorkspaceUI";

interface BusinessPlanBuilderProps {
  clientId: string;
  existingPlan?: BusinessPlan;
  onSave: (plan: BusinessPlan) => void;
  onPdfUploaded?: () => void | Promise<void>;
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
  onPdfUploaded,
  onCancel,
  saving = false,
  error = null,
}: BusinessPlanBuilderProps) {
  const [planId] = useState(() => existingPlan?.id || generateId());
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
  const [pdfUploadError, setPdfUploadError] = useState<string | null>(null);

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
    setPhases((currentPhases) => appendPlanItem(currentPhases, phaseId, text, generateId));
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
    const phasesWithDrafts = commitPlanItemDrafts(phases, newItemTexts, generateId);
    setPhases(phasesWithDrafts);
    setNewItemTexts({});

    const plan: BusinessPlan = {
      id: planId,
      client_id: clientId,
      summary,
      status: existingPlan?.status || "active",
      created_at: existingPlan?.created_at || new Date().toISOString(),
      phases: phasesWithDrafts,
      discovery_answers: Object.keys(discoveryAnswers).length > 0 ? discoveryAnswers : undefined,
      // An empty string is an explicit removal. Omitting this field is reserved
      // for callers that do not manage plan documents and must preserve it.
      pdf_url: pdfUrl,
    };
    onSave(plan);
  }

  return (
    <div className="ws ws-bpb">
      {/* Backdrop */}
      <div className="ws-bpb-bg" onClick={onCancel} />

      {/* Slide-over panel */}
      <div className="ws-bpb-panel" role="dialog" aria-modal="true" aria-label={isEditing ? "Edit business plan" : "Create business plan"}>
        {/* Header */}
        <div className="ws-bpb-head">
          <h2 className="ws-bpb-title">
            {isEditing ? "Edit business plan" : "Create business plan"}
          </h2>
          <div className="ws-bpb-head-acts">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="ws-btn ws-btn-quiet ws-focus"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !summary.trim() || phases.length === 0}
              className="ws-btn ws-btn-primary ws-focus"
            >
              {saving ? "Saving..." : "Save plan"}
            </button>
          </div>
        </div>

        <div className="ws-bpb-body">
          {error && (
            <div className="ws-note is-bad" role="alert">
              <Icon name="alert" size={15} />
              <span>{error}</span>
            </div>
          )}

          {/* Discovery Questions */}
          {bpConfig && bpConfig.questions.length > 0 && (
            <div className="ws-bpb-sec">
              <label className="ws-bpb-h">
                Discovery questions
              </label>
              <div className="ws-bpb-fields">
                {bpConfig.questions.map((q) => (
                  <div key={q.id}>
                    <label className="ws-label">{q.label}</label>
                    <textarea
                      value={discoveryAnswers[q.id] || ""}
                      onChange={(e) => setDiscoveryAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                      rows={2}
                      placeholder={q.placeholder}
                      className="ws-input ws-bpb-ta"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          {/* PDF Upload */}
          <div className="ws-bpb-sec">
            <label className="ws-bpb-h">
              Plan document (PDF)
            </label>
            {pdfUrl ? (
              <div className="ws-bpb-file">
                <svg width="16" height="16" className="ws-bpb-file-ic" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="ws-link ws-bpb-file-a">
                  View uploaded PDF
                </a>
                <button
                  type="button"
                  onClick={() => setPdfUrl("")}
                  className="ws-btn ws-btn-quiet ws-btn-sm ws-focus ws-bpb-remove"
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
                    setPdfUploadError(null);
                    try {
                      const signRes = await fetch("/api/admin/upload", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "create-signed-upload",
                          bucket: "plan-documents",
                          fileName: file.name,
                          fileSize: file.size,
                        }),
                      });
                      const signedUpload = await signRes.json().catch(() => ({}));
                      if (!signRes.ok) {
                        throw new Error(signedUpload.error || "Could not prepare PDF upload");
                      }

                      const supabase = createClient();
                      const { error: uploadError } = await supabase.storage
                        .from("plan-documents")
                        .uploadToSignedUrl(signedUpload.path, signedUpload.token, file, {
                          contentType: file.type || "application/pdf",
                        });
                      if (uploadError) throw uploadError;

                      const finalizeRes = await fetch("/api/admin/upload", {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          bucket: "plan-documents",
                          path: signedUpload.path,
                          planId,
                          fileName: file.name,
                        }),
                      });
                      const finalizedUpload = await finalizeRes.json().catch(() => ({}));
                      if (!finalizeRes.ok) {
                        throw new Error(finalizedUpload.error || "Could not attach PDF to plan");
                      }

                      setPdfUrl(finalizedUpload.url);
                      await onPdfUploaded?.();
                    } catch (uploadError) {
                      setPdfUploadError(
                        uploadError instanceof Error ? uploadError.message : "PDF upload failed",
                      );
                    } finally {
                      setUploading(false);
                    }
                  }}
                  className="ws-input ws-file"
                />
                {uploading && <p className="ws-caption mt-1">Uploading...</p>}
                {pdfUploadError && <p className="ws-caption mt-1" style={{ color: "var(--ws-bad)" }}>{pdfUploadError}</p>}
                <p className="ws-caption mt-1">Upload the PDF version of this plan. Clients can view and download it.</p>
              </div>
            )}
          </div>

          <div className="ws-bpb-sec">
            <label className="ws-bpb-h">
              Plan summary
            </label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              placeholder="Overview of the project - what's the big picture goal for this client?"
              className="ws-input ws-bpb-ta"
            />
          </div>

          {/* Phases */}
          <div className="ws-bpb-phases">
            {phases.map((phase, idx) => (
              <div key={phase.id} className="ws-panel ws-bpb-phase">
                {/* Phase header */}
                <div className="ws-bpb-phase-head">
                  <span className="ws-bpb-num" aria-hidden="true">
                    {idx + 1}
                  </span>
                  <input
                    type="text"
                    value={phase.name}
                    onChange={(e) => updatePhase(phase.id, { name: e.target.value })}
                    className="ws-input ws-bpb-name"
                    placeholder="Phase name..."
                    aria-label="Phase name"
                  />
                  {phases.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePhase(phase.id)}
                      className="ws-btn ws-btn-quiet ws-btn-icon ws-focus ws-bpb-del"
                      aria-label="Remove phase"
                    >
                      <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>

                <div className="ws-bpb-phase-body">
                  {/* Notes */}
                  <div>
                    <label className="ws-field-l">Notes</label>
                    <textarea
                      value={phase.notes}
                      onChange={(e) => updatePhase(phase.id, { notes: e.target.value })}
                      rows={2}
                      placeholder="Notes for this phase..."
                      className="ws-input ws-bpb-ta"
                    />
                  </div>

                  {/* Action items */}
                  <div>
                    <div className="ws-bpb-row-h">
                      <label className="ws-field-l">Action items</label>
                      <span className="ws-caption">
                        {phase.items.length + (newItemTexts[phase.id]?.trim() ? 1 : 0)} item{phase.items.length + (newItemTexts[phase.id]?.trim() ? 1 : 0) === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="ws-bpb-items">
                      {phase.items.map((item) => (
                        <div key={item.id} className={`ws-bpb-item ${item.completed ? "is-done" : ""}`}>
                          <StatusIcon tone={item.completed ? "ok" : "open"} />
                          <span className="ws-bpb-item-t">
                            {item.title}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeItem(phase.id, item.id)}
                            className="ws-bpb-x ws-focus"
                            aria-label="Remove item"
                          >
                            <Icon name="close" size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="ws-bpb-add">
                      <input
                        type="text"
                        value={newItemTexts[phase.id] || ""}
                        onChange={(e) => setNewItemTexts((prev) => ({ ...prev, [phase.id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(phase.id); } }}
                        placeholder="Add action item..."
                        className="ws-input"
                      />
                      <button
                        type="button"
                        onClick={() => addItem(phase.id)}
                        disabled={!newItemTexts[phase.id]?.trim()}
                        className="ws-btn ws-focus"
                      >
                        Add
                      </button>
                    </div>
                    {newItemTexts[phase.id]?.trim() && (
                      <p className="ws-caption mt-1.5" style={{ color: "var(--ws-attn)" }}>
                        This draft will be added automatically when you save the plan.
                      </p>
                    )}
                  </div>

                  {/* Linked trainings */}
                  <div>
                    <div className="ws-bpb-row-h">
                      <label className="ws-field-l">Linked training</label>
                      <TrainingPicker
                        selectedIds={phase.linked_trainings}
                        onToggle={(id) => toggleTraining(phase.id, id)}
                        modules={modules}
                      />
                    </div>
                    {phase.linked_trainings.length > 0 && (
                      <div className="ws-bpb-chips">
                        {phase.linked_trainings.map((id) => {
                          const info = contentLookup.get(id);
                          if (!info) return null;
                          return (
                            <span
                              key={id}
                              className="ws-chip ws-bpb-chip"
                            >
                              <span className="ws-bpb-chip-t">{info.title}</span>
                              <button
                                type="button"
                                onClick={() => toggleTraining(phase.id, id)}
                                className="ws-bpb-chip-x ws-focus"
                                aria-label="Unlink training"
                              >
                                <Icon name="close" size={11} />
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
            className="ws-btn ws-focus ws-bpb-addphase"
          >
            <Icon name="plus" size={14} />
            Add phase
          </button>
        </div>
      </div>
    </div>
  );
}
