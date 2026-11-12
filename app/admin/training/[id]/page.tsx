"use client";
import {isNativeLessonVideo,nativeLessonVideoUrl} from "@/lib/lesson-video";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import { formatFileSize, guessAttachmentType } from "@/lib/attachments";
import type { TrainingModule, ModuleContent, Attachment, ContentType } from "@/lib/types";
import ModuleCover from "@/components/training/ModuleCover";
import { Empty, Icon, SkeletonRows } from "@/components/ops/workspace/WorkspaceUI";

const attachmentIcons: Record<string, { icon: string; color: string }> = {
  pdf: { icon: "M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z", color: "text-red-400 bg-red-500/10" },
  sheet: { icon: "M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2z", color: "text-emerald-400 bg-emerald-500/10" },
  doc: { icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", color: "text-blue-400 bg-blue-500/10" },
  image: { icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z", color: "text-purple-400 bg-purple-500/10" },
  other: { icon: "M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13", color: "text-text-muted bg-[rgba(255,255,255,0.04)]" },
};

function getVideoEmbed(url: string): { type: "youtube" | "vimeo" | "fathom" | "unknown"; embedUrl: string } {
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (ytMatch) return { type: "youtube", embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}` };

  // Vimeo
  const vimeoMatch = url.match(/(?:player\.)?vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeoMatch) {
    const hMatch = url.match(/[?&]h=([a-zA-Z0-9]+)/);
    const h = hMatch ? `?h=${hMatch[1]}&` : "?";
    return { type: "vimeo", embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}${h}color=2272DE&title=0&byline=0&portrait=0` };
  }

  // Fathom (share link -> embed link)
  const fathomShareMatch = url.match(/fathom\.video\/share\/([a-zA-Z0-9_-]+)/);
  if (fathomShareMatch) return { type: "fathom", embedUrl: `https://fathom.video/embed/${fathomShareMatch[1]}` };
  const fathomEmbedMatch = url.match(/fathom\.video\/embed\/([a-zA-Z0-9_-]+)/);
  if (fathomEmbedMatch) return { type: "fathom", embedUrl: `https://fathom.video/embed/${fathomEmbedMatch[1]}` };

  return { type: "unknown", embedUrl: url };
}

