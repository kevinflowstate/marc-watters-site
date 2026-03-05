"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { TrainingModule, ModuleContent } from "@/lib/types";

export default function ModuleView() {
  const { id } = useParams();
  const [module, setModule] = useState<TrainingModule | null>(null);
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/portal/training/${id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.module) {
            data.module.content?.sort((a: ModuleContent, b: ModuleContent) => a.order_index - b.order_index);
            setModule(data.module);
          }
          setProgress(data.progress || {});
          setProfileId(data.profileId);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function toggleComplete(contentId: string) {
    if (!profileId) return;
    const isCompleted = progress[contentId];

    // Optimistic update
    setProgress((prev) => ({ ...prev, [contentId]: !isCompleted }));

    // Persist via API
    await fetch(`/api/portal/training/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentId, completed: !isCompleted, profileId }),
    });
  }

  const contentTypeIcons: Record<string, string> = {
    video: "M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    pdf: "M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z",
    text: "M4 6h16M4 12h16M4 18h7",
    checklist: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
  };

  if (loading) return <div className="text-text-muted">Loading module...</div>;
  if (!module) return <div className="text-text-muted">Module not found.</div>;

  const completedCount = module.content?.filter((c) => progress[c.id])?.length || 0;
  const totalCount = module.content?.length || 0;

  return (
    <>
      <Link href="/portal/training" className="text-text-muted text-sm hover:text-text-secondary transition-colors no-underline inline-flex items-center gap-1 mb-6">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back to Training
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold text-text-primary">{module.title}</h1>
        <p className="text-text-secondary mt-2">{module.description}</p>
        <div className="mt-4 flex items-center gap-4">
          <div className="text-sm text-text-muted">{completedCount}/{totalCount} lessons completed</div>
          <div className="flex-1 max-w-xs bg-[rgba(255,255,255,0.04)] rounded-full h-2">
            <div className="h-2 rounded-full gradient-accent transition-all duration-500" style={{ width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : "0%" }} />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {module.content?.map((content, i) => (
          <div
            key={content.id}
            className={`bg-bg-card border rounded-xl p-5 flex items-center gap-4 transition-all duration-200 ${
              progress[content.id] ? "border-emerald-500/20" : "border-[rgba(255,255,255,0.04)]"
            }`}
          >
            <button
              onClick={() => toggleComplete(content.id)}
              className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                progress[content.id]
                  ? "bg-emerald-500 border-emerald-500"
                  : "border-[rgba(255,255,255,0.15)] hover:border-accent"
              }`}
            >
              {progress[content.id] && (
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>

            <svg className="w-5 h-5 text-text-muted flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={contentTypeIcons[content.content_type] || contentTypeIcons.text} />
            </svg>

            <div className="flex-1 min-w-0">
              <div className={`text-sm font-medium ${progress[content.id] ? "text-text-muted line-through" : "text-text-primary"}`}>
                {content.title}
              </div>
              {content.duration_minutes && (
                <div className="text-xs text-text-muted mt-0.5">{content.duration_minutes} min</div>
              )}
            </div>

            <span className="text-xs text-text-muted uppercase">{content.content_type}</span>
          </div>
        ))}
      </div>
    </>
  );
}
