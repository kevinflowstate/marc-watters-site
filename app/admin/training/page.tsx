"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import ModuleCover from "@/components/training/ModuleCover";
import { Icon } from "@/components/ops/workspace/WorkspaceUI";
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
      <div className="ws ws-page">
        <div className="ws-ph">
          <div>
            <span className="ws-skel" style={{ width: 160, height: 22 }} />
            <span className="ws-skel mt-2" style={{ width: 260, height: 12 }} />
          </div>
        </div>
        <div className="ws-tr-grid">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="ws-tr-card">
              <div className="ws-skel ws-tr-skel-cover" />
              <div className="ws-tr-card-b">
                <span className="ws-skel" style={{ width: "70%", height: 14 }} />
                <span className="ws-skel" style={{ width: "100%", height: 10 }} />
                <span className="ws-skel" style={{ width: "50%", height: 10 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="ws ws-page">
      <div className="ws-ph">
        <div className="min-w-0">
          <h1 className="ws-title">Training modules</h1>
          <p className="ws-meta mt-1">
            {modules.length} modules · {totalLessons} lessons · {publishedCount} published · Drag and drop cards to reorder
          </p>
        </div>
        <div className="ws-ph-acts">
          <button
            onClick={() => {
              if (bulkMode) {
                setBulkMode(false);
                setSelectedModules(new Set());
              } else {
                setBulkMode(true);
              }
            }}
            className={`ws-btn ws-focus${bulkMode ? " ws-tr-on" : ""}`}
          >
            {bulkMode ? `${selectedModules.size} selected` : "Bulk assign"}
          </button>
          {bulkMode && selectedModules.size > 0 && (
            <button
              onClick={() => { loadClients(); setShowAssignModal(true); }}
              className="ws-btn ws-btn-primary ws-focus"
            >
              <Icon name="users" size={14} />
              Assign to clients
            </button>
          )}
          <button
            onClick={() => setShowAdd(true)}
            className="ws-btn ws-btn-primary ws-focus"
          >
            <Icon name="plus" size={14} />
            Add module
          </button>
        </div>
      </div>

      {/* Add modal */}
      {showAdd && (
        <section className="ws-panel">
          <div className="ws-panel-head">
            <h3 className="ws-h2">New module</h3>
          </div>
          <div className="ws-tr-form">
            <div>
              <label className="ws-label">Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Advanced Pricing Strategies"
                className="ws-input"
              />
            </div>
            <div>
              <label className="ws-label">Description</label>
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                rows={2}
                placeholder="Brief description of what this module covers"
                className="ws-input"
              />
            </div>
            <div className="ws-tr-acts">
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
                className="ws-btn ws-btn-primary ws-focus"
              >
                Create
              </button>
              <button onClick={() => setShowAdd(false)} className="ws-btn ws-btn-quiet ws-focus">Cancel</button>
            </div>
          </div>
        </section>
      )}

      {/* Module grid */}
      <div className="ws-tr-grid">
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
              {/* Cover - generated from the title */}
              <div className="ws-tr-cover-wrap">
                <ModuleCover title={mod.title} number={i + 1} />

                {/* Module number / checkbox */}
                <div className="ws-tr-cover-tl">
                  {bulkMode ? (
                    <div className={`ws-tr-box is-lg${isSelected ? " is-on" : ""}`}>
                      {isSelected && <Icon name="check" size={16} stroke={2.4} />}
                    </div>
                  ) : null}

                  {!bulkMode && (
                    <>
                      {!isFirst && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            moveModule(mod.id, "up");
                          }}
                          disabled={reordering}
                          className="ws-tr-badge is-btn ws-focus"
                          title="Move up"
                          aria-label={`Move ${mod.title} up`}
                        >
                          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                          className="ws-tr-badge is-btn ws-focus"
                          title="Move down"
                          aria-label={`Move ${mod.title} down`}
                        >
                          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      )}
                    </>
                  )}
                </div>

                {isMoving && (
                  <div className="ws-tr-moving">
                    <span>Reordering...</span>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="ws-tr-card-b">
                <h3 className="ws-tr-card-t">
                  {mod.title}
                </h3>
                <p className="ws-tr-card-d">
                  {mod.description}
                </p>

                {/* Stats row */}
                <div className="ws-tr-card-f">
                  <span className="ws-tr-stats">
                    <span><Icon name="lessons" size={12} />{lessonCount} lessons</span>
                    <span><Icon name="clock" size={12} />{totalDuration} min</span>
                    {attachmentCount > 0 && (
                      <span><Icon name="link" size={12} />{attachmentCount} files</span>
                    )}
                  </span>
                  {/* Published badge */}
                  <span className={`ws-chip${mod.is_published ? " is-ok" : ""}`}>
                    {mod.is_published ? "Published" : "Draft"}
                  </span>
                </div>
              </div>
            </>
          );

          if (bulkMode) {
            return (
              <button
                key={mod.id}
                onClick={() => toggleModule(mod.id)}
                className={`ws-tr-card is-link ws-focus${isSelected ? " is-selected" : ""}`}
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
              className={`ws-tr-card is-link ws-focus${
                isDragSource ? " is-dragging" : ""
              }${
                isDropTarget ? " is-drop" : ""
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
        <div className="ws-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="ws-overlay-bg" />
          <div className="ws-dialog" role="dialog" aria-modal="true" aria-label="Assign to clients" onClick={(e) => e.stopPropagation()}>
            <div className="ws-dialog-head">
              <div>
                <h3 className="ws-dialog-title">Assign to clients</h3>
                <p className="ws-caption mt-0.5">
                  {selectedModules.size} module{selectedModules.size > 1 ? "s" : ""} selected. Choose which clients to assign them to.
                </p>
              </div>
            </div>

            <div className="ws-dialog-body">
              {clients.length === 0 ? (
                <div className="ws-caption" style={{ padding: "24px 0", textAlign: "center" }}>Loading clients...</div>
              ) : (
                <div className="ws-tr-picks">
                  <button
                    onClick={() => {
                      if (selectedClients.size === clients.length) {
                        setSelectedClients(new Set());
                      } else {
                        setSelectedClients(new Set(clients.map((c) => c.id)));
                      }
                    }}
                    className="ws-tr-pick ws-focus"
                  >
                    <div className={`ws-tr-box${selectedClients.size === clients.length ? " is-on" : ""}`}>
                      {selectedClients.size === clients.length && <Icon name="check" size={12} stroke={3} />}
                    </div>
                    <span className="ws-tr-pick-n" style={{ fontWeight: 500 }}>Select all</span>
                  </button>

                  {clients.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => toggleClient(c.id)}
                      className="ws-tr-pick ws-focus"
                    >
                      <div className={`ws-tr-box${selectedClients.has(c.id) ? " is-on" : ""}`}>
                        {selectedClients.has(c.id) && <Icon name="check" size={12} stroke={3} />}
                      </div>
                      <div className="min-w-0">
                        <div className="ws-tr-pick-n">{c.name}</div>
                        <div className="ws-caption">{c.business_name}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <div className="ws-dialog-foot">
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="ws-btn ws-btn-quiet ws-focus"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkAssign}
                  disabled={selectedClients.size === 0 || assigning}
                  className="ws-btn ws-btn-primary ws-focus"
                >
                  {assigning ? "Assigning..." : `Assign to ${selectedClients.size} client${selectedClients.size !== 1 ? "s" : ""}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
