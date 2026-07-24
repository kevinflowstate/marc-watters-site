"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ModuleCover from "@/components/training/ModuleCover";
import { EmptyState, InlineNotice } from "@/components/ui/PortalState";
import type { ModuleContent, TrainingModule } from "@/lib/types";

function LibrarySkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Loading training library" role="status">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="v2-surface overflow-hidden">
          <div className="skeleton h-36" />
          <div className="space-y-3 p-5">
            <div className="skeleton h-3 w-20 rounded" />
            <div className="skeleton h-5 w-3/4 rounded" />
            <div className="skeleton h-3 w-full rounded" />
            <div className="skeleton h-3 w-2/3 rounded" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading training modules</span>
    </div>
  );
}

function TrainingIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );
}

export default function TrainingLibrary() {
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/portal/training", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Training could not be loaded.");
        }

        const data = await response.json();
        setModules(Array.isArray(data.modules) ? data.modules : []);
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError") {
          setError("We couldn’t load your training library. Please try again.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [reloadKey]);

  const moduleViews = useMemo(() => {
    return modules.map((module, index) => {
      const lessons = Array.isArray(module.content) ? module.content : [];
      const totalDuration = lessons.reduce(
        (sum: number, content: ModuleContent) => sum + (content.duration_minutes || 0),
        0,
      );

      return {
        module,
        index,
        lessons,
        totalDuration,
        searchText: `${module.title} ${module.description || ""}`.toLowerCase(),
      };
    });
  }, [modules]);

  const totals = useMemo(() => {
    return moduleViews.reduce(
      (summary, module) => {
        summary.lessons += module.lessons.length;
        summary.minutes += module.totalDuration;
        return summary;
      },
      { lessons: 0, minutes: 0 },
    );
  }, [moduleViews]);

  const visibleModules = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return moduleViews;

    return moduleViews.filter((module) => module.searchText.includes(normalizedQuery));
  }, [moduleViews, query]);

  return (
    <>
      <header className="mb-7 sm:mb-9">
        <div className="v2-eyebrow mb-3">Learning and resources</div>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="v2-page-title">Training Library</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
              Practical modules and resources to support the work in your Business Plan.
            </p>
          </div>

          {!loading && !error && modules.length > 0 && (
            <div className="flex items-center gap-5 rounded-[var(--cbb-radius-md)] border border-white/[0.07] bg-white/[0.025] px-4 py-3">
              <div>
                <div className="font-heading text-lg font-bold tabular-nums text-text-primary">{modules.length}</div>
                <div className="text-xs text-text-muted">{modules.length === 1 ? "Module" : "Modules"}</div>
              </div>
              <div className="h-8 w-px bg-white/[0.08]" aria-hidden />
              <div>
                <div className="font-heading text-lg font-bold tabular-nums text-text-primary">{totals.lessons}</div>
                <div className="text-xs text-text-muted">Lessons</div>
              </div>
              {totals.minutes > 0 && (
                <>
                  <div className="h-8 w-px bg-white/[0.08]" aria-hidden />
                  <div>
                    <div className="font-heading text-lg font-bold tabular-nums text-text-primary">{totals.minutes}</div>
                    <div className="text-xs text-text-muted">Minutes</div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {error && (
        <InlineNotice
          tone="error"
          className="mb-5"
          action={
            <button type="button" onClick={() => setReloadKey((value) => value + 1)} className="text-xs font-bold text-red-100 underline underline-offset-4">
              Try again
            </button>
          }
        >
          {error}
        </InlineNotice>
      )}

      {loading ? (
        <LibrarySkeleton />
      ) : error ? null : modules.length === 0 ? (
        <div className="v2-surface">
          <EmptyState
            icon={<TrainingIcon />}
            title="Your training library is being prepared"
            description="Modules assigned through your Business Plan will appear here when they are ready."
          />
        </div>
      ) : (
        <>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="v2-section-title">Your modules</h2>
              <p className="mt-1 text-xs text-text-muted">
                Open a module to view its lessons, documents and resources.
              </p>
            </div>

            {modules.length > 3 && (
              <label className="relative block w-full sm:w-72">
                <span className="sr-only">Search training modules</span>
                <svg className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="m21 21-4.35-4.35m1.35-5.65a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
                </svg>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search modules"
                  className="min-h-11 w-full rounded-[var(--cbb-radius-sm)] border border-white/[0.09] bg-white/[0.035] py-2.5 pl-10 pr-4 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent/45 focus:ring-2 focus:ring-accent/15"
                />
              </label>
            )}
          </div>

          {visibleModules.length === 0 ? (
            <div className="v2-surface">
              <EmptyState
                compact
                title="No matching modules"
                description={`Nothing in your library matches “${query.trim()}”.`}
                action={
                  <button type="button" onClick={() => setQuery("")} className="v2-button-secondary">
                    Clear search
                  </button>
                }
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleModules.map(({ module, index, lessons, totalDuration }) => {
                return (
                  <Link
                    key={module.id}
                    href={`/portal/training/${module.id}`}
                    className="group flex min-h-full flex-col overflow-hidden rounded-[var(--cbb-radius-lg)] border border-white/[0.075] bg-[var(--cbb-surface-1)] no-underline shadow-[0_1px_0_rgba(255,255,255,0.025)_inset] transition-[border-color,background-color,box-shadow] duration-200 hover:border-accent/30 hover:bg-[var(--cbb-surface-2)] hover:shadow-[0_18px_45px_rgba(0,0,0,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright/70 motion-reduce:transition-none"
                  >
                    <ModuleCover title={module.title} imageUrl={module.thumbnail_url} />

                    <div className="flex flex-1 flex-col p-5">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold text-accent-bright">
                          Module {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="rounded-full border border-white/[0.08] bg-white/[0.035] px-2.5 py-1 text-xs text-text-secondary">
                          {lessons.length} {lessons.length === 1 ? "lesson" : "lessons"}
                        </span>
                      </div>

                      <h3 className="font-heading text-[1.05rem] font-bold leading-snug text-text-primary transition-colors group-hover:text-accent-bright">
                        {module.title}
                      </h3>
                      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-text-secondary">
                        {module.description || "Open this module to view the available lessons and resources."}
                      </p>

                      <div className="mt-auto flex items-center justify-between gap-4 border-t border-white/[0.06] pt-4">
                        <span className="text-xs text-text-muted">
                          {totalDuration > 0 ? `${totalDuration} min total` : "Resources included"}
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-text-primary">
                          Open module
                          <svg className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="m9 5 7 7-7 7" />
                          </svg>
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </>
  );
}
