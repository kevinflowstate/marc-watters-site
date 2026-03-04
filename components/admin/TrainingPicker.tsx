"use client";

import { useState, useRef, useEffect } from "react";
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
  const ref = useRef<HTMLDivElement>(null);

  // Use prop if provided, otherwise fetch
  useEffect(() => {
    if (!modulesProp) {
      fetch("/api/admin/training")
        .then((r) => r.ok ? r.json() : { modules: [] })
        .then((d) => setFetchedModules(d.modules || []))
        .catch(() => {});
    }
  }, [modulesProp]);

  const modules = modulesProp || fetchedModules;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function toggleModule(id: string) {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-accent-bright bg-accent/10 hover:bg-accent/20 border border-accent/20 rounded-lg transition-colors"
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

      {open && (
        <div className="absolute z-50 mt-2 w-80 bg-bg-card border border-[rgba(255,255,255,0.08)] rounded-xl shadow-2xl overflow-hidden">
          <div className="px-3 py-2 border-b border-[rgba(255,255,255,0.06)]">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Training Modules</span>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {modules.map((mod) => {
              const isExpanded = expandedModules.has(mod.id);
              const linkedCount = mod.content?.filter((c) => selectedIds.includes(c.id)).length || 0;

              return (
                <div key={mod.id}>
                  <button
                    type="button"
                    onClick={() => toggleModule(mod.id)}
                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-[rgba(255,255,255,0.03)] transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <svg
                        className={`w-3.5 h-3.5 text-text-muted transition-transform flex-shrink-0 ${isExpanded ? "rotate-90" : ""}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <span className="text-sm text-text-primary truncate">{mod.title}</span>
                    </div>
                    {linkedCount > 0 && (
                      <span className="text-[10px] bg-accent/20 text-accent-bright px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0">
                        {linkedCount}
                      </span>
                    )}
                  </button>

                  {isExpanded && mod.content && (
                    <div className="bg-[rgba(0,0,0,0.15)]">
                      {mod.content.map((lesson) => {
                        const isLinked = selectedIds.includes(lesson.id);
                        return (
                          <button
                            key={lesson.id}
                            type="button"
                            onClick={() => onToggle(lesson.id)}
                            className="w-full flex items-center gap-2.5 px-4 pl-9 py-2 hover:bg-[rgba(255,255,255,0.03)] transition-colors text-left"
                          >
                            <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${
                              isLinked ? "bg-accent text-white" : "border border-[rgba(255,255,255,0.15)]"
                            }`}>
                              {isLinked && (
                                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs text-text-secondary truncate">{lesson.title}</div>
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
            })}
          </div>
        </div>
      )}
    </div>
  );
}
