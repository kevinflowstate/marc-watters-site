"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { londonInput, londonToUtc } from "@/lib/content/slots";
import { platforms, type Platform, type Video } from "@/lib/content/types";

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
const labels = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
};
const when = (s: string | null) =>
  s
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London",
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(s))
    : "Choose a date";
function group(v: Video) {
  return v.status === "skipped" ||
    (v.status === "scheduled" && Date.parse(v.schedule_at!) < Date.now())
    ? "Done"
    : v.status === "scheduled"
      ? "Scheduled"
      : "To review";
}
function status(v: Video) {
  if (
    v.content_video_posts.some((p) =>
      ["claimed", "uncertain"].includes(p.outcome),
    )
  )
    return "Needs checking";
  if (v.status === "partly_scheduled") return "Partly scheduled";
  if (v.status === "ready")
    return v.caption.trim() ? "Ready to review" : "Caption needed";
  return (
    {
      new: "Awaiting import",
      importing: "Importing · check receipt",
      failed: "Import needs attention",
      scheduled: "Scheduled",
      skipped: "Skipped",
      replaced: "Video replaced",
    } as Record<string, string>
  )[v.status];
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
  const [selected, setSelected] = useState<Video | null>(null);
  const [caption, setCaption] = useState(""),
    [date, setDate] = useState(""),
    [chosen, setChosen] = useState<Platform[]>([]);
  const [filter, setFilter] = useState("To review"),
    [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [folderMap, setFolderMap] = useState<MapFile[] | null>(null),
    [mapOpen, setMapOpen] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null);
  const refresh = useCallback(async () => {
    if (!sample) setData(await request("/api/admin/content"));
  }, [sample]);
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, [refresh]);
  const close = () => {
    drawer.current?.querySelector("video")?.pause();
    drawer.current?.close();
    setSelected(null);
    const u = new URL(location.href);
    u.searchParams.delete("video");
    history.replaceState(null, "", u);
  };
  const open = useCallback((v: Video) => {
    setSelected(v);
    setCaption(v.caption);
    setDate(v.suggested_at ? londonInput(v.suggested_at) : "");
    setChosen(v.platforms);
    setError("");
    drawer.current?.showModal();
    drawer.current?.focus();
    const u = new URL(location.href);
    u.searchParams.set("video", v.id);
    history.replaceState(null, "", u);
  }, []);
  useEffect(() => {
    const id = new URL(location.href).searchParams.get("video");
    if (id && data && !drawer.current?.open) {
      const v = data.videos.find((v) => v.id === id);
      if (v) open(v);
    }
  }, [data, open]);
  async function run(action: () => Promise<void>) {
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
      setBusy(false);
    }
  }
  async function save() {
    if (!selected || sample) return selected;
    if (!date || !chosen.length)
      throw new Error("Choose a date and at least one platform");
    const saved: Video = await request(
      `/api/admin/content/${selected.id}`,
      "PATCH",
      {
        action: "save",
        revision: selected.updated_at,
        caption,
        suggested_at: londonToUtc(date),
        platforms: chosen,
      },
    );
    setSelected(saved);
    await refresh();
    return saved;
  }
  async function approve(retry?: Platform) {
    if (!selected || sample) return;
    const v = selected.approved_at ? selected : await save();
    if (!v) return;
    const result: Video = await request(
      `/api/admin/content/${v.id}/approve`,
      "POST",
      { revision: v.updated_at, ...(retry ? { retry } : {}) },
    );
    setSelected(result);
    await refresh();
    setNotice(
      result.status === "scheduled"
        ? "Scheduled on all selected platforms."
        : "Receipts saved. Check the platform results below.",
    );
  }
  const locked =
    !!selected?.approved_at ||
    selected?.status === "importing" ||
    selected?.status === "skipped";
  const count = Array.from(caption).length;
  const tooLong =
    (chosen.includes("instagram") && count > 2200) ||
    (chosen.includes("linkedin") && count > 3000);
  const groups = ["To review", "Scheduled", "Done"];
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
          Preview sample · player and layout only. Nothing here can be saved or
          scheduled.
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
      <section className="ws-panel">
        <div className="ws-panel-head">
          <h2>{filter}</h2>
          <span className="content-muted">
            {data?.videos.filter((v) => group(v) === filter).length ?? 0} videos
          </span>
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
          data.videos
            .filter(
              (v) =>
                group(v) === filter &&
                v.file_name.toLowerCase().includes(search.toLowerCase()),
            )
            .map((v) => (
              <button
                className="ws-row content-row"
                key={v.id}
                onClick={() => open(v)}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle cx="8" cy="8" r="6" stroke="currentColor" />
                  <path d="m6 5 5 3-5 3Z" fill="currentColor" />
                </svg>
                <span>
                  <span className="ws-row-title">
                    {v.file_name.replace(/\.mp4$/i, "")}
                  </span>
                  <span className="ws-row-sub">
                    {status(v)} · {v.platforms.map((p) => labels[p]).join(", ")}
                  </span>
                </span>
                <span className="ws-row-meta">
                  {when(v.schedule_at ?? v.suggested_at)}
                </span>
              </button>
            ))
        )}
        {data &&
          !data.videos.some(
            (v) =>
              group(v) === filter &&
              v.file_name.toLowerCase().includes(search.toLowerCase()),
          ) && (
            <div className="content-empty">
              <strong>
                {filter === "To review"
                  ? "No videos waiting"
                  : `No ${filter.toLowerCase()} videos`}
              </strong>
              <p>
                {data.configured
                  ? "Check the folder for this week’s videos."
                  : "Videos will appear here once the shared folder is connected."}
              </p>
            </div>
          )}
      </section>
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
      <dialog
        ref={drawer}
        className="ws-drawer content-drawer"
        tabIndex={-1}
        aria-label={selected?.file_name ?? "Video review"}
        onClose={close}
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
      >
        {selected && (
          <>
            <div className="ws-drawer-head">
              <span className="ws-drawer-crumb">Content / Video</span>
              <span className="content-spacer" />
              {selected.drive_file_id && (
                <a
                  className="ws-btn"
                  target="_blank"
                  rel="noreferrer"
                  href={`https://drive.google.com/file/d/${encodeURIComponent(selected.drive_file_id)}/view`}
                >
                  Open in Drive
                </a>
              )}
              <button
                className="ws-btn"
                aria-label="Close video"
                onClick={close}
              >
                ×
              </button>
            </div>
            <div className="ws-drawer-body">
              <h2 className="ws-drawer-title">
                {selected.file_name.replace(/\.mp4$/i, "")}
              </h2>
              <div className="content-review-meta">
                <span className="ws-chip">{status(selected)}</span>
                <span>Eimear · {when(selected.suggested_at)}</span>
              </div>
              <div className="content-video-stage">
                {selected.media_url ? (
                  <video
                    key={selected.media_url}
                    controls
                    playsInline
                    preload="metadata"
                    aria-label="Video preview"
                    src={selected.media_url}
                  />
                ) : (
                  <div className="content-video-empty">
                    {selected.status === "failed"
                      ? "Import needs attention"
                      : "Video awaiting import"}
                    <span>
                      {data?.enabled
                        ? "Check for new videos to import the next file."
                        : "Media upload is switched off."}
                    </span>
                  </div>
                )}
              </div>
              <label className="ws-label" htmlFor="video-caption">
                Caption{" "}
                <span className="content-muted">
                  {count.toLocaleString()} characters
                </span>
              </label>
              <textarea
                id="video-caption"
                className="ws-input content-caption"
                value={caption}
                disabled={locked || busy}
                placeholder="Caption needed"
                onChange={(e) => setCaption(e.target.value)}
              />
              {tooLong && (
                <p className="content-warning">
                  Caption exceeds{" "}
                  {chosen.includes("instagram") && count > 2200
                    ? "Instagram’s 2,200"
                    : "LinkedIn’s 3,000"}{" "}
                  character limit.
                </p>
              )}
              <div className="content-settings">
                <div>
                  <label className="ws-label" htmlFor="video-date">
                    Posting date · London
                  </label>
                  <input
                    id="video-date"
                    className="ws-input"
                    type="datetime-local"
                    value={date}
                    disabled={locked || busy}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <fieldset>
                  <legend className="ws-label">Platforms</legend>
                  <div className="content-platforms">
                    {platforms.map((p) => (
                      <label key={p}>
                        <input
                          type="checkbox"
                          checked={chosen.includes(p)}
                          disabled={locked || busy}
                          onChange={(e) =>
                            setChosen(
                              e.target.checked
                                ? [...chosen, p]
                                : chosen.filter((x) => x !== p),
                            )
                          }
                        />
                        {labels[p]}
                        <small>{p === "linkedin" ? "Post" : "Reel"}</small>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
              {selected.failure_reason && (
                <div className="ws-note is-attn">{selected.failure_reason}</div>
              )}
              {selected.content_video_posts.length > 0 && (
                <section className="content-receipts">
                  <h3 className="ws-h3">Platform receipts</h3>
                  {selected.content_video_posts.map((p) => (
                    <div className="content-receipt" key={p.id}>
                      <strong>{labels[p.platform]}</strong>
                      <span>
                        {p.outcome === "scheduled"
                          ? "Scheduled · verified"
                          : p.outcome === "claimed"
                            ? "Attempt claimed · check outcome"
                            : p.outcome}
                      </span>
                      {p.reason && <p>{p.reason}</p>}
                      {p.provider_post_id && (
                        <a
                          className="ws-btn"
                          href={`https://app.flow-state.tech/v2/location/93GJEdsr0cT9el3OINXq/marketing/social-planner`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open CRM · {p.provider_post_id}
                        </a>
                      )}
                      {p.outcome === "failed" && (
                        <button
                          className="ws-btn"
                          disabled={busy || !data?.enabled || !!sample}
                          onClick={() => run(() => approve(p.platform))}
                        >
                          Retry {labels[p.platform]}
                        </button>
                      )}
                    </div>
                  ))}
                  {selected.content_video_posts.some((p) =>
                    ["uncertain", "claimed"].includes(p.outcome),
                  ) && (
                    <button
                      className="ws-btn"
                      disabled={busy || !!sample}
                      onClick={() =>
                        run(async () => {
                          const v = await request(
                            `/api/admin/content/${selected.id}`,
                            "PATCH",
                            {
                              action: "reconcile",
                              revision: selected.updated_at,
                            },
                          );
                          setSelected(v);
                          await refresh();
                        })
                      }
                    >
                      Check CRM receipts
                    </button>
                  )}
                  <p className="content-muted">
                    Reschedule or remove scheduled posts in the CRM. Past dates
                    do not confirm publication.
                  </p>
                </section>
              )}
              {!data?.enabled && (
                <p className="content-muted">Scheduling is switched off.</p>
              )}
              {sample && (
                <p className="content-muted">
                  Sample caption and sample video · preview only.
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
            </div>
            <div className="ws-drawer-foot">
              {!locked && (
                <>
                  <button
                    className="ws-btn is-primary"
                    disabled={
                      busy ||
                      !!sample ||
                      !data?.enabled ||
                      !caption.trim() ||
                      !date ||
                      !chosen.length ||
                      tooLong ||
                      selected.status !== "ready"
                    }
                    onClick={() => run(() => approve())}
                  >
                    Approve and schedule
                  </button>
                  <button
                    className="ws-btn"
                    disabled={busy || !!sample}
                    onClick={() =>
                      run(async () => {
                        await save();
                        setNotice("Changes saved.");
                      })
                    }
                  >
                    Save
                  </button>
                  <button
                    className="ws-btn"
                    disabled={busy || !!sample}
                    onClick={() =>
                      run(async () => {
                        await request(
                          `/api/admin/content/${selected.id}`,
                          "PATCH",
                          { action: "skip", revision: selected.updated_at },
                        );
                        close();
                        await refresh();
                        setNotice("Video skipped.");
                      })
                    }
                  >
                    Skip
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </dialog>
    </div>
  );
}
