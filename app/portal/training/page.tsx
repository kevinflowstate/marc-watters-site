"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ModuleCover from "@/components/training/ModuleCover";
import { Empty, Icon } from "@/components/ops/workspace/WorkspaceUI";
import type { ModuleContent, TrainingModule } from "@/lib/types";

function LibrarySkeleton() {
  return (
    <div className="ws-tr-grid" aria-label="Loading training library" role="status">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="ws-tr-card">
          <div className="ws-skel ws-tr-skel-cover" />
          <div className="ws-tr-card-b">
            <span className="ws-skel" style={{ width: 80, height: 10 }} />
            <span className="ws-skel" style={{ width: "70%", height: 14 }} />
            <span className="ws-skel" style={{ width: "100%", height: 10 }} />
            <span className="ws-skel" style={{ width: "60%", height: 10 }} />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading training modules</span>
    </div>
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
    <div className="ws ws-page">
      <div className="ws-ph">
        <div>
          <h1 className="ws-title">Training library</h1>
          <p className="ws-meta mt-1">Practical modules and resources to support the work in your Business Plan.</p>
        </div>
      </div>

      {!loading && !error && modules.length > 0 && (
        <div className={`ws-strip ws-tr-strip ${totals.minutes > 0 ? "is-3" : "is-2"}`}>
          <div className="ws-stat">
            <span className="ws-stat-l"><Icon name="book" size={14} />{modules.length === 1 ? "Module" : "Modules"}</span>
            <span className="ws-stat-n">{modules.length}</span>
          </div>
          <div className="ws-stat">
            <span className="ws-stat-l"><Icon name="lessons" size={14} />Lessons</span>
            <span className="ws-stat-n">{totals.lessons}</span>
          </div>
          {totals.minutes > 0 && (
            <div className="ws-stat">
              <span className="ws-stat-l"><Icon name="clock" size={14} />Minutes</span>
              <span className="ws-stat-n">{totals.minutes}</span>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="ws-note is-bad ws-tr-note" role="alert">
          <Icon name="alert" size={15} />
          <span className="ws-tr-note-t">{error}</span>
          <button type="button" onClick={() => setReloadKey((value) => value + 1)} className="ws-btn ws-btn-sm ws-focus">
            Try again
          </button>
        </div>
      )}

      {loading ? (
        <LibrarySkeleton />
      ) : error ? null : modules.length === 0 ? (
        <div className="ws-panel">
          <Empty
            icon="book"
            title="Your training library is being prepared"
            text="Modules assigned through your Business Plan will appear here when they are ready."
          />
        </div>
      ) : (
        <>
          <div className="ws-tr-toolbar">
            <div className="min-w-0">
              <h2 className="ws-h2 ws-tr-h2">Your modules</h2>
              <p className="ws-caption">Open a module to view its lessons, documents and resources.</p>
            </div>

            {modules.length > 3 && (
              <label className="ws-tr-search">
                <span className="sr-only">Search training modules</span>
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="m21 21-4.35-4.35m1.35-5.65a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
                </svg>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search modules"
                  className="ws-input"
                />
              </label>
            )}
          </div>

          {visibleModules.length === 0 ? (
            <div className="ws-panel">
              <div className="ws-empty">
                <span className="ws-empty-glyph"><Icon name="book" size={20} /></span>
                <p className="ws-empty-h">No matching modules</p>
                <p>{`Nothing in your library matches “${query.trim()}”.`}</p>
                <button type="button" onClick={() => setQuery("")} className="ws-btn ws-focus mt-3">
                  Clear search
                </button>
              </div>
            </div>
          ) : (
            <div className="ws-tr-grid">
              {visibleModules.map(({ module, index, lessons, totalDuration }) => {
                return (
                  <Link
                    key={module.id}
                    href={`/portal/training/${module.id}`}
                    className="ws-tr-card is-link ws-focus"
                  >
                    <ModuleCover title={module.title} imageUrl={module.thumbnail_url} number={index + 1} />

                    <div className="ws-tr-card-b">
                      <div className="ws-tr-card-top">
                        <span>{lessons.length} {lessons.length === 1 ? "lesson" : "lessons"}</span>
                      </div>

                      <h3 className="ws-tr-card-t">{module.title}</h3>
                      <p className="ws-tr-card-d">
                        {module.description || "Open this module to view the available lessons and resources."}
                      </p>

                      <div className="ws-tr-card-f">
                        <span className="ws-caption">
                          {totalDuration > 0 ? `${totalDuration} min total` : "Resources included"}
                        </span>
                        <span className="ws-tr-go">
                          Open module
                          <Icon name="chevron" size={14} />
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
    </div>
  );
}
