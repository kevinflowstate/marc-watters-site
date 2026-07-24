"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import BusinessHealthChecklistCard from "@/components/portal/BusinessHealthChecklistCard";
import ModuleCover from "@/components/training/ModuleCover";
import { EmptyState, InlineNotice } from "@/components/ui/PortalState";
import type { ContentType, ModuleContent, TrainingModule } from "@/lib/types";

function getVideoEmbedUrl(url: string) {
  const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (youtubeMatch) {
    return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
  }

  const vimeoMatch = url.match(/(?:player\.)?vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeoMatch) {
    const hashMatch = url.match(/[?&]h=([a-zA-Z0-9]+)/);
    const hash = hashMatch ? `?h=${hashMatch[1]}&` : "?";
    return `https://player.vimeo.com/video/${vimeoMatch[1]}${hash}color=2272DE&title=0&byline=0&portrait=0`;
  }

  const fathomShareMatch = url.match(/fathom\.video\/share\/([a-zA-Z0-9_-]+)/);
  if (fathomShareMatch) {
    return `https://fathom.video/embed/${fathomShareMatch[1]}`;
  }

  const fathomEmbedMatch = url.match(/fathom\.video\/embed\/([a-zA-Z0-9_-]+)/);
  if (fathomEmbedMatch) {
    return `https://fathom.video/embed/${fathomEmbedMatch[1]}`;
  }

  return url;
}

const contentTypeLabels: Record<ContentType, { label: string; icon: string; tone: string }> = {
  video: {
    label: "Video",
    icon: "M14.752 11.168l-3.197-2.132A1 1 0 0 0 10 9.87v4.263a1 1 0 0 0 1.555.832l3.197-2.132a1 1 0 0 0 0-1.664Z M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
    tone: "border-accent/20 bg-accent/10 text-accent-bright",
  },
  pdf: {
    label: "Document",
    icon: "M7 21h10a2 2 0 0 0 2-2V9.414a1 1 0 0 0-.293-.707l-5.414-5.414A1 1 0 0 0 12.586 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2Z",
    tone: "border-red-500/20 bg-red-500/10 text-red-300",
  },
  text: {
    label: "Article",
    icon: "M4 6h16M4 12h16M4 18h7",
    tone: "border-white/[0.08] bg-white/[0.035] text-text-secondary",
  },
  checklist: {
    label: "Checklist",
    icon: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9 2 2 4-4",
    tone: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  },
};

function ModuleSkeleton() {
  return (
    <div className="space-y-6" aria-label="Loading training module" role="status">
      <div className="skeleton h-4 w-36 rounded" />
      <div className="v2-surface overflow-hidden">
        <div className="grid md:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4 p-6 sm:p-8">
            <div className="skeleton h-3 w-24 rounded" />
            <div className="skeleton h-8 w-3/4 rounded" />
            <div className="skeleton h-4 w-full rounded" />
            <div className="skeleton h-4 w-2/3 rounded" />
          </div>
          <div className="skeleton h-44 md:h-full" />
        </div>
      </div>
      <div className="v2-surface overflow-hidden">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 border-b border-white/[0.06] p-5 last:border-0">
            <div className="skeleton h-10 w-10 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="skeleton h-4 w-1/2 rounded" />
              <div className="skeleton h-3 w-24 rounded" />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">Loading training module</span>
    </div>
  );
}

function BookIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );
}

