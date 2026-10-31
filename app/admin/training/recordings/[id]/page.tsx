"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { Cut } from "@/lib/ops/cuts";
type Lesson = {
  id: string;
  title: string;
  status: string;
  transcript_text: string;
  summary: string;
  cut_list: Cut[];
  error: string | null;
  source_storage_path: string | null;
  publish_due_at: string;
};
type Module = { id: string; title: string; is_published: boolean };
export default function ReviewRecording() {
  const { id } = useParams<{ id: string }>(),
    [l, setL] = useState<Lesson | null>(null),
    [cuts, setCuts] = useState<Cut[]>([]),
    [url, setUrl] = useState<string | null>(null),
    [modules, setModules] = useState<Module[]>([]),
    [moduleId, setModuleId] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/recordings/${id}`),
      d = await r.json();
    if (!r.ok) throw Error(d.error);
    setL(d.lesson);
    setCuts(d.lesson.cut_list);
    setUrl(d.source_url);
    setModules(d.modules);
  }, [id]);
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, [load]);
  async function act(action: string) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/admin/recordings/${id}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action, cut_list: cuts, module_id: moduleId }),
        }),
        d = await r.json();
      if (!r.ok) throw Error(d.error);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="max-w-5xl mx-auto">
      <Link href="/admin/training/recordings" className="text-accent-bright">
        ← Recordings
      </Link>
      <h1 className="v2-page-title my-4">{l?.title || "Recording review"}</h1>
      {error && (
        <p role="alert" className="text-amber-600 p-4">
          {error}
        </p>
      )}
      {l && (
        <>
          <p className="text-text-secondary mb-4">
            {l.status.replaceAll("_", " ")} · Due{" "}
            {new Date(l.publish_due_at).toLocaleDateString("en-GB")}
          </p>
          {l.error && <p className="text-amber-600 mb-4">{l.error}</p>}
          {url ? (
            <video
              ref={video}
              src={url}
              controls
              preload="metadata"
              className="w-full aspect-video rounded-xl bg-black"
              aria-label="Source recording"
            />
          ) : (
            <div className="v2-surface p-8 text-text-muted">
              Source copy is queued or not yet available.
            </div>
          )}
          <div className="flex flex-wrap gap-3 my-5">
            <button
              disabled={busy}
              className="v2-button-secondary"
              onClick={() => void act("ingest")}
            >
              Retry intake
            </button>
            <button
              disabled={busy || !l.transcript_text}
              className="v2-button-secondary"
              onClick={() => void act("propose")}
            >
              Propose cuts
            </button>
            <button
              disabled={busy}
              className="v2-button-secondary"
              onClick={() => void act("retry_worker")}
            >
              Retry queued worker
            </button>
            <button
              disabled={busy}
              className="v2-button-secondary"
              onClick={() => void load().catch((e) => setError(e.message))}
            >
              Refresh status
            </button>
          </div>
          <div className="v2-surface overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr>
                  {[
                    "Segment",
                    "Time",
                    "Reason",
                    "Confidence",
                    "Keep",
                    "Preview",
                  ].map((h) => (
                    <th className="p-3" key={h}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cuts.map((c, i) => (
                  <tr key={i} className="border-t border-current/10">
                    <td className="p-3 min-w-48">{c.snippet}</td>
                    <td className="p-3 whitespace-nowrap">
                      {c.start_s}–{c.end_s}s
                    </td>
                    <td className="p-3">{c.reason.replaceAll("_", " ")}</td>
                    <td className="p-3">{Math.round(c.confidence * 100)}%</td>
                    <td className="p-3">
                      <input
                        aria-label={`Keep segment ${i + 1}`}
                        type="checkbox"
                        checked={c.keep}
                        onChange={(e) =>
                          setCuts((xs) =>
                            xs.map((v, n) =>
                              n === i ? { ...v, keep: e.target.checked } : v,
                            ),
                          )
                        }
                      />
                    </td>
                    <td className="p-3">
                      <button
                        disabled={!url}
                        className="text-accent-bright whitespace-nowrap"
                        onClick={() => {
                          if (video.current) {
                            video.current.currentTime = c.start_s;
                            void video.current.play();
                          }
                        }}
                      >
                        Play from here
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!cuts.length && (
              <p className="p-5 text-text-muted">
                No cuts proposed. Teaching content is preserved.
              </p>
            )}
          </div>
          <button
            className="v2-button-primary mt-5"
            disabled={busy || l.status !== "cuts_proposed" || !url}
            onClick={() => void act("approve")}
          >
            Approve cuts and render
          </button>
          <div className="v2-surface p-5 my-6">
            <label className="block">
              Draft destination
              <select
                aria-label="Draft training module"
                className="block w-full bg-bg-secondary border border-current/15 rounded-lg p-3 mt-2"
                value={moduleId}
                onChange={(e) => setModuleId(e.target.value)}
              >
                <option value="">Choose an unpublished module</option>
                {modules.map((m) => (
                  <option key={m.id} value={m.id} disabled={m.is_published}>
                    {m.title}
                    {m.is_published ? " (published)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-sm text-text-muted my-3">
              Create an unpublished module in Training if needed. Publishing
              stays in the existing training admin.
            </p>
            <button
              className="v2-button-secondary"
              disabled={
                busy ||
                !moduleId ||
                !l.source_storage_path ||
                !["rendered", "transcribed", "cuts_proposed"].includes(l.status)
              }
              onClick={() => void act("draft")}
            >
              {l.status === "rendered"
                ? "Draft lesson from edited video"
                : "Skip editing, draft lesson from source"}
            </button>
          </div>
          <details className="v2-surface p-5">
            <summary>Transcript</summary>
            <pre className="whitespace-pre-wrap text-sm mt-4 font-sans">
              {l.transcript_text || "Transcript pending"}
            </pre>
          </details>
        </>
      )}
    </div>
  );
}
