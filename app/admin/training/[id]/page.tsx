"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { TrainingModule, ModuleContent, ContentType } from "@/lib/types";

export default function ModuleEditorPage() {
  const { id } = useParams();
  const [module, setModule] = useState<TrainingModule | null>(null);
  const [content, setContent] = useState<ModuleContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<ContentType>("video");
  const [newUrl, setNewUrl] = useState("");
  const [newDuration, setNewDuration] = useState("");

  useEffect(() => {
    loadModule();
  }, [id]);

  async function loadModule() {
    const supabase = createClient();
    const { data: mod } = await supabase
      .from("training_modules")
      .select("*")
      .eq("id", id)
      .single();

    const { data: contentData } = await supabase
      .from("module_content")
      .select("*")
      .eq("module_id", id)
      .order("order_index");

    if (mod) setModule(mod);
    if (contentData) setContent(contentData);
    setLoading(false);
  }

  async function addContent() {
    if (!newTitle.trim()) return;
    const supabase = createClient();

    await supabase.from("module_content").insert({
      module_id: id,
      title: newTitle,
      content_type: newType,
      content_url: newUrl || null,
      duration_minutes: newDuration ? parseInt(newDuration) : null,
      order_index: content.length,
    });

    setNewTitle("");
    setNewUrl("");
    setNewDuration("");
    setShowAdd(false);
    loadModule();
  }

  async function deleteContent(contentId: string) {
    const supabase = createClient();
    await supabase.from("module_content").delete().eq("id", contentId);
    setContent((prev) => prev.filter((c) => c.id !== contentId));
  }

  async function updateModuleField(field: string, value: string | boolean) {
    const supabase = createClient();
    await supabase.from("training_modules").update({ [field]: value }).eq("id", id);
    setModule((prev) => prev ? { ...prev, [field]: value } : null);
  }

  if (loading) return <div className="text-text-muted">Loading...</div>;
  if (!module) return <div className="text-text-muted">Module not found.</div>;

  return (
    <>
      <Link href="/admin/training" className="text-text-muted text-sm hover:text-text-secondary transition-colors no-underline inline-flex items-center gap-1 mb-6">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back to Modules
      </Link>

      {/* Module details */}
      <div className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <h1 className="text-2xl font-heading font-bold text-text-primary">{module.title}</h1>
          <button
            onClick={() => updateModuleField("is_published", !module.is_published)}
            className={`text-xs px-4 py-2 rounded-full transition-colors ${
              module.is_published
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-[rgba(255,255,255,0.04)] text-text-muted border border-[rgba(255,255,255,0.06)]"
            }`}
          >
            {module.is_published ? "Published" : "Draft - Publish"}
          </button>
        </div>
        <p className="text-text-secondary text-sm">{module.description}</p>
      </div>

      {/* Content list */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-heading font-bold text-text-primary">Lessons ({content.length})</h2>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 gradient-accent text-white rounded-xl text-sm font-medium"
        >
          Add Lesson
        </button>
      </div>

      {showAdd && (
        <div className="bg-bg-card border border-[rgba(255,255,255,0.06)] rounded-2xl p-6 mb-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Lesson title"
                className="w-full bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">Type</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as ContentType)}
                className="w-full bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm focus:outline-none focus:border-accent/40"
              >
                <option value="video">Video</option>
                <option value="pdf">PDF</option>
                <option value="text">Text</option>
                <option value="checklist">Checklist</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">URL (optional)</label>
              <input
                type="text"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="Video/PDF URL"
                className="w-full bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">Duration (min)</label>
              <input
                type="number"
                value={newDuration}
                onChange={(e) => setNewDuration(e.target.value)}
                placeholder="e.g. 15"
                className="w-full bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={addContent} className="px-5 py-2 gradient-accent text-white rounded-xl text-sm font-medium">Add</button>
            <button onClick={() => setShowAdd(false)} className="px-5 py-2 text-text-muted text-sm hover:text-text-secondary">Cancel</button>
          </div>
        </div>
      )}

      {content.length === 0 ? (
        <div className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-8 text-center">
          <p className="text-text-muted text-sm">No lessons yet. Add your first one above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {content.map((c, i) => (
            <div key={c.id} className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-xl p-4 flex items-center gap-4">
              <div className="text-text-muted text-sm font-mono w-6 text-center">{i + 1}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text-primary">{c.title}</div>
                <div className="text-xs text-text-muted mt-0.5">
                  {c.content_type}{c.duration_minutes ? ` - ${c.duration_minutes} min` : ""}
                </div>
              </div>
              <button
                onClick={() => deleteContent(c.id)}
                className="text-xs text-text-muted hover:text-red-400 transition-colors px-2"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