export default function ModuleEditorPage() {
  const { id } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [module, setModule] = useState<TrainingModule | null>(null);
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [moduleTitle, setModuleTitle] = useState("");
  const [moduleDesc, setModuleDesc] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [coverUrl, setCoverUrl] = useState("");
  const [editingCover, setEditingCover] = useState(false);
  const [expandedLesson, setExpandedLesson] = useState<string | null>(null);
  const [showAddLesson, setShowAddLesson] = useState(false);
  const [isPublished, setIsPublished] = useState(false);

  // New lesson form state
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<ContentType>("video");
  const [newUrl, setNewUrl] = useState("");
  const [newDuration, setNewDuration] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newAttachments, setNewAttachments] = useState<Attachment[]>([]);
  const [uploadingNewAttachments, setUploadingNewAttachments] = useState(false);

  const loadModule = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/training");
      if (res.ok) {
        const data = await res.json();
        const allModules = (data.modules || []) as TrainingModule[];
        setModules(allModules);
        const found = allModules.find((m) => m.id === id);
        if (found) {
          setModule(found);
          setModuleTitle(found.title);
          setModuleDesc(found.description);
          setCoverUrl(found.thumbnail_url || "");
          setIsPublished(found.is_published);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadModule(); }, [loadModule]);

  async function uploadAttachments(files: FileList | File[]): Promise<Attachment[]> {
    const fileArray = Array.from(files);
    const uploaded: Attachment[] = [];

    for (const file of fileArray) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("bucket", "training-resources");
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });

      if (!res.ok) {
        throw new Error(`upload_failed:${file.name}`);
      }

      const data = await res.json();
      uploaded.push({
        id: crypto.randomUUID(),
        name: data.fileName || file.name,
        url: data.url,
        type: guessAttachmentType(file.name, file.type),
        size: formatFileSize(file.size),
      });
    }

    return uploaded;
  }

  async function saveModule(updates: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/training/modules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      if (res.ok) {
        toast("Saved");
        await loadModule();
      } else {
        toast("Failed to save", "error");
      }
    } catch {
      toast("Failed to save", "error");
    } finally {
      setSaving(false);
    }
  }

  async function addLesson() {
    if (!newTitle.trim()) return;
    try {
      const res = await fetch("/api/admin/training/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module_id: id,
          title: newTitle,
          content_type: newType,
          content_url: newUrl || null,
          content_text: newDescription || null,
          duration_minutes: newDuration ? parseInt(newDuration) : null,
          attachments: newAttachments,
        }),
      });
      if (res.ok) {
        toast("Lesson added");
        setNewTitle(""); setNewType("video"); setNewUrl(""); setNewDuration(""); setNewDescription(""); setNewAttachments([]);
        setShowAddLesson(false);
        await loadModule();
      } else {
        toast("Failed to add lesson", "error");
      }
    } catch {
      toast("Failed to add lesson", "error");
    }
  }

  async function deleteLesson(lessonId: string) {
    try {
      const res = await fetch("/api/admin/training/lessons", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: lessonId }),
      });
      if (res.ok) {
        toast("Lesson removed");
        await loadModule();
      } else {
        toast("Failed to remove lesson", "error");
      }
    } catch {
      toast("Failed to remove lesson", "error");
    }
  }

  async function moveLesson(index: number, direction: "up" | "down") {
    const sorted = [...lessons].sort((a, b) => a.order_index - b.order_index);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;

    const lessonA = sorted[index];
    const lessonB = sorted[targetIndex];

    // Swap order_index values
    const orderA = lessonA.order_index;
    const orderB = lessonB.order_index;

    try {
      await Promise.all([
        fetch("/api/admin/training/lessons", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: lessonA.id, order_index: orderB }),
        }),
        fetch("/api/admin/training/lessons", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: lessonB.id, order_index: orderA }),
        }),
      ]);
      await loadModule();
      toast("Lesson reordered");
    } catch {
      toast("Failed to reorder", "error");
    }
  }

  async function deleteModule() {
    if (!confirm("Delete this entire module and all its lessons? This cannot be undone.")) return;
    try {
      const res = await fetch("/api/admin/training/modules", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        toast("Module deleted");
        router.push("/admin/training");
      } else {
        toast("Failed to delete module", "error");
      }
    } catch {
      toast("Failed to delete module", "error");
    }
  }

  if (loading) {
    return (
      <div className="ws ws-page">
        <span className="ws-skel" style={{ width: 120, height: 12 }} />
        <div className="ws-tr-head">
          <div className="ws-tr-head-b">
            <span className="ws-skel" style={{ width: "60%", height: 22 }} />
            <span className="ws-skel" style={{ width: "100%", height: 12 }} />
            <span className="ws-skel" style={{ width: "35%", height: 10 }} />
          </div>
          <div className="ws-skel ws-tr-skel-banner" />
        </div>
        <div className="ws-panel">
          <SkeletonRows count={3} />
        </div>
      </div>
    );
  }

  if (!module) {
    return (
      <div className="ws ws-page">
        <Link href="/admin/training" className="ws-back ws-focus">
          <Icon name="chevron" size={14} className="ws-back-ic" />
          Back to modules
        </Link>
        <div className="ws-panel">
          <Empty icon="book" title="Module not found." />
        </div>
      </div>
    );
  }

  const lessons = [...(module.content || [])].sort((a, b) => a.order_index - b.order_index);
  const totalDuration = lessons.reduce((sum, c) => sum + (c.duration_minutes || 0), 0);
  const totalAttachments = lessons.reduce((sum, c) => sum + (c.attachments?.length || 0), 0);

  return (
    <div className="ws ws-page">
      <Link
        href="/admin/training"
        className="ws-back ws-focus"
      >
        <Icon name="chevron" size={14} className="ws-back-ic" />
        Back to modules
      </Link>

      {/* Module header */}
      <header className="ws-tr-head">
        <div className="ws-tr-head-b">
          <div className="ws-tr-head-top">
            <span className="ws-caption">Training module</span>
            {/* Published toggle */}
            <button
              onClick={() => { const next = !isPublished; setIsPublished(next); saveModule({ is_published: next }); }}
              className={`ws-tr-pub ws-focus${isPublished ? " is-on" : ""}`}
            >
              <span className="ws-dot" />
              {isPublished ? "Published" : "Draft · click to publish"}
            </button>
          </div>

          {/* Title + Description */}
          {editingTitle ? (
            <div className="ws-tr-edit">
              <input
                type="text"
                value={moduleTitle}
                onChange={(e) => setModuleTitle(e.target.value)}
                className="ws-input ws-tr-title-input"
                autoFocus
              />
              <button onClick={() => { saveModule({ title: moduleTitle }); setEditingTitle(false); }} disabled={saving} className="ws-btn ws-btn-primary ws-focus">{saving ? "Saving..." : "Save"}</button>
              <button onClick={() => { setModuleTitle(module.title); setEditingTitle(false); }} className="ws-btn ws-btn-quiet ws-focus">Cancel</button>
            </div>
          ) : (
            <div className="ws-tr-editable">
              <h1 className="ws-title">{moduleTitle}</h1>
              <button
                onClick={() => setEditingTitle(true)}
                className="ws-btn ws-btn-quiet ws-btn-icon ws-tr-reveal ws-focus"
                aria-label="Edit title"
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </div>
          )}

          {editingDesc ? (
            <div>
              <textarea
                value={moduleDesc}
                onChange={(e) => setModuleDesc(e.target.value)}
                rows={3}
                className="ws-input"
                autoFocus
              />
              <div className="ws-tr-acts mt-2">
                <button onClick={() => { saveModule({ description: moduleDesc }); setEditingDesc(false); }} disabled={saving} className="ws-btn ws-btn-primary ws-btn-sm ws-focus">{saving ? "..." : "Save"}</button>
                <button onClick={() => { setModuleDesc(module.description); setEditingDesc(false); }} className="ws-btn ws-btn-quiet ws-btn-sm ws-focus">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="ws-tr-editable is-desc">
              <p className="ws-meta">{moduleDesc}</p>
              <button
                onClick={() => setEditingDesc(true)}
                className="ws-btn ws-btn-quiet ws-btn-icon ws-btn-sm ws-tr-reveal ws-focus"
                aria-label="Edit description"
              >
                <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </div>
          )}

          {/* Stats */}
          <div className="ws-tr-mmeta">
            <span>
              <Icon name="lessons" size={14} />
              {lessons.length} lessons
            </span>
            <span>
              <Icon name="clock" size={14} />
              {totalDuration} min total
            </span>
            <span>
              <Icon name="link" size={14} />
              {totalAttachments} attachments
            </span>
          </div>
        </div>

        {/* Cover - the module's cover image, or the CBB mark and title */}
        <ModuleCover title={moduleTitle} variant="banner" imageUrl={module.thumbnail_url} />
      </header>

      <section className="ws-panel">
        {/* Lessons header */}
        <div className="ws-panel-head">
          <h2 className="ws-h2">Lessons</h2>
          <button
            onClick={() => setShowAddLesson(!showAddLesson)}
            className="ws-btn ws-btn-primary ws-focus"
          >
            <Icon name="plus" size={14} />
            Add lesson
          </button>
        </div>

        {/* Add lesson form */}
        {showAddLesson && (
          <div className="ws-tr-addform">
            <h3 className="ws-h3">New lesson</h3>
            <div className="ws-tr-fields">
              <div>
                <label className="ws-label">Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Lesson title"
                  className="ws-input"
                />
              </div>
              <div>
                <label className="ws-label">Type</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as ContentType)}
                  className="ws-input"
                >
                  <option value="video">Video</option>
                  <option value="pdf">PDF / Document</option>
                  <option value="text">Text / Article</option>
                  <option value="checklist">Checklist</option>
                </select>
              </div>
              <div>
                <label className="ws-label">
                  {newType === "video" ? "Video URL (YouTube, Vimeo, or Fathom)" : newType === "pdf" ? "Upload File or Paste URL" : "URL (optional)"}
                </label>
                {newType === "pdf" ? (
                  <div className="ws-tr-stack">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.pptx,.zip"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const fd = new FormData();
                        fd.append("file", file);
                        fd.append("bucket", "training-resources");
                        const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
                        if (res.ok) {
                          const data = await res.json();
                          setNewUrl(data.url);
                        } else {
                          alert("Upload failed");
                        }
                      }}
                      className="ws-input ws-tr-fileinput"
                    />
                    {newUrl && <p className="ws-caption" style={{ color: "var(--ws-ok)" }}>File uploaded</p>}
                    <input
                      type="text"
                      value={newUrl}
                      onChange={(e) => setNewUrl(e.target.value)}
                      placeholder="Or paste a URL directly"
                      className="ws-input"
                    />
                  </div>
                ) : (
                  <input
                    type="text"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder={newType === "video" ? "https://fathom.video/share/... or YouTube/Vimeo URL" : "https://..."}
                    className="ws-input"
                  />
                )}
              </div>
              <div>
                <label className="ws-label">Duration (minutes)</label>
                <input
                  type="number"
                  value={newDuration}
                  onChange={(e) => setNewDuration(e.target.value)}
                  placeholder="e.g. 15"
                  className="ws-input"
                />
              </div>
              <div className="ws-tr-span2">
                <label className="ws-label">Description / Notes</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={4}
                  placeholder="Add lesson description, key takeaways, or any supporting copy..."
                  className="ws-input"
                />
              </div>
              <div className="ws-tr-span2">
                <label className="ws-label">Supporting files <span>(optional)</span></label>
                <div className="ws-tr-stack">
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.zip,.png,.jpg,.jpeg,.webp"
                    onChange={async (e) => {
                      const files = e.target.files;
                      if (!files?.length) return;
                      setUploadingNewAttachments(true);
                      try {
                        const uploaded = await uploadAttachments(files);
                        setNewAttachments((prev) => [...prev, ...uploaded]);
                        toast(uploaded.length === 1 ? "File attached" : `${uploaded.length} files attached`);
                      } catch {
                        toast("Failed to upload file", "error");
                      } finally {
                        setUploadingNewAttachments(false);
                        e.target.value = "";
                      }
                    }}
                    className="ws-input ws-tr-fileinput"
                  />
                  {uploadingNewAttachments && <p className="ws-caption">Uploading...</p>}
                  {newAttachments.length > 0 && (
                    <div className="ws-tr-files">
                      {newAttachments.map((attachment) => (
                        <AttachmentRow
                          key={attachment.id}
                          attachment={attachment}
                          onRemove={() => setNewAttachments((prev) => prev.filter((item) => item.id !== attachment.id))}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="ws-tr-acts mt-4">
              <button onClick={addLesson} className="ws-btn ws-btn-primary ws-focus">Add lesson</button>
              <button onClick={() => setShowAddLesson(false)} className="ws-btn ws-btn-quiet ws-focus">Cancel</button>
            </div>
          </div>
        )}

        {/* Lessons list */}
        <div>
          {lessons.map((lesson, i) => (
            <LessonCard
              key={lesson.id}
              lesson={lesson}
              index={i}
              isFirst={i === 0}
              isLast={i === lessons.length - 1}
              isExpanded={expandedLesson === lesson.id}
              onToggle={() => setExpandedLesson(expandedLesson === lesson.id ? null : lesson.id)}
              onDelete={() => deleteLesson(lesson.id)}
              onMoveUp={() => moveLesson(i, "up")}
              onMoveDown={() => moveLesson(i, "down")}
              modules={modules}
              onSave={async (updates) => {
                const res = await fetch("/api/admin/training/lessons", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id: lesson.id, ...updates }),
                });
                if (res.ok) { toast("Lesson updated"); await loadModule(); }
                else { toast("Failed to update lesson", "error"); }
              }}
            />
          ))}
        </div>

        {lessons.length === 0 && (
          <Empty icon="book" title="No lessons yet" text="Add your first one above." />
        )}
      </section>

      {/* Danger zone */}
      <div className="ws-tr-danger">
        <button
          onClick={deleteModule}
          className="ws-btn ws-btn-quiet ws-btn-sm ws-tr-del ws-focus"
        >
          <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete module
        </button>
      </div>
    </div>
  );
}

