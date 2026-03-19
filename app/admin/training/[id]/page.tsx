"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import type { TrainingModule, ModuleContent, Attachment, ContentType } from "@/lib/types";
import ModuleCover from "@/components/training/ModuleCover";

const attachmentIcons: Record<string, { icon: string; color: string }> = {
  pdf: { icon: "M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z", color: "text-red-400 bg-red-500/10" },
  sheet: { icon: "M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2z", color: "text-emerald-400 bg-emerald-500/10" },
  doc: { icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", color: "text-blue-400 bg-blue-500/10" },
  image: { icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z", color: "text-purple-400 bg-purple-500/10" },
  other: { icon: "M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13", color: "text-text-muted bg-[rgba(255,255,255,0.04)]" },
};

function getVideoEmbed(url: string): { type: "youtube" | "vimeo" | "unknown"; embedUrl: string } {
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

  return { type: "unknown", embedUrl: url };
}

export default function ModuleEditorPage() {
  const { id } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [module, setModule] = useState<TrainingModule | null>(null);
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

  const loadModule = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/training");
      if (res.ok) {
        const data = await res.json();
        const found = (data.modules || []).find((m: TrainingModule) => m.id === id);
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
        }),
      });
      if (res.ok) {
        toast("Lesson added");
        setNewTitle(""); setNewType("video"); setNewUrl(""); setNewDuration(""); setNewDescription("");
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
      <div className="space-y-4">
        <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-4 w-32 mb-6" />
        <div className="bg-bg-card/80 border border-[rgba(255,255,255,0.04)] rounded-2xl overflow-hidden">
          <div className="h-40 animate-pulse bg-[rgba(255,255,255,0.04)]" />
          <div className="p-6 space-y-3">
            <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-6 w-2/3" />
            <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-4 w-full" />
            <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-3 w-1/3" />
          </div>
        </div>
        <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-5 w-20 mt-4" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-bg-card/80 border border-[rgba(255,255,255,0.04)] rounded-2xl p-4 flex items-center gap-4">
            <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg w-6 h-4" />
            <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg w-8 h-8" />
            <div className="flex-1 space-y-2">
              <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-4 w-3/4" />
              <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-3 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!module) {
    return (
      <div className="text-text-muted">
        <Link href="/admin/training" className="text-accent-bright hover:text-accent-light transition-colors no-underline text-sm">
          Back to Modules
        </Link>
        <p className="mt-4">Module not found.</p>
      </div>
    );
  }

  const lessons = module.content || [];
  const totalDuration = lessons.reduce((sum, c) => sum + (c.duration_minutes || 0), 0);
  const totalAttachments = lessons.reduce((sum, c) => sum + (c.attachments?.length || 0), 0);

  return (
    <>
      <Link
        href="/admin/training"
        className="text-text-muted text-sm hover:text-text-secondary transition-colors no-underline inline-flex items-center gap-1 mb-6"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Modules
      </Link>

      {/* Module header card */}
      <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(255,255,255,0.04)] rounded-2xl overflow-hidden mb-6">
        {/* Cover area - auto-generated from title */}
        <div className="relative">
          <ModuleCover title={moduleTitle} variant="banner" />

          {/* Published toggle */}
          <div className="absolute top-4 right-4">
            <button
              onClick={() => { const next = !isPublished; setIsPublished(next); saveModule({ is_published: next }); }}
              className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-all ${
                isPublished
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30"
                  : "bg-white/10 text-white/60 border border-white/10 hover:border-white/20"
              }`}
            >
              {isPublished ? "Published" : "Draft - Click to Publish"}
            </button>
          </div>
        </div>

        {/* Title + Description */}
        <div className="p-6">
          {editingTitle ? (
            <div className="flex items-center gap-3 mb-3">
              <input
                type="text"
                value={moduleTitle}
                onChange={(e) => setModuleTitle(e.target.value)}
                className="flex-1 bg-bg-primary border border-[rgba(255,255,255,0.1)] rounded-xl px-4 py-3 text-xl font-heading font-bold text-text-primary focus:outline-none focus:border-accent/40"
                autoFocus
              />
              <button onClick={() => { saveModule({ title: moduleTitle }); setEditingTitle(false); }} disabled={saving} className="px-4 py-2 gradient-accent text-white rounded-xl text-sm font-medium disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
              <button onClick={() => { setModuleTitle(module.title); setEditingTitle(false); }} className="px-4 py-2 text-text-muted text-sm">Cancel</button>
            </div>
          ) : (
            <div className="flex items-center gap-3 mb-3 group">
              <h1 className="text-2xl font-heading font-bold text-text-primary">{moduleTitle}</h1>
              <button
                onClick={() => setEditingTitle(true)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-text-muted hover:text-accent-bright"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </div>
          )}

          {editingDesc ? (
            <div className="mb-4">
              <textarea
                value={moduleDesc}
                onChange={(e) => setModuleDesc(e.target.value)}
                rows={3}
                className="w-full bg-bg-primary border border-[rgba(255,255,255,0.1)] rounded-xl px-4 py-3 text-sm text-text-secondary focus:outline-none focus:border-accent/40 resize-none"
                autoFocus
              />
              <div className="flex gap-2 mt-2">
                <button onClick={() => { saveModule({ description: moduleDesc }); setEditingDesc(false); }} disabled={saving} className="px-3 py-1.5 gradient-accent text-white rounded-lg text-xs font-medium disabled:opacity-50">{saving ? "..." : "Save"}</button>
                <button onClick={() => { setModuleDesc(module.description); setEditingDesc(false); }} className="px-3 py-1.5 text-text-muted text-xs">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="group flex items-start gap-2 mb-4">
              <p className="text-sm text-text-secondary leading-relaxed">{moduleDesc}</p>
              <button
                onClick={() => setEditingDesc(true)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-text-muted hover:text-accent-bright flex-shrink-0 mt-0.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center gap-5 text-xs text-text-muted">
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              </svg>
              {lessons.length} lessons
            </div>
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {totalDuration} min total
            </div>
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              {totalAttachments} attachments
            </div>
          </div>
        </div>
      </div>

      {/* Lessons header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-heading font-bold text-text-primary">Lessons</h2>
        <button
          onClick={() => setShowAddLesson(!showAddLesson)}
          className="px-4 py-2 gradient-accent text-white rounded-xl text-sm font-medium inline-flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Lesson
        </button>
      </div>

      {/* Add lesson form */}
      {showAddLesson && (
        <div className="bg-bg-card/80 backdrop-blur-sm border border-accent/20 rounded-2xl p-6 mb-4">
          <h3 className="text-sm font-heading font-bold text-text-primary mb-4">New Lesson</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Lesson title"
                className="w-full bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Type</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as ContentType)}
                className="w-full bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm focus:outline-none focus:border-accent/40"
              >
                <option value="video">Video</option>
                <option value="pdf">PDF / Document</option>
                <option value="text">Text / Article</option>
                <option value="checklist">Checklist</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Video URL (YouTube or Vimeo)</label>
              <input
                type="text"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=... or https://vimeo.com/..."
                className="w-full bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Duration (minutes)</label>
              <input
                type="number"
                value={newDuration}
                onChange={(e) => setNewDuration(e.target.value)}
                placeholder="e.g. 15"
                className="w-full bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Description / Notes</label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={4}
                placeholder="Add lesson description, key takeaways, or any supporting copy..."
                className="w-full bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40 resize-none"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={addLesson} className="px-5 py-2.5 gradient-accent text-white rounded-xl text-sm font-medium cursor-pointer">Add Lesson</button>
            <button onClick={() => setShowAddLesson(false)} className="px-5 py-2.5 text-text-muted text-sm hover:text-text-secondary cursor-pointer">Cancel</button>
          </div>
        </div>
      )}

      {/* Lessons list */}
      <div className="space-y-2">
        {lessons.map((lesson, i) => (
          <LessonCard
            key={lesson.id}
            lesson={lesson}
            index={i}
            isExpanded={expandedLesson === lesson.id}
            onToggle={() => setExpandedLesson(expandedLesson === lesson.id ? null : lesson.id)}
            onDelete={() => deleteLesson(lesson.id)}
          />
        ))}
      </div>

      {lessons.length === 0 && (
        <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(255,255,255,0.04)] rounded-2xl p-8 text-center">
          <p className="text-text-muted text-sm">No lessons yet. Add your first one above.</p>
        </div>
      )}

      {/* Danger zone */}
      <div className="mt-12 pt-6 border-t border-[rgba(255,255,255,0.04)]">
        <button
          onClick={deleteModule}
          className="text-xs text-text-muted hover:text-red-400 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete Module
        </button>
      </div>
    </>
  );
}

function LessonCard({
  lesson,
  index,
  isExpanded,
  onToggle,
  onDelete,
}: {
  lesson: ModuleContent;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
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
    <div className="group/lesson relative bg-bg-card/80 backdrop-blur-sm border border-[rgba(255,255,255,0.04)] rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:border-[rgba(34,114,222,0.15)] hover:shadow-[0_10px_30px_rgba(0,0,0,0.2),0_0_30px_rgba(34,114,222,0.04)] will-change-transform">
      <div className="absolute inset-0 opacity-0 group-hover/lesson:opacity-100 transition-opacity duration-300 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[length:4px_4px] z-10 pointer-events-none" />
      <div className="absolute inset-0 -z-10 rounded-2xl p-px bg-gradient-to-br from-transparent via-white/10 to-transparent opacity-0 group-hover/lesson:opacity-100 transition-opacity duration-300 pointer-events-none" />
      {/* Collapsed row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 p-4 text-left hover:bg-[rgba(255,255,255,0.02)] transition-colors cursor-pointer"
      >
        <div className="text-text-muted text-sm font-mono w-6 text-center flex-shrink-0">{index + 1}</div>

        <div className={`w-8 h-8 rounded-lg ${ct.color} flex items-center justify-center flex-shrink-0`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={ct.icon} />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-text-primary">{lesson.title}</div>
          <div className="flex items-center gap-3 text-xs text-text-muted mt-0.5">
            <span>{ct.label}</span>
            {lesson.duration_minutes && <span>{lesson.duration_minutes} min</span>}
            {lesson.attachments && lesson.attachments.length > 0 && (
              <span>{lesson.attachments.length} file{lesson.attachments.length !== 1 ? "s" : ""}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button className="p-1.5 text-text-muted hover:text-accent-bright transition-colors opacity-0 group-hover:opacity-100">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <svg
            className={`w-4 h-4 text-text-muted transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-[rgba(255,255,255,0.04)] p-5 space-y-5">
          {/* Video embed */}
          {lesson.content_type === "video" && lesson.content_url && (
            <div className="rounded-xl overflow-hidden border border-[rgba(255,255,255,0.06)] shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
              <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                <iframe
                  src={getVideoEmbed(lesson.content_url).embedUrl}
                  className="absolute top-0 left-0 w-full h-full"
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                  title={lesson.title}
                />
              </div>
            </div>
          )}

          {/* Video URL display */}
          {lesson.content_url && (
            <div className="flex items-center gap-2 bg-bg-primary border border-[rgba(255,255,255,0.04)] rounded-xl px-4 py-3">
              <svg className="w-4 h-4 text-text-muted flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <span className="text-xs text-text-muted truncate flex-1">{lesson.content_url}</span>
              <button className="text-xs text-accent-bright hover:text-accent-light transition-colors flex-shrink-0">Edit URL</button>
            </div>
          )}

          {/* Description */}
          {lesson.content_text && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Description</span>
                <button className="text-xs text-accent-bright hover:text-accent-light transition-colors">Edit</button>
              </div>
              <div className="bg-bg-primary border border-[rgba(255,255,255,0.04)] rounded-xl p-4">
                <div className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">{lesson.content_text}</div>
              </div>
            </div>
          )}

          {/* Attachments */}
          {lesson.attachments && lesson.attachments.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  Attachments ({lesson.attachments.length})
                </span>
                <button className="text-xs text-accent-bright hover:text-accent-light transition-colors inline-flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add File
                </button>
              </div>
              <div className="space-y-2">
                {lesson.attachments.map((att) => {
                  const ai = attachmentIcons[att.type] || attachmentIcons.other;
                  return (
                    <div
                      key={att.id}
                      className="flex items-center gap-3 bg-bg-primary border border-[rgba(255,255,255,0.04)] rounded-xl px-4 py-3 hover:border-[rgba(255,255,255,0.08)] transition-colors group"
                    >
                      <div className={`w-8 h-8 rounded-lg ${ai.color} flex items-center justify-center flex-shrink-0`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={ai.icon} />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-text-primary font-medium truncate">{att.name}</div>
                        <div className="text-[10px] text-text-muted uppercase">
                          {att.type} {att.size && `- ${att.size}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button className="p-1.5 text-text-muted hover:text-accent-bright transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </button>
                        <button className="p-1.5 text-text-muted hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action row */}
          <div className="flex items-center gap-2 pt-2 border-t border-[rgba(255,255,255,0.03)]">
            <button className="text-xs text-text-muted hover:text-text-secondary transition-colors inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.03)]">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Edit Lesson
            </button>
            <button className="text-xs text-text-muted hover:text-text-secondary transition-colors inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.03)]">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              Add Attachment
            </button>
            <div className="flex-1" />
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-xs text-text-muted hover:text-red-400 transition-colors inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-red-500/5 cursor-pointer">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
