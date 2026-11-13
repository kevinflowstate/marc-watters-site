"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { londonToUtc } from "@/lib/content/slots";
import type { Platform, Video } from "@/lib/content/types";
import {
  editReview,
  newReview,
  reviewIssue,
  scheduleReviews,
  type Review,
} from "@/lib/content/review";
import ContentReviewRow, { when } from "./ContentReviewRow";

type Data = {
  videos: Video[];
  configured: boolean;
  enabled: boolean;
  checked_at?: string;
  warnings: string[];
  connectionWarnings: string[];
};
type MapFile = {
  name: string;
  path: string[];
  mimeType: string;
  createdTime?: string;
  modifiedTime?: string;
};
function group(v: Video) {
  return v.status === "skipped" ||
    (v.status === "scheduled" && Date.parse(v.schedule_at!) < Date.now())
    ? "Done"
    : v.status === "scheduled"
      ? "Scheduled"
      : "To review";
}
async function request(url: string, method = "GET", body?: object) {
  const r = await fetch(url, {
    method,
    ...(body
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const value = await r.json();
  if (!r.ok) throw new Error(value.error || "Could not complete the request");
  return value;
}
export default function ContentPage({ sample }: { sample?: Video[] }) {
  const [data, setData] = useState<Data | null>(
    sample
      ? {
          videos: sample,
          configured: false,
          enabled: false,
          warnings: [],
          connectionWarnings: [],
        }
      : null,
  );
  const [reviews, setReviews] = useState<Record<string, Review>>({});
  const [expanded, setExpanded] = useState<string | null>(
    sample?.[0]?.id ?? null,
  );
  const [filter, setFilter] = useState("To review"),
    [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState("");
  const [folderMap, setFolderMap] = useState<MapFile[] | null>(null),
    [mapOpen, setMapOpen] = useState(false);
  const busyRef = useRef(false);
  const refresh = useCallback(async () => {
    if (!sample) {
      const result: Data = await request("/api/admin/content");
      setData(result);
      setReviews((current) =>
        Object.fromEntries(
          Object.entries(current).filter(([id, review]) =>
            result.videos.some(
              (v) => v.id === id && v.updated_at === review.revision,
            ),
          ),
        ),
      );
    }
  }, [sample]);
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
    const id = new URL(location.href).searchParams.get("video");
    if (id) setExpanded(id);
  }, [refresh]);
  async function run(action: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not complete the request",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
      setProgress("");
    }
  }
  function replaceVideo(video: Video) {
    setData((current) =>
      current
        ? {
            ...current,
            videos: current.videos.map((v) => (v.id === video.id ? video : v)),
          }
        : current,
    );
    setReviews((current) => ({ ...current, [video.id]: newReview(video) }));
  }
  async function save(video: Video, review: Review): Promise<Video> {
    if (sample) throw new Error("Preview only. Changes cannot be saved.");
    if (!review.date || !review.platforms.length)
      throw new Error("Choose a date and at least one platform.");
    return request(`/api/admin/content/${video.id}`, "PATCH", {
      action: "save",
      revision: review.revision,
      caption: review.caption,
      suggested_at: londonToUtc(review.date),
      platforms: review.platforms,
    });
  }
  const approvedItems = (data?.videos ?? []).flatMap((video) => {
    const review = reviews[video.id];
    return review?.approved && !reviewIssue(video, review)
      ? [{ video, review }]
      : [];
  });
  async function scheduleApproved() {
    const items = approvedItems;
    let completed = 0;
    setRowErrors({});
    setProgress(`Scheduling 1 of ${items.length}…`);
    const results = await scheduleReviews(items, {
      enabled: !!data?.enabled,
      sample: !!sample,
      save,
      schedule: (video) =>
        request(`/api/admin/content/${video.id}/approve`, "POST", {
          revision: video.updated_at,
        }),
      onResult: (result) => {
        completed++;
        if (result.video) replaceVideo(result.video);
        else {
          setReviews((current) =>
            current[result.id]
              ? {
                  ...current,
                  [result.id]: { ...current[result.id], approved: false },
                }
              : current,
          );
          setRowErrors((current) => ({
            ...current,
            [result.id]: result.error || "Check the CRM receipts.",
          }));
        }
        setProgress(
          `Scheduling ${Math.min(completed + 1, items.length)} of ${items.length}…`,
        );
      },
    });
    const scheduled = results.filter(
      (r) => r.video?.status === "scheduled",
    ).length;
    const attention = results.length - scheduled;
    setNotice(
      `${scheduled} ${scheduled === 1 ? "video" : "videos"} scheduled.${attention ? ` ${attention} ${attention === 1 ? "video needs" : "videos need"} attention. Check the row results before trying again.` : " All selected platforms verified."}`,
    );
    await refresh();
  }
  async function rowAction(
    video: Video,
    action: "save" | "skip" | "reconcile" | "retry",
    retry?: Platform,
  ) {
    if (sample) return;
    const result: Video =
      action === "save"
        ? await save(video, reviews[video.id] ?? newReview(video))
        : action === "retry"
          ? await request(`/api/admin/content/${video.id}/approve`, "POST", {
              revision: video.updated_at,
              retry,
            })
          : await request(`/api/admin/content/${video.id}`, "PATCH", {
              action,
              revision: video.updated_at,
            });
    replaceVideo(result);
    setRowErrors((current) => {
      const next = { ...current };
      delete next[video.id];
      return next;
    });
    setNotice(
      action === "save"
        ? "Edits saved. Review and tick Approved when ready."
        : action === "skip"
          ? "Video skipped."
          : "Receipts updated. Check the platform results.",
    );
  }
  const groups = ["To review", "Scheduled", "Done"];
  const visibleVideos = (data?.videos ?? []).filter(
    (v) =>
      group(v) === filter &&
      v.file_name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="ws content-page">
      <header className="content-heading">
        <div>
          <h1 className="ws-title">Content</h1>
          <p className="ws-sub">
            The week’s videos, ready for Eimear to review.
          </p>
        </div>
        <div className="content-actions">
          <button
            className="ws-btn"
            disabled={busy}
            onClick={() =>
              run(async () => {
                if (sample) {
                  setFolderMap([]);
                  setMapOpen(true);
                  return;
                }
                const result = await request("/api/admin/content/folder-map");
                setFolderMap(result.files);
                setMapOpen(true);
              })
            }
          >
            Folder map
          </button>
          <button
            className="ws-btn is-primary"
            disabled={busy || !!sample || !data?.configured}
            onClick={() =>
              run(async () => {
                const result = await request("/api/admin/content", "POST");
                setNotice(
                  result.message ||
                    `Folder checked · ${result.added ?? 0} new videos`,
                );
                await refresh();
              })
            }
          >
            {busy ? "Checking…" : "Check for new videos"}
          </button>
        </div>
      </header>
      {sample && (
        <div className="ws-note is-info">
          Preview sample · try editing and approving the rows. Nothing here is
          saved or scheduled.
        </div>
      )}
      {data && !data.configured && (
        <div className="ws-note is-attn">
          <strong>Folder not connected yet.</strong> Share Killen Studios Folder
          with the portal reader, then connect its folder ID.
        </div>
      )}
      {data && !data.enabled && (
        <p className="content-muted">
          Scheduling is switched off. Videos will upload after scheduling is
          enabled.
        </p>
      )}
      {error && (
        <div role="alert" className="ws-note is-bad">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="ws-note is-ok">
          {notice}
        </div>
      )}
      {data && [...data.connectionWarnings, ...data.warnings].length > 0 && (
        <div className="ws-note is-attn">
          <div>
            <strong>Needs attention</strong>
            <ul>
              {[...data.connectionWarnings, ...data.warnings].map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
      <div className="content-stats">
        {groups.map((g) => (
          <button
            key={g}
            className={`ws-stat ${filter === g ? "is-active" : ""}`}
            onClick={() => setFilter(g)}
          >
            <span className="ws-stat-label">{g}</span>
            <strong className="ws-stat-value">
              {data ? data.videos.filter((v) => group(v) === g).length : "—"}
            </strong>
            <span className="ws-stat-sub">
              {g === "To review"
                ? "Caption, date and platforms"
                : g === "Scheduled"
                  ? "Confirmed CRM receipts"
                  : "Past dates and skipped videos"}
            </span>
          </button>
        ))}
      </div>
      <div className="content-toolbar">
        <input
          className="ws-input"
          aria-label="Search videos"
          placeholder="Search videos…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="content-muted">
          {data?.checked_at
            ? `Last checked ${when(data.checked_at)}`
            : "One video a day · London time"}
        </span>
      </div>

      <section className="ws-panel content-review-list" aria-label={filter}>
        <div className="ws-panel-head">
          <h2>{filter}</h2>
          <span className="content-muted">{visibleVideos.length} videos</span>
        </div>
        {!data ? (
          <div aria-label="Loading videos">
            {[1, 2, 3].map((n) => (
              <div className="ws-skrow" key={n}>
                <span />
                <span />
                <span />
              </div>
            ))}
          </div>
        ) : (
          visibleVideos.map((v) => {
            const review = reviews[v.id] ?? newReview(v);
            return (
              <ContentReviewRow
                key={v.id}
                video={v}
                review={review}
                expanded={expanded === v.id}
                busy={busy}
                enabled={data.enabled}
                sample={!!sample}
                error={rowErrors[v.id]}
                onExpand={() =>
                  setExpanded((current) => (current === v.id ? null : v.id))
                }
                onEdit={(patch) =>
                  setReviews((current) => ({
                    ...current,
                    [v.id]: editReview(current[v.id] ?? newReview(v), patch),
                  }))
                }
                onApproval={(approved) =>
                  setReviews((current) => ({
                    ...current,
                    [v.id]: { ...(current[v.id] ?? newReview(v)), approved },
                  }))
                }
                onSave={() => run(() => rowAction(v, "save"))}
                onSkip={() => run(() => rowAction(v, "skip"))}
                onRetry={(platform) =>
                  run(() => rowAction(v, "retry", platform))
                }
                onReconcile={() => run(() => rowAction(v, "reconcile"))}
              />
            );
          })
        )}
        {data && !visibleVideos.length && (
          <div className="content-empty">
            <strong>
              {filter === "To review"
                ? "No videos waiting"
                : `No ${filter.toLowerCase()} videos`}
            </strong>
            <p>
              {search
                ? "No videos match your search."
                : data.configured
                  ? "Check the folder for this week’s videos."
                  : "Videos will appear here once the shared folder is connected."}
            </p>
          </div>
        )}
      </section>
      {(filter === "To review" || approvedItems.length > 0) && (
        <div className="content-batch">
          <div>
            <strong aria-live="polite">
              {approvedItems.length}{" "}
              {approvedItems.length === 1 ? "video" : "videos"} approved
            </strong>
            <p className="content-muted">
              {sample
                ? "Preview only · scheduling is off."
                : !data?.enabled
                  ? "Scheduling is switched off."
                  : "Only approved videos will be scheduled."}
            </p>
            <p className="content-muted">
              Edits and approvals stay on this page until you save or schedule.
            </p>
          </div>
          <button
            className="ws-btn is-primary content-schedule"
            disabled={
              busy || !approvedItems.length || !data?.enabled || !!sample
            }
            onClick={() => run(scheduleApproved)}
          >
            {progress ||
              (approvedItems.length
                ? `Schedule ${approvedItems.length} ${approvedItems.length === 1 ? "video" : "videos"}`
                : "Schedule approved videos")}
          </button>
        </div>
      )}
      {mapOpen && (
        <section className="ws-panel content-map">
          <div className="ws-panel-head">
            <h2>Folder map</h2>
            <button className="ws-btn" onClick={() => setMapOpen(false)}>
              Close map
            </button>
          </div>
          <p className="content-muted">
            Read-only names, file types and dates. File contents are never
            shown.
          </p>
          {folderMap?.length ? (
            folderMap.map((f, i) => (
              <div key={i} className="content-map-row">
                <strong>{f.path.join(" / ")}</strong>
                <span>
                  {f.mimeType === "application/vnd.google-apps.folder"
                    ? "Folder"
                    : f.mimeType}
                </span>
                <span>
                  Created {when(f.createdTime ?? null)} · Updated{" "}
                  {when(f.modifiedTime ?? null)}
                </span>
              </div>
            ))
          ) : (
            <div className="content-empty">Folder not connected yet</div>
          )}
        </section>
      )}
    </div>
  );
}