export default function ModuleView() {
  const { id } = useParams<{ id: string }>();
  const [module, setModule] = useState<TrainingModule | null>(null);
  const [expandedLesson, setExpandedLesson] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`/api/portal/training/${id}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          if (response.status === 404 || response.status === 403) {
            setModule(null);
            return;
          }
          throw new Error("Training module could not be loaded.");
        }

        const data = await response.json();
        const loadedModule = data.module as TrainingModule | undefined;
        if (!loadedModule) {
          setModule(null);
          return;
        }

        const sortedContent = [...(loadedModule.content || [])].sort(
          (first: ModuleContent, second: ModuleContent) => first.order_index - second.order_index,
        );
        setModule({ ...loadedModule, content: sortedContent });
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError") {
          setError("We couldn’t load this training module. Please try again.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [id, reloadKey]);

  if (loading) return <ModuleSkeleton />;

  if (error) {
    return (
      <div className="space-y-5">
        <Link href="/portal/training" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-text-secondary no-underline transition-colors hover:text-text-primary">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="m15 19-7-7 7-7" />
          </svg>
          Back to Training
        </Link>
        <InlineNotice
          tone="error"
          action={
            <button type="button" onClick={() => setReloadKey((value) => value + 1)} className="text-xs font-bold text-red-100 underline underline-offset-4">
              Try again
            </button>
          }
        >
          {error}
        </InlineNotice>
      </div>
    );
  }

  if (!module) {
    return (
      <div className="v2-surface">
        <EmptyState
          icon={<BookIcon />}
          title="Module unavailable"
          description="This module may no longer be assigned to you, or it may not be available yet."
          action={
            <Link href="/portal/training" className="v2-button-secondary">
              Return to Training
            </Link>
          }
        />
      </div>
    );
  }

  const lessons = module.content || [];
  const totalDuration = lessons.reduce((sum, lesson) => sum + (lesson.duration_minutes || 0), 0);
  const isOnboardingModule = module.title === "Welcome & Onboarding";

  return (
    <>
      <Link href="/portal/training" className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-text-secondary no-underline transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright/70">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="m15 19-7-7 7-7" />
        </svg>
        Back to Training
      </Link>

      <header className="v2-surface-strong mb-7 overflow-hidden">
        <div className="grid md:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col justify-center p-6 sm:p-8">
            <div className="v2-eyebrow">Training module</div>
            <h1 className="mt-3 font-heading text-2xl font-bold leading-tight tracking-[-0.03em] text-text-primary sm:text-3xl">
              {module.title}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-secondary">
              {module.description || "Work through the lessons and supporting resources in this module."}
            </p>

            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-text-muted">
              <span className="inline-flex items-center gap-2">
                <svg className="h-4 w-4 text-accent-bright" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M14.752 11.168 11.555 9.036A1 1 0 0 0 10 9.87v4.263a1 1 0 0 0 1.555.832l3.197-2.132a1 1 0 0 0 0-1.664Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                {lessons.length} {lessons.length === 1 ? "lesson" : "lessons"}
              </span>
              {totalDuration > 0 && (
                <span className="inline-flex items-center gap-2">
                  <svg className="h-4 w-4 text-accent-bright" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  {totalDuration} min total
                </span>
              )}
            </div>
          </div>

          <div className="order-first border-b border-white/[0.07] md:order-none md:border-b-0 md:border-l">
            <ModuleCover title={module.title} variant="banner" imageUrl={module.thumbnail_url} />
          </div>
        </div>
      </header>

      <section aria-labelledby="module-lessons-title">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <div className="v2-eyebrow">Module content</div>
            <h2 id="module-lessons-title" className="mt-2 v2-section-title">Lessons and resources</h2>
          </div>
          {lessons.length > 0 && (
            <span className="text-xs text-text-muted">Select a lesson to open it</span>
          )}
        </div>

        {lessons.length === 0 ? (
          <div className="v2-surface">
            <EmptyState
              compact
              icon={<BookIcon />}
              title="Lessons are being prepared"
              description="Content for this module will appear here when it is ready."
            />
          </div>
        ) : (
          <div className="v2-surface overflow-hidden">
            {lessons.map((lesson, index) => {
              const contentType = contentTypeLabels[lesson.content_type];
              const isExpanded = expandedLesson === lesson.id;
              const panelId = `lesson-${lesson.id}`;

              return (
                <article key={lesson.id} className="border-b border-white/[0.06] last:border-0">
                  <button
                    type="button"
                    onClick={() => setExpandedLesson(isExpanded ? null : lesson.id)}
                    aria-expanded={isExpanded}
                    aria-controls={panelId}
                    className="group flex min-h-[76px] w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-white/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-bright/70 sm:gap-4 sm:px-5"
                  >
                    <span className="w-6 shrink-0 text-center font-mono text-xs tabular-nums text-text-muted">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${contentType.tone}`}>
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d={contentType.icon} />
                      </svg>
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold leading-snug text-text-primary">{lesson.title}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
                        <span>{contentType.label}</span>
                        {lesson.duration_minutes ? <span>{lesson.duration_minutes} min</span> : null}
                        {lesson.attachments?.length ? (
                          <span>{lesson.attachments.length} {lesson.attachments.length === 1 ? "attachment" : "attachments"}</span>
                        ) : null}
                      </span>
                    </span>

                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.025] text-text-muted transition-colors group-hover:border-accent/25 group-hover:text-text-primary">
                      <svg className={`h-4 w-4 transition-transform duration-200 motion-reduce:transition-none ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="m19 9-7 7-7-7" />
                      </svg>
                    </span>
                  </button>

                  {isExpanded && (
                    <div id={panelId} className="border-t border-white/[0.06] bg-black/10 px-4 py-5 sm:px-5 sm:py-6">
                      <div className="ml-0 space-y-4 sm:ml-[4.5rem]">
                        {lesson.content_type === "video" && lesson.content_url && (
                          <div className="overflow-hidden rounded-[var(--cbb-radius-md)] border border-white/[0.08] bg-black shadow-[0_18px_45px_rgba(0,0,0,0.28)]">
                            <div className="relative aspect-video w-full">
                              <iframe
                                src={getVideoEmbedUrl(lesson.content_url)}
                                className="absolute inset-0 h-full w-full"
                                allow="encrypted-media *; fullscreen *"
                                allowFullScreen
                                scrolling="no"
                                title={lesson.title}
                              />
                            </div>
                          </div>
                        )}

                        {lesson.content_type === "pdf" && lesson.content_url && (
                          <a href={lesson.content_url} target="_blank" rel="noopener noreferrer" className="v2-button-secondary">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v1a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1m-4-4-4 4m0 0-4-4m4 4V4" />
                            </svg>
                            Open document
                          </a>
                        )}

                        {lesson.content_text && (
                          <div className="rounded-[var(--cbb-radius-md)] border border-white/[0.07] bg-white/[0.025] p-4 sm:p-5">
                            <div className="whitespace-pre-line text-sm leading-7 text-text-secondary">{lesson.content_text}</div>
                          </div>
                        )}

                        {lesson.attachments && lesson.attachments.length > 0 && (
                          <div>
                            <h3 className="mb-2 text-xs font-bold text-text-secondary">Attachments</h3>
                            <div className="divide-y divide-white/[0.06] overflow-hidden rounded-[var(--cbb-radius-md)] border border-white/[0.07]">
                              {lesson.attachments.map((attachment) => (
                                <a
                                  key={attachment.id}
                                  href={attachment.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex min-h-14 items-center gap-3 bg-white/[0.02] px-4 py-3 no-underline transition-colors hover:bg-white/[0.045]"
                                >
                                  <svg className="h-4 w-4 shrink-0 text-accent-bright" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="m15.172 7-6.586 6.586a2 2 0 1 0 2.828 2.828l6.414-6.586a4 4 0 0 0-5.656-5.656l-6.415 6.585a6 6 0 1 0 8.486 8.486L20.5 13" />
                                  </svg>
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium text-text-primary">{attachment.name}</span>
                                    {attachment.size && <span className="mt-0.5 block text-xs text-text-muted">{attachment.size}</span>}
                                  </span>
                                  <span className="text-xs font-semibold text-text-secondary">Open</span>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {isOnboardingModule && <BusinessHealthChecklistCard isUnlocked />}
    </>
  );
}