function LessonCard({
  lesson,
  index,
  isFirst,
  isLast,
  isExpanded,
  onToggle,
  onDelete,
  onMoveUp,
  onMoveDown,
  modules,
  onSave,
}: {
  lesson: ModuleContent;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  modules: TrainingModule[];
  onSave: (updates: Record<string, unknown>) => Promise<void>;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(lesson.title);
  const [editUrl, setEditUrl] = useState(lesson.content_url || "");
  const [editText, setEditText] = useState(lesson.content_text || "");
  const [editDuration, setEditDuration] = useState(String(lesson.duration_minutes || ""));
  const [editType, setEditType] = useState<ContentType>(lesson.content_type);
  const [editModuleId, setEditModuleId] = useState(lesson.module_id);
  const [editAttachments, setEditAttachments] = useState<Attachment[]>(lesson.attachments || []);
  const [savingLesson, setSavingLesson] = useState(false);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const contentTypeLabels: Record<ContentType, { label: string; icon: string; color: string }> = {
    video: {
      label: "Video",
      icon: "M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
      color: "text-accent-bright bg-accent/10",
    },
    pdf: {
      label: "Document",
      icon: "M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z",
      color: "text-red-400 bg-red-500/10",
    },
    text: {
      label: "Article",
      icon: "M4 6h16M4 12h16M4 18h7",
      color: "text-text-secondary bg-[rgba(255,255,255,0.04)]",
    },
    checklist: {
      label: "Checklist",
      icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
      color: "text-emerald-400 bg-emerald-500/10",
    },
  };

  const ct = contentTypeLabels[lesson.content_type];

  return (
    <div className={`ws-tr-lesson${isExpanded ? " is-open" : ""}`}>
      {/* Collapsed row */}
      <button
        onClick={onToggle}
        className="ws-tr-lesson-h is-admin ws-focus"
      >
        <span className="ws-tr-lesson-n">{index + 1}</span>

        <span className={`ws-tr-lesson-ic is-${lesson.content_type}`}>
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d={ct.icon} />
          </svg>
        </span>

        <span className="min-w-0">
          <span className="ws-tr-lesson-t">{lesson.title}</span>
          <span className="ws-tr-lesson-s">
            <span>{ct.label}</span>
            {lesson.duration_minutes && <span>{lesson.duration_minutes} min</span>}
            {lesson.attachments && lesson.attachments.length > 0 && (
              <span>{lesson.attachments.length} file{lesson.attachments.length !== 1 ? "s" : ""}</span>
            )}
          </span>
        </span>

        <span className="ws-tr-lesson-acts">
          {!isFirst && (
            <button
              onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
              className="ws-tr-mini ws-tr-reveal"
              title="Move up"
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
          )}
          {!isLast && (
            <button
              onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
              className="ws-tr-mini ws-tr-reveal"
              title="Move down"
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
          <button className="ws-tr-mini ws-tr-reveal">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <Icon name="chevron" size={14} className={`ws-chev${isExpanded ? " is-open" : ""}`} />
        </span>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="ws-tr-lesson-body">
          {editing ? (
            /* Edit mode */
            <div className="ws-tr-stack is-lg">
              <div className="ws-tr-fields">
                <div>
                  <label className="ws-label">Title</label>
                  <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="ws-input" />
                </div>
                <div>
                  <label className="ws-label">Type</label>
                  <select value={editType} onChange={(e) => setEditType(e.target.value as ContentType)} className="ws-input">
                    <option value="video">Video</option>
                    <option value="text">Article</option>
                    <option value="pdf">Document</option>
                    <option value="checklist">Checklist</option>
                  </select>
                </div>
                <div>
                  <label className="ws-label">URL</label>
                  <input type="text" value={editUrl} onChange={(e) => setEditUrl(e.target.value)} placeholder="https://..." className="ws-input" />
                </div>
                <div>
                  <label className="ws-label">Duration (minutes)</label>
                  <input type="number" value={editDuration} onChange={(e) => setEditDuration(e.target.value)} placeholder="e.g. 15" className="ws-input" />
                </div>
                <div className="ws-tr-span2">
                  <label className="ws-label">Move to module</label>
                  <select
                    value={editModuleId}
                    onChange={(e) => setEditModuleId(e.target.value)}
                    className="ws-input"
                  >
                    {modules.map((mod) => (
                      <option key={mod.id} value={mod.id}>
                        {mod.title}
                      </option>
                    ))}
                  </select>
                  {editModuleId !== lesson.module_id && (
                    <p className="ws-caption mt-1.5" style={{ color: "var(--ws-attn)" }}>
                      Saving will move this lesson out of the current module.
                    </p>
                  )}
                </div>
                <div className="ws-tr-span2">
                  <label className="ws-label">Description / Notes</label>
                  <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={4} placeholder="Lesson description..." className="ws-input" />
                </div>
                <div className="ws-tr-span2">
                  <label className="ws-label">Supporting files</label>
                  <div className="ws-tr-stack">
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.zip,.png,.jpg,.jpeg,.webp"
                      onChange={async (e) => {
                        const files = e.target.files;
                        if (!files?.length) return;
                        setUploadingAttachments(true);
                        try {
                          const uploaded = await Promise.all(Array.from(files).map(async (file) => {
                            const fd = new FormData();
                            fd.append("file", file);
                            fd.append("bucket", "training-resources");
                            const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
                            if (!res.ok) throw new Error("upload_failed");
                            const data = await res.json();
                            return {
                              id: crypto.randomUUID(),
                              name: data.fileName || file.name,
                              url: data.url,
                              type: guessAttachmentType(file.name, file.type),
                              size: formatFileSize(file.size),
                            } satisfies Attachment;
                          }));
                          setEditAttachments((prev) => [...prev, ...uploaded]);
                          toast(uploaded.length === 1 ? "File attached" : `${uploaded.length} files attached`);
                        } catch {
                          toast("Failed to upload file", "error");
                        } finally {
                          setUploadingAttachments(false);
                          e.target.value = "";
                        }
                      }}
                      className="ws-input ws-tr-fileinput"
                    />
                    {uploadingAttachments && <p className="ws-caption">Uploading...</p>}
                    {editAttachments.length > 0 && (
                      <div className="ws-tr-files">
                        {editAttachments.map((attachment) => (
                          <AttachmentRow
                            key={attachment.id}
                            attachment={attachment}
                            onRemove={() => setEditAttachments((prev) => prev.filter((item) => item.id !== attachment.id))}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="ws-tr-acts">
                <button
                  disabled={savingLesson || !editTitle.trim()}
                  onClick={async () => {
                    setSavingLesson(true);
                    await onSave({
                      title: editTitle,
                      content_type: editType,
                      content_url: editUrl || null,
                      content_text: editText || null,
                      duration_minutes: editDuration ? parseInt(editDuration) : null,
                      module_id: editModuleId,
                      attachments: editAttachments,
                    });
                    setSavingLesson(false);
                    setEditing(false);
                  }}
                  className="ws-btn ws-btn-primary ws-focus"
                >
                  {savingLesson ? "Saving..." : "Save changes"}
                </button>
                <button
                  onClick={() => {
                    setEditTitle(lesson.title);
                    setEditUrl(lesson.content_url || "");
                    setEditText(lesson.content_text || "");
                    setEditDuration(String(lesson.duration_minutes || ""));
                    setEditType(lesson.content_type);
                    setEditModuleId(lesson.module_id);
                    setEditAttachments(lesson.attachments || []);
                    setEditing(false);
                  }}
                  className="ws-btn ws-btn-quiet ws-focus"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            /* View mode */
            <>
              {/* Video embed */}
              {lesson.content_type === "video" && lesson.content_url && (
                <div className="ws-tr-video">
                  {isNativeLessonVideo(lesson.content_url) ? <video controls preload="metadata" src={nativeLessonVideoUrl(lesson.content_url)} className="absolute inset-0 w-full h-full" aria-label={lesson.title} /> : (<iframe
                    src={getVideoEmbed(lesson.content_url).embedUrl}
                    className="absolute top-0 left-0 w-full h-full"
                    allow="encrypted-media *; fullscreen *"
                    allowFullScreen
                    scrolling="no"
                    title={lesson.title}
                    style={{ border: 0 }}
                  />)}
                </div>
              )}

              {/* Video URL display */}
              {lesson.content_url && (
                <div className="ws-tr-url">
                  <Icon name="link" size={14} />
                  <span className="ws-tr-url-t">{lesson.content_url}</span>
                  <button onClick={() => setEditing(true)} className="ws-tr-textbtn">Edit URL</button>
                </div>
              )}

              {/* Description */}
              {lesson.content_text && (
                <div>
                  <div className="ws-tr-subhead">
                    <span className="ws-field-l">Description</span>
                    <button onClick={() => setEditing(true)} className="ws-tr-textbtn">Edit</button>
                  </div>
                  <div className="ws-prose ws-tr-text">{lesson.content_text}</div>
                </div>
              )}

              {lesson.attachments && lesson.attachments.length > 0 && (
                <div>
                  <div className="ws-tr-subhead">
                    <span className="ws-field-l">Attachments</span>
                    <button onClick={() => setEditing(true)} className="ws-tr-textbtn">Manage</button>
                  </div>
                  <div className="ws-tr-files">
                    {lesson.attachments.map((attachment) => (
                      <AttachmentRow key={attachment.id} attachment={attachment} />
                    ))}
                  </div>
                </div>
              )}

              {/* Action row */}
              <div className="ws-tr-lesson-foot">
                <button onClick={() => setEditing(true)} className="ws-btn ws-btn-sm ws-focus">
                  <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Edit lesson
                </button>
                <div className="flex-1" />
                <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="ws-btn ws-btn-quiet ws-btn-sm ws-tr-del ws-focus">
                  <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Remove
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function AttachmentRow({
  attachment,
  onRemove,
}: {
  attachment: Attachment;
  onRemove?: () => void;
}) {
  const meta = attachmentIcons[attachment.type] || attachmentIcons.other;

  return (
    <div className="ws-tr-file">
      <span className={`ws-tr-file-ic is-${attachment.type in attachmentIcons ? attachment.type : "other"}`}>
        <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={meta.icon} />
        </svg>
      </span>
      <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="ws-tr-file-link">
        <span className="ws-tr-file-n">{attachment.name}</span>
        {attachment.size && <span className="ws-tr-file-m">{attachment.size}</span>}
      </a>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="ws-tr-textbtn is-bad"
        >
          Remove
        </button>
      ) : (
        <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="ws-tr-textbtn">
          Download
        </a>
      )}
    </div>
  );
}
