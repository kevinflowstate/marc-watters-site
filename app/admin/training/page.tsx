"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import ModuleCover from "@/components/training/ModuleCover";
import type { TrainingModule } from "@/lib/types";

interface ClientOption {
  id: string;
  name: string;
  business_name: string;
}

export default function TrainingManagerPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");

  // Bulk assign state
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set());
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);
  const [movingModuleId, setMovingModuleId] = useState<string | null>(null);
  const [draggedModuleId, setDraggedModuleId] = useState<string | null>(null);
  const [dragOverModuleId, setDragOverModuleId] = useState<string | null>(null);
  const [suppressCardClick, setSuppressCardClick] = useState(false);

  const refreshModules = useCallback(async () => {
    const res = await fetch("/api/admin/training");
    if (!res.ok) return;
    const data = await res.json();
    setModules(data.modules || []);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        await refreshModules();
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [refreshModules]);

  async function loadClients() {
    try {
      const res = await fetch("/api/admin/clients");
      if (res.ok) {
        const data = await res.json();
        setClients((data.clients || []).map((c: { id: string; name: string; business_name: string }) => ({
          id: c.id,
          name: c.name,
          business_name: c.business_name,
        })));
      }
    } catch { /* silent */ }
  }

  function toggleModule(id: string) {
    setSelectedModules((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleClient(id: string) {
    setSelectedClients((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleBulkAssign() {
    if (selectedModules.size === 0 || selectedClients.size === 0) return;
    setAssigning(true);

    try {
      const res = await fetch("/api/admin/bulk-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module_ids: Array.from(selectedModules),
          client_ids: Array.from(selectedClients),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast(`Assigned ${data.assigned} module${data.assigned !== 1 ? "s" : ""}${data.skipped ? ` (${data.skipped} already assigned)` : ""}`);
        setShowAssignModal(false);
        setBulkMode(false);
        setSelectedModules(new Set());
        setSelectedClients(new Set());
      } else {
        toast("Failed to assign modules", "error");
      }
    } catch {
      toast("Failed to assign modules", "error");
    } finally {
      setAssigning(false);
    }
  }

  async function reorderModules(sourceModuleId: string, targetModuleId: string) {
    if (movingModuleId || sourceModuleId === targetModuleId) return;
    const sorted = [...modules].sort((a, b) => a.order_index - b.order_index);
    const sourceIndex = sorted.findIndex((mod) => mod.id === sourceModuleId);
    const targetIndex = sorted.findIndex((mod) => mod.id === targetModuleId);
    if (sourceIndex < 0 || targetIndex < 0) return;

    const reordered = [...sorted];
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    const originalOrderById = new Map(sorted.map((mod) => [mod.id, mod.order_index]));
    const updates = reordered
      .map((mod, index) => ({ id: mod.id, order_index: index }))
      .filter((mod) => originalOrderById.get(mod.id) !== mod.order_index);
    if (updates.length === 0) return;
    setMovingModuleId(sourceModuleId);

    try {
      const responses = await Promise.all(
        updates.map((mod) =>
          fetch("/api/admin/training/modules", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: mod.id, order_index: mod.order_index }),
          })
        )
      );

      if (responses.some((res) => !res.ok)) {
        throw new Error("Failed to reorder modules");
      }

      await refreshModules();
      toast("Module reordered");
    } catch {
      toast("Failed to reorder modules", "error");
    } finally {
      setMovingModuleId(null);
    }
  }

  async function moveModule(moduleId: string, direction: "up" | "down") {
    const sorted = [...modules].sort((a, b) => a.order_index - b.order_index);
    const index = sorted.findIndex((mod) => mod.id === moduleId);
    if (index < 0) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;
    await reorderModules(moduleId, sorted[targetIndex].id);
  }

  function handleModuleDragStart(e: React.DragEvent<HTMLDivElement>, moduleId: string) {
    if (bulkMode || movingModuleId) {
      e.preventDefault();
      return;
    }

    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", moduleId);
    setDraggedModuleId(moduleId);
    setDragOverModuleId(moduleId);
  }

  function handleModuleDragOver(e: React.DragEvent<HTMLDivElement>, moduleId: string) {
    if (!draggedModuleId || draggedModuleId === moduleId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverModuleId !== moduleId) {
      setDragOverModuleId(moduleId);
    }
  }

  async function handleModuleDrop(e: React.DragEvent<HTMLDivElement>, targetModuleId: string) {
    e.preventDefault();

    const sourceModuleId = draggedModuleId || e.dataTransfer.getData("text/plain");
    setDraggedModuleId(null);
    setDragOverModuleId(null);
    if (!sourceModuleId || sourceModuleId === targetModuleId) return;

    setSuppressCardClick(true);
    await reorderModules(sourceModuleId, targetModuleId);
    setTimeout(() => setSuppressCardClick(false), 120);
  }

  function handleModuleDragEnd() {
    setDraggedModuleId(null);
    setDragOverModuleId(null);
  }

  const publishedCount = modules.filter((m) => m.is_published).length;
  const totalLessons = modules.reduce((sum, m) => sum + (m.content?.length || 0), 0);

  if (loading) {
    return (
      <>
        <div className="mb-8">
          <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-8 w-48 mb-2" />
          <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-4 w-64" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-bg-card/80 border border-[rgba(255,255,255,0.04)] rounded-2xl overflow-hidden">
              <div className="h-36 animate-pulse bg-[rgba(255,255,255,0.04)]" />
              <div className="p-5 space-y-3">
                <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-5 w-3/4" />
                <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-3 w-full" />
                <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-heading font-bold text-text-primary">Training Modules</h1>
          <p className="text-text-secondary mt-1">
            {modules.length} modules - {totalLessons} lessons - {publishedCount} published - Drag and drop cards to reorder
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (bulkMode) {
                setBulkMode(false);
                setSelectedModules(new Set());
              } else {
                setBulkMode(true);
              }
            }}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
              bulkMode
                ? "bg-accent/10 text-accent-bright border border-accent/30"
                : "bg-bg-card/80 border border-[rgba(255,255,255,0.06)] text-text-secondary hover:text-text-primary hover:border-accent/30"
            }`}
          >
            {bulkMode ? `${selectedModules.size} Selected` : "Bulk Assign"}
          </button>
          {bulkMode && selectedModules.size > 0 && (
            <button
              onClick={() => { loadClients(); setShowAssignModal(true); }}
              className="px-5 py-2.5 gradient-accent text-white rounded-xl text-sm font-semibold cursor-pointer inline-flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Assign to Clients
            </button>
          )}
          <button
            onClick={() => setShowAdd(true)}
            className="px-5 py-2.5 gradient-accent text-white rounded-xl text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Module
          </button>
        </div>
      </div>

      {/* Add modal */}
      {showAdd && (
        <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(255,255,255,0.06)] rounded-2xl p-6 mb-6">
          <h3 className="text-lg font-heading font-bold text-text-primary mb-4">New Module</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Advanced Pricing Strategies"
                className="w-full bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">Description</label>
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                rows={2}
                placeholder="Brief description of what this module covers"
                className="w-full bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40 resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  if (!newTitle.trim()) return;
                  try {
                    const res = await fetch("/api/admin/training/modules", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ title: newTitle, description: newDesc }),
                    });
                    if (res.ok) {
                      const data = await res.json();
                      toast("Module created");
                      setNewTitle(""); setNewDesc(""); setShowAdd(false);
                      await refreshModules();
                      // Navigate to the new module
                      if (data.module?.id) {
                        window.location.href = `/admin/training/${data.module.id}`;
                      }
                    } else {
                      toast("Failed to create module", "error");
                    }
                  } catch {
                    toast("Failed to create module", "error");
                  }
                }}
                className="px-5 py-2 gradient-accent text-white rounded-xl text-sm font-medium cursor-pointer"
              >
                Create
              </button>
              <button onClick={() => setShowAdd(false)} className="px-5 py-2 text-text-muted text-sm hover:text-text-secondary cursor-pointer">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Module grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {modules.map((mod, i) => {
          const lessonCount = mod.content?.length || 0;
          const totalDuration = mod.content?.reduce((sum, c) => sum + (c.duration_minutes || 0), 0) || 0;
          const attachmentCount = mod.content?.reduce((sum, c) => sum + (c.attachments?.length || 0), 0) || 0;
          const isSelected = selectedModules.has(mod.id);
          const isFirst = i === 0;
          const isLast = i === modules.length - 1;
          const reordering = movingModuleId !== null;
          const isMoving = movingModuleId === mod.id;
          const isDragSource = draggedModuleId === mod.id;
          const isDropTarget = dragOverModuleId === mod.id && draggedModuleId !== mod.id;

          const CardContent = (
            <>
              {/* Bento dot pattern */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[length:4px_4px] z-10 pointer-events-none" />
              <div className="absolute inset-0 -z-10 rounded-2xl p-px bg-gradient-to-br from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              {/* Cover - auto-generated from title */}
              <div className="relative">
                <ModuleCover title={mod.title} />

                {/* Module number / checkbox */}
                <div className="absolute top-4 left-4">
                  {bulkMode ? (
                    <div className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center transition-all ${
                      isSelected ? "bg-accent border-accent-bright" : "bg-black/30 backdrop-blur-sm border-white/10"
                    }`}>
                      {isSelected && (
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-black/30 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white font-bold text-sm">
                      {i + 1}
                    </div>
                  )}
                </div>

                {!bulkMode && (
                  <div className="absolute top-4 left-16 flex items-center gap-1 z-20">
                    {!isFirst && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          moveModule(mod.id, "up");
                        }}
                        disabled={reordering}
                        className="p-1.5 rounded-lg bg-black/30 backdrop-blur-sm border border-white/10 text-white/80 hover:text-white hover:border-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        title="Move up"
                        aria-label={`Move ${mod.title} up`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                    )}
                    {!isLast && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          moveModule(mod.id, "down");
                        }}
                        disabled={reordering}
                        className="p-1.5 rounded-lg bg-black/30 backdrop-blur-sm border border-white/10 text-white/80 hover:text-white hover:border-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        title="Move down"
                        aria-label={`Move ${mod.title} down`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}

                {/* Published badge */}
                <div className="absolute top-4 right-4">
                  <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold ${
                    mod.is_published
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : "bg-white/10 text-white/60 border border-white/10"
                  }`}>
                    {mod.is_published ? "Published" : "Draft"}
                  </span>
                </div>
                {isMoving && (
                  <div className="absolute inset-0 bg-black/35 backdrop-blur-[1px] z-10 flex items-center justify-center pointer-events-none">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-white/80">Reordering...</span>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-5">
                <h3 className="font-heading font-bold text-text-primary text-[0.95rem] mb-2 group-hover:text-accent-bright transition-colors">
                  {mod.title}
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed line-clamp-2 mb-4">
                  {mod.description}
                </p>

                {/* Stats row */}
                <div className="flex items-center gap-4 text-[10px] text-text-muted uppercase tracking-wider">
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    </svg>
                    {lessonCount} lessons
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {totalDuration} min
                  </div>
                  {attachmentCount > 0 && (
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      {attachmentCount} files
                    </div>
                  )}
                </div>
              </div>
            </>
          );

          if (bulkMode) {
            return (
              <button
                key={mod.id}
                onClick={() => toggleModule(mod.id)}
                className={`group relative block bg-bg-card/80 backdrop-blur-sm border rounded-2xl overflow-hidden transition-all duration-300 text-left cursor-pointer will-change-transform hover:-translate-y-1 ${
                  isSelected ? "border-accent/40 shadow-[0_0_20px_rgba(34,114,222,0.1)]" : "border-[rgba(255,255,255,0.04)] hover:border-[rgba(34,114,222,0.2)]"
                }`}
              >
                {CardContent}
              </button>
            );
          }

          return (
            <div
              key={mod.id}
              role="button"
              tabIndex={0}
              draggable={!reordering}
              onDragStart={(e) => handleModuleDragStart(e, mod.id)}
              onDragOver={(e) => handleModuleDragOver(e, mod.id)}
              onDrop={(e) => { void handleModuleDrop(e, mod.id); }}
              onDragEnd={handleModuleDragEnd}
              onClick={() => {
                if (!suppressCardClick && !draggedModuleId) {
                  router.push(`/admin/training/${mod.id}`);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(`/admin/training/${mod.id}`);
                }
              }}
              className={`group relative block bg-bg-card/80 backdrop-blur-sm border rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-[rgba(34,114,222,0.2)] hover:shadow-[0_15px_40px_rgba(0,0,0,0.3),0_0_40px_rgba(34,114,222,0.06)] cursor-pointer will-change-transform ${
                isDragSource ? "opacity-60" : ""
              } ${
                isDropTarget ? "ring-2 ring-accent/40 border-accent/40" : "border-[rgba(255,255,255,0.04)]"
              }`}
              aria-label={`Open ${mod.title}`}
            >
              {CardContent}
            </div>
          );
        })}
      </div>

      {/* Bulk Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAssignModal(false)}>
          <div className="bg-bg-card border border-[rgba(255,255,255,0.08)] rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-heading font-bold text-text-primary mb-1">Assign to Clients</h3>
            <p className="text-xs text-text-muted mb-4">
              {selectedModules.size} module{selectedModules.size > 1 ? "s" : ""} selected. Choose which clients to assign them to.
            </p>

            {clients.length === 0 ? (
              <div className="py-8 text-center text-text-muted text-sm">Loading clients...</div>
            ) : (
              <div className="space-y-1 max-h-64 overflow-y-auto mb-4">
                <button
                  onClick={() => {
                    if (selectedClients.size === clients.length) {
                      setSelectedClients(new Set());
                    } else {
                      setSelectedClients(new Set(clients.map((c) => c.id)));
                    }
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[rgba(255,255,255,0.03)] transition-colors cursor-pointer text-left"
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                    selectedClients.size === clients.length ? "bg-accent border-accent-bright" : "border-[rgba(255,255,255,0.15)]"
                  }`}>
                    {selectedClients.size === clients.length && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm font-medium text-text-primary">Select All</span>
                </button>

                {clients.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => toggleClient(c.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[rgba(255,255,255,0.03)] transition-colors cursor-pointer text-left"
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                      selectedClients.has(c.id) ? "bg-accent border-accent-bright" : "border-[rgba(255,255,255,0.15)]"
                    }`}>
                      {selectedClients.has(c.id) && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <div className="text-sm text-text-primary">{c.name}</div>
                      <div className="text-[10px] text-text-muted">{c.business_name}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleBulkAssign}
                disabled={selectedClients.size === 0 || assigning}
                className="flex-1 py-3 gradient-accent text-white rounded-xl text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-opacity"
              >
                {assigning ? "Assigning..." : `Assign to ${selectedClients.size} Client${selectedClients.size !== 1 ? "s" : ""}`}
              </button>
              <button
                onClick={() => setShowAssignModal(false)}
                className="px-5 py-3 text-text-muted text-sm hover:text-text-secondary cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
