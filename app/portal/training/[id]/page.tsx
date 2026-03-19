"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { TrainingModule, ModuleContent, ContentType } from "@/lib/types";
import ModuleCover from "@/components/training/ModuleCover";

function getVideoEmbed(url: string): { type: string; embedUrl: string } {
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (ytMatch) return { type: "youtube", embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}` };

  const vimeoMatch = url.match(/(?:player\.)?vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeoMatch) {
    const hMatch = url.match(/[?&]h=([a-zA-Z0-9]+)/);
    const h = hMatch ? `?h=${hMatch[1]}&` : "?";
    return { type: "vimeo", embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}${h}color=2272DE&title=0&byline=0&portrait=0` };
  }

  return { type: "unknown", embedUrl: url };
}

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

export default function ModuleView() {
  const { id } = useParams();
  const [module, setModule] = useState<TrainingModule | null>(null);
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  const [profileId, setProfileId] = useState<string | null>(null);
  const [expandedLesson, setExpandedLesson] = useState<string | null>(null);
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
    setProgress((prev) => ({ ...prev, [contentId]: !isCompleted }));
    await fetch(`/api/portal/training/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentId, completed: !isCompleted, profileId }),
    });
  }

  if (loading) return (
    <div className="space-y-4">
      <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-4 w-32 mb-6" />
      <div className="bg-bg-card/80 border border-[rgba(255,255,255,0.04)] rounded-2xl overflow-hidden">
        <div className="h-32 animate-pulse bg-[rgba(255,255,255,0.04)]" />
        <div className="p-6 space-y-3">
          <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-6 w-2/3" />
          <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-4 w-full" />
          <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-3 w-1/3" />
        </div>
      </div>
      <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-5 w-20 mt-4" />
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-bg-card/80 border border-[rgba(255,255,255,0.04)] rounded-2xl p-4 flex items-center gap-4">
          <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-md w-6 h-6" />
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
  if (!module) return <div className="text-text-muted">Module not found.</div>;

  const lessons = module.content || [];
  const totalDuration = lessons.reduce((sum, c) => sum + (c.duration_minutes || 0), 0);
  const completedCount = lessons.filter((c) => progress[c.id]).length;

  return (
    <>
      <Link href="/portal/training" className="text-text-muted text-sm hover:text-text-secondary transition-colors no-underline inline-flex items-center gap-1 mb-6">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back to Training
      </Link>

      {/* Module header */}
      <div className="bg-bg-card/80 backdrop-blur-sm border border-[rgba(255,255,255,0.04)] rounded-2xl overflow-hidden mb-6">
        <ModuleCover title={module.title} variant="banner" />
        <div className="p-6">
          <h1 className="text-2xl font-heading font-bold text-text-primary mb-2">{module.title}</h1>
          <p className="text-sm text-text-secondary leading-relaxed mb-4">{module.description}</p>
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {completedCount}/{lessons.length} completed
            </div>
          </div>
        </div>
      </div>

      {/* Lessons list */}
      <h2 className="text-lg font-heading font-bold text-text-primary mb-4">Lessons</h2>
      <div className="space-y-2">
        {lessons.map((lesson, i) => {
          const ct = contentTypeLabels[lesson.content_type];
          const isExpanded = expandedLesson === lesson.id;
          const isCompleted = progress[lesson.id];

          return (
            <div key={lesson.id} className="group/lesson relative bg-bg-card/80 backdrop-blur-sm border border-[rgba(255,255,255,0.04)] rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:border-[rgba(34,114,222,0.15)] hover:shadow-[0_10px_30px_rgba(0,0,0,0.2),0_0_30px_rgba(34,114,222,0.04)] will-change-transform">
                {/* Bento dot pattern */}
                <div className="absolute inset-0 opacity-0 group-hover/lesson:opacity-100 transition-opacity duration-300 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[length:4px_4px] z-10 pointer-events-none" />
                {/* Bento gradient border */}
                <div className="absolute inset-0 -z-10 rounded-2xl p-px bg-gradient-to-br from-transparent via-white/10 to-transparent opacity-0 group-hover/lesson:opacity-100 transition-opacity duration-300 pointer-events-none" />
              {/* Lesson row */}
              <button
                onClick={() => setExpandedLesson(isExpanded ? null : lesson.id)}
                className="w-full flex items-center gap-4 p-4 text-left hover:bg-[rgba(255,255,255,0.02)] transition-colors cursor-pointer"
              >
                {/* Completion checkbox */}
                <button
                  onClick={(e) => { e.stopPropagation(); toggleComplete(lesson.id); }}
                  className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all cursor-pointer ${
                    isCompleted ? "bg-emerald-500 border-emerald-500" : "border-[rgba(255,255,255,0.15)] hover:border-accent"
                  }`}
                >
                  {isCompleted && (
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>

                <div className="text-text-muted text-sm font-mono w-6 text-center flex-shrink-0">{i + 1}</div>

                <div className={`w-8 h-8 rounded-lg ${ct.color} flex items-center justify-center flex-shrink-0`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={ct.icon} />
                  </svg>
                </div>

                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${isCompleted ? "text-text-muted line-through" : "text-text-primary"}`}>{lesson.title}</div>
                  <div className="flex items-center gap-3 text-xs text-text-muted mt-0.5">
                    <span>{ct.label}</span>
                    {lesson.duration_minutes && <span>{lesson.duration_minutes} min</span>}
                  </div>
                </div>

                <svg className={`w-4 h-4 text-text-muted transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="border-t border-[rgba(255,255,255,0.04)] p-5 space-y-4">
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

                  {/* PDF / Document link */}
                  {lesson.content_type === "pdf" && lesson.content_url && (
                    <a href={lesson.content_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-3 bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl text-sm text-accent-bright no-underline hover:border-accent/30 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Open Document
                    </a>
                  )}

                  {/* Text / Article content */}
                  {lesson.content_text && (
                    <div className="bg-bg-primary border border-[rgba(255,255,255,0.04)] rounded-xl p-4">
                      <div className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">{lesson.content_text}</div>
                    </div>
                  )}

                  {/* Attachments */}
                  {lesson.attachments && lesson.attachments.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                        Attachments ({lesson.attachments.length})
                      </div>
                      <div className="space-y-2">
                        {lesson.attachments.map((att) => (
                          <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 bg-bg-primary border border-[rgba(255,255,255,0.04)] rounded-xl px-4 py-3 no-underline hover:border-[rgba(255,255,255,0.08)] transition-colors">
                            <svg className="w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-text-primary truncate">{att.name}</div>
                              {att.size && <div className="text-[10px] text-text-muted">{att.size}</div>}
                            </div>
                            <svg className="w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
