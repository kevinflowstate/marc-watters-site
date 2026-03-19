"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import type { TrainingModule } from "@/lib/types";

interface TrainingPickerProps {
  selectedIds: string[];
  onToggle: (id: string) => void;
  modules?: TrainingModule[];
}

export default function TrainingPicker({ selectedIds, onToggle, modules: modulesProp }: TrainingPickerProps) {
  const [open, setOpen] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [fetchedModules, setFetchedModules] = useState<TrainingModule[]>([]);

  useEffect(() => {
    if (!modulesProp) {
      fetch("/api/admin/training")
        .then((r) => r.ok ? r.json() : { modules: [] })
        .then((d) => setFetchedModules(d.modules || []))
        .catch(() => {});
    }
  }, [modulesProp]);

  const modules = modulesProp || fetchedModules;

  function toggleModule(id: string) {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-accent-bright bg-accent/10 hover:bg-accent/20 border border-accent/20 rounded-lg transition-colors cursor-pointer"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
        Link Training
        {selectedIds.length > 0 && (
          <span className="bg-accent/30 text-accent-bright text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-0.5">
            {selectedIds.length}
          </span>
        )}
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-bg-card border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-heading font-bold text-text-primary">Link Training</h3>
                <p className="text-[10px] text-text-muted mt-0.5">Select lessons to assign to this section</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Module list */}
            <div className="max-h-96 overflow-y-auto">
              {modules.length === 0 ? (
                <div className="px-5 py-8 text-center text-text-muted text-sm">No training modules found.</div>
              ) : (
                modules.map((mod) => {
                  const isExpanded = expandedModules.has(mod.id);
                  const linkedCount = mod.content?.filter((c) => selectedIds.includes(c.id)).length || 0;

                  return (
                    <div key={mod.id} className="border-b border-[rgba(255,255,255,0.03)] last:border-0">
                      <button
                        type="button"
                        onClick={() => toggleModule(mod.id)}
                        className="w-full flex items-center justify-between px-5 py-3 hover:bg-[rgba(255,255,255,0.03)] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <svg
                            className={`w-3.5 h-3.5 text-text-muted transition-transform flex-shrink-0 ${isExpanded ? "rotate-90" : ""}`}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <span className="text-sm text-text-primary font-medium truncate">{mod.title}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[10px] text-text-muted">{mod.content?.length || 0} lessons</span>
                          {linkedCount > 0 && (
                            <span className="text-[10px] bg-accent/20 text-accent-bright px-1.5 py-0.5 rounded-full font-semibold">
                              {linkedCount} linked
                            </span>
                          )}
                        </div>
                      </button>

                      {isExpanded && mod.content && (
                        <div className="bg-[rgba(0,0,0,0.2)] border-t border-[rgba(255,255,255,0.03)]">
                          {mod.content.map((lesson) => {
                            const isLinked = selectedIds.includes(lesson.id);
                            return (
                              <button
                                key={lesson.id}
                                type="button"
                                onClick={() => onToggle(lesson.id)}
                                className="w-full flex items-center gap-3 px-5 pl-12 py-2.5 hover:bg-[rgba(255,255,255,0.03)] transition-colors text-left cursor-pointer"
                              >
                                <div className={`w-4.5 h-4.5 w-[18px] h-[18px] rounded flex items-center justify-center flex-shrink-0 transition-all ${
                                  isLinked ? "bg-accent text-white" : "border border-[rgba(255,255,255,0.15)]"
                                }`}>
                                  {isLinked && (
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs text-text-secondary">{lesson.title}</div>
                                </div>
                                {lesson.duration_minutes && (
                                  <span className="text-[10px] text-text-muted flex-shrink-0">{lesson.duration_minutes}m</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-[rgba(255,255,255,0.06)] flex items-center justify-between">
              <span className="text-xs text-text-muted">
                {selectedIds.length} lesson{selectedIds.length !== 1 ? "s" : ""} linked
              </span>
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-white gradient-accent rounded-lg cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
