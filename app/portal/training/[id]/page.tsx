"use client";
import {isNativeLessonVideo,nativeLessonVideoUrl} from "@/lib/lesson-video";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import BusinessHealthChecklistCard from "@/components/portal/BusinessHealthChecklistCard";
import ModuleCover from "@/components/training/ModuleCover";
import { Empty, Icon, SkeletonRows } from "@/components/ops/workspace/WorkspaceUI";
import { lessonIdFromTrainingHash, trainingLessonAnchorId } from "@/lib/portal-training-links";
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
    <div className="ws ws-page" aria-label="Loading training module" role="status">
      <span className="ws-skel" style={{ width: 140, height: 12 }} />
      <div className="ws-tr-head">
        <div className="ws-tr-head-b">
          <span className="ws-skel" style={{ width: 96, height: 10 }} />
          <span className="ws-skel" style={{ width: "70%", height: 22 }} />
          <span className="ws-skel" style={{ width: "100%", height: 12 }} />
          <span className="ws-skel" style={{ width: "60%", height: 12 }} />
        </div>
        <div className="ws-skel ws-tr-skel-banner" />
      </div>
      <div className="ws-panel">
        <SkeletonRows count={4} />
      </div>
      <span className="sr-only">Loading training module</span>
    </div>
  );
}

