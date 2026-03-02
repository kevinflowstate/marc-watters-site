"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { TrainingModule } from "@/lib/types";

export default function TrainingManagerPage() {
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");

  useEffect(() => {
    loadModules();
  }, []);

  async function loadModules() {
    const supabase = createClient();
    const { data } = await supabase
      .from("training_modules")
      .select("*, content:module_content(id)")
      .order("order_index");

    if (data) setModules(data);
    setLoading(false);
  }

  async function addModule() {
    if (!newTitle.trim()) return;
    const supabase = createClient();

    await supabase.from("training_modules").insert({
      title: newTitle,
      description: newDesc,
      order_index: modules.length,
      is_published: false,
    });

    setNewTitle("");
    setNewDesc("");
    setShowAdd(false);
    loadModules();
  }

  async function togglePublish(mod: TrainingModule) {
    const supabase = createClient();
    await supabase
      .from("training_modules")
      .update({ is_published: !mod.is_published })
      .eq("id", mod.id);

    setModules((prev) =>
      prev.map((m) => m.id === mod.id ? { ...m, is_published: !m.is_published } : m)
    );
  }

  async function deleteModule(id: string) {
    const supabase = createClient();
    await supabase.from("training_modules").delete().eq("id", id);
    setModules((prev) => prev.filter((m) => m.id !== id));
  }

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-heading font-bold text-text-primary">Training Modules</h1>
          <p className="text-text-secondary mt-1">Manage your coaching content library.</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-5 py-3 gradient-accent text-white rounded-xl text-sm font-semibold"
        >
          Add Module
        </button>
      </div>

      {/* Add modal */}
      {showAdd && (
        <div className="bg-bg-card border border-[rgba(255,255,255,0.06)] rounded-2xl p-6 mb-6">
          <h3 className="text-lg font-heading font-bold text-text-primary mb-4">New Module</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Foundations of Business Growth"
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
              <button onClick={addModule} className="px-5 py-2 gradient-accent text-white rounded-xl text-sm font-medium">Create</button>
              <button onClick={() => setShowAdd(false)} className="px-5 py-2 text-text-muted text-sm hover:text-text-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Module list */}
      {loading ? (
        <div className="text-text-muted">Loading modules...</div>
      ) : modules.length === 0 ? (
        <div className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-8 text-center">
          <p className="text-text-secondary">No training modules yet. Create your first one.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {modules.map((mod, i) => (
            <div
              key={mod.id}
              className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-5 flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-xl bg-[rgba(34,114,222,0.1)] border border-[rgba(34,114,222,0.2)] flex items-center justify-center text-accent-bright font-bold text-sm flex-shrink-0">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text-primary">{mod.title}</div>
                <div className="text-xs text-text-muted mt-0.5">{mod.description || "No description"} - {(mod as TrainingModule & { content?: { id: string }[] }).content?.length || 0} lessons</div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => togglePublish(mod)}
                  className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                    mod.is_published
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-[rgba(255,255,255,0.04)] text-text-muted"
                  }`}
                >
                  {mod.is_published ? "Published" : "Draft"}
                </button>
                <Link
                  href={`/admin/training/${mod.id}`}
                  className="text-xs text-accent-bright hover:text-accent-light transition-colors no-underline px-3 py-1.5"
                >
                  Edit
                </Link>
                <button
                  onClick={() => deleteModule(mod.id)}
                  className="text-xs text-text-muted hover:text-red-400 transition-colors px-2 py-1.5"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
