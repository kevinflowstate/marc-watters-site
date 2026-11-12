"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import type { TrainingModule } from "@/lib/types";
import { Icon } from "@/components/ops/workspace/WorkspaceUI";

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
        className="ws-btn ws-btn-sm ws-focus"
      >
        <Icon name="book" size={13} />
        Link training
        {selectedIds.length > 0 && (
          <span className="ws-seg-count">
            {selectedIds.length}
          </span>
        )}
      </button>

      {open && createPortal(
        <div className="portal-v2-shell admin-shell ws ws-overlay ws-tp-portal">
          <div className="ws-overlay-bg" />
          <div className="ws-dialog ws-tp" role="dialog" aria-modal="true" aria-label="Link training">
            {/* Header */}
            <div className="ws-tp-head">
              <div className="min-w-0">
                <h3 className="ws-dialog-title">Link training</h3>
                <p className="ws-caption mt-0.5">Select lessons to assign to this section</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="ws-btn ws-btn-quiet ws-btn-icon ws-focus"
                aria-label="Close"
              >
                <Icon name="close" size={15} />
              </button>
            </div>

            {/* Module list */}
            <div className="ws-tp-list">
              {modules.length === 0 ? (
                <div className="ws-empty"><p className="ws-empty-h">No training modules found.</p></div>
              ) : (
                modules.map((mod) => {
                  const isExpanded = expandedModules.has(mod.id);
                  const linkedCount = mod.content?.filter((c) => selectedIds.includes(c.id)).length || 0;

                  return (
                    <div key={mod.id} className="ws-tp-mod">
                      <button
                        type="button"
                        onClick={() => toggleModule(mod.id)}
                        aria-expanded={isExpanded}
                        className="ws-tp-mod-btn ws-focus"
                      >
                        <Icon name="chevron" size={13} className={`ws-chev ${isExpanded ? "is-open" : ""}`} />
                        <span className="ws-tp-mod-t">{mod.title}</span>
                        <span className="ws-caption">{mod.content?.length || 0} lessons</span>
                        {linkedCount > 0 && (
                          <span className="ws-chip is-decide">
                            {linkedCount} linked
                          </span>
                        )}
                      </button>

                      {isExpanded && mod.content && (
                        <div className="ws-tp-lessons">
                          {mod.content.map((lesson) => {
                            const isLinked = selectedIds.includes(lesson.id);
                            return (
                              <button
                                key={lesson.id}
                                type="button"
                                onClick={() => onToggle(lesson.id)}
                                aria-pressed={isLinked}
                                className="ws-tp-lesson ws-focus"
                              >
                                <span className={`ws-tp-box ${isLinked ? "is-on" : ""}`} aria-hidden="true">
                                  {isLinked && <Icon name="check" size={11} stroke={2.6} />}
                                </span>
                                <span className="ws-tp-lesson-t">{lesson.title}</span>
                                {lesson.duration_minutes && (
                                  <span className="ws-caption">{lesson.duration_minutes}m</span>
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
            <div className="ws-tp-foot">
              <span className="ws-caption">
                {selectedIds.length} lesson{selectedIds.length !== 1 ? "s" : ""} linked
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="ws-btn ws-btn-primary ws-focus"
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