export default function ModuleView() {
  const { id } = useParams<{ id: string }>();
  const [module, setModule] = useState<TrainingModule | null>(null);
  const [expandedLesson, setExpandedLesson] = useState<string | null>(null);
  const [linkedLessonToScroll, setLinkedLessonToScroll] = useState<string | null>(null);
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

  useEffect(() => {
    if (!module) return;

    function openLinkedLesson() {
      const linkedLessonId = lessonIdFromTrainingHash(window.location.hash);
      const isLessonInModule = module?.content?.some((lesson) => lesson.id === linkedLessonId);
      if (!linkedLessonId || !isLessonInModule) return;

      setExpandedLesson(linkedLessonId);
      setLinkedLessonToScroll(linkedLessonId);
    }

    openLinkedLesson();
    window.addEventListener("hashchange", openLinkedLesson);
    return () => window.removeEventListener("hashchange", openLinkedLesson);
  }, [module]);

  useEffect(() => {
    if (!linkedLessonToScroll || expandedLesson !== linkedLessonToScroll) return;

    const frame = window.requestAnimationFrame(() => {
      document.getElementById(trainingLessonAnchorId(linkedLessonToScroll))?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
      setLinkedLessonToScroll(null);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [expandedLesson, linkedLessonToScroll]);

  if (loading) return <ModuleSkeleton />;

  if (error) {
    return (
      <div className="ws ws-page">
        <Link href="/portal/training" className="ws-back ws-focus">
          <Icon name="chevron" size={14} className="ws-back-ic" />
          Back to Training
        </Link>
        <div className="ws-note is-bad ws-tr-note" role="alert">
          <Icon name="alert" size={15} />
          <span className="ws-tr-note-t">{error}</span>
          <button type="button" onClick={() => setReloadKey((value) => value + 1)} className="ws-btn ws-btn-sm ws-focus">
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!module) {
    return (
      <div className="ws ws-page">
        <div className="ws-panel">
          <div className="ws-empty">
            <span className="ws-empty-glyph"><Icon name="book" size={20} /></span>
            <p className="ws-empty-h">Module unavailable</p>
            <p>This module may no longer be assigned to you, or it may not be available yet.</p>
            <Link href="/portal/training" className="ws-btn ws-focus mt-3">
              Return to Training
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const lessons = module.content || [];
  const totalDuration = lessons.reduce((sum, lesson) => sum + (lesson.duration_minutes || 0), 0);
  const isOnboardingModule = module.title === "Welcome & Onboarding";

  return (
    <div className="ws ws-page">
      <Link href="/portal/training" className="ws-back ws-focus">
        <Icon name="chevron" size={14} className="ws-back-ic" />
        Back to Training
      </Link>

      <header className="ws-tr-head">
        <div className="ws-tr-head-b">
          <span className="ws-caption">Training module</span>
          <h1 className="ws-title">{module.title}</h1>
          <p className="ws-meta">
            {module.description || "Work through the lessons and supporting resources in this module."}
          </p>

          <div className="ws-tr-mmeta">
            <span>
              <Icon name="lessons" size={14} />
              {lessons.length} {lessons.length === 1 ? "lesson" : "lessons"}
            </span>
            {totalDuration > 0 && (
              <span>
                <Icon name="clock" size={14} />
                {totalDuration} min total
              </span>
            )}
          </div>
        </div>

        <ModuleCover title={module.title} variant="banner" imageUrl={module.thumbnail_url} />
      </header>

      <section className="ws-panel" aria-labelledby="module-lessons-title">
        <div className="ws-panel-head">
          <h2 id="module-lessons-title" className="ws-h2">Lessons and resources</h2>
          {lessons.length > 0 && (
            <span className="ws-caption">Select a lesson to open it</span>
          )}
        </div>

        {lessons.length === 0 ? (
          <Empty
            icon="book"
            title="Lessons are being prepared"
            text="Content for this module will appear here when it is ready."
          />
        ) : (
          <div>
            {lessons.map((lesson, index) => {
              const contentType = contentTypeLabels[lesson.content_type];
              const isExpanded = expandedLesson === lesson.id;
              const panelId = `lesson-panel-${lesson.id}`;

              return (
                <article
                  key={lesson.id}
                  id={trainingLessonAnchorId(lesson.id)}
                  className={`ws-tr-lesson${isExpanded ? " is-open" : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedLesson(isExpanded ? null : lesson.id)}
                    aria-expanded={isExpanded}
                    aria-controls={panelId}
                    className="ws-tr-lesson-h ws-focus"
                  >
                    <span className="ws-tr-lesson-n">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className={`ws-tr-lesson-ic is-${lesson.content_type}`}>
                      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d={contentType.icon} />
                      </svg>
                    </span>

                    <span className="min-w-0">
                      <span className="ws-tr-lesson-t">{lesson.title}</span>
                      <span className="ws-tr-lesson-s">
                        <span>{contentType.label}</span>
                        {lesson.duration_minutes ? <span>{lesson.duration_minutes} min</span> : null}
                        {lesson.attachments?.length ? (
                          <span>{lesson.attachments.length} {lesson.attachments.length === 1 ? "attachment" : "attachments"}</span>
                        ) : null}
                      </span>
                    </span>

                    <Icon name="chevron" size={14} className={`ws-chev${isExpanded ? " is-open" : ""}`} />
                  </button>

                  {isExpanded && (
                    <div id={panelId} className="ws-tr-lesson-body">
                      {lesson.content_type === "video" && lesson.content_url && (
                        <div className="ws-tr-video">
                          {isNativeLessonVideo(lesson.content_url) ? <video controls preload="metadata" src={nativeLessonVideoUrl(lesson.content_url)} className="absolute inset-0 w-full h-full" aria-label={lesson.title} /> : (<iframe
                            src={getVideoEmbedUrl(lesson.content_url)}
                            className="absolute inset-0 h-full w-full"
                            allow="encrypted-media *; fullscreen *"
                            allowFullScreen
                            scrolling="no"
                            title={lesson.title}
                          />)}
                        </div>
                      )}

                      {lesson.content_type === "pdf" && lesson.content_url && (
                        <div>
                          <a href={lesson.content_url} target="_blank" rel="noopener noreferrer" className="ws-btn ws-focus">
                            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v1a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1m-4-4-4 4m0 0-4-4m4 4V4" />
                            </svg>
                            Open document
                          </a>
                        </div>
                      )}

                      {lesson.content_text && (
                        <div className="ws-prose ws-tr-text">{lesson.content_text}</div>
                      )}

                      {lesson.attachments && lesson.attachments.length > 0 && (
                        <div>
                          <h3 className="ws-field-l">Attachments</h3>
                          <div className="ws-tr-files">
                            {lesson.attachments.map((attachment) => (
                              <a
                                key={attachment.id}
                                href={attachment.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ws-tr-file is-link ws-focus"
                              >
                                <span className="ws-tr-file-ic">
                                  <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="m15.172 7-6.586 6.586a2 2 0 1 0 2.828 2.828l6.414-6.586a4 4 0 0 0-5.656-5.656l-6.415 6.585a6 6 0 1 0 8.486 8.486L20.5 13" />
                                  </svg>
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="ws-tr-file-n">{attachment.name}</span>
                                  {attachment.size && <span className="ws-tr-file-m">{attachment.size}</span>}
                                </span>
                                <span className="ws-tr-file-act">Open</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {isOnboardingModule && <BusinessHealthChecklistCard isUnlocked />}
    </div>
  );
}
