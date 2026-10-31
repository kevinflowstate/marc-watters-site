"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
type Row = {
  id: string;
  title: string;
  status: string;
  publish_due_at: string;
  error: string | null;
};
export default function Recordings() {
  const [rows, setRows] = useState<Row[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const r = await fetch("/api/admin/recordings"),
          d = await r.json();
        if (!r.ok) throw Error(d.error);
        if (active) setRows(d.lessons);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Unavailable");
      }
    };
    void load();
    const t = setInterval(load, 10000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);
  return (
    <div className="max-w-5xl mx-auto">
      <Link href="/admin/training" className="text-accent-bright">
        ← Training
      </Link>
      <h1 className="v2-page-title my-4">Lesson recordings</h1>
      <p className="text-text-secondary mb-6">
        Review the transcript and proposed cuts before creating a lesson draft.
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="v2-surface divide-y divide-current/10">
        {rows.length ? (
          rows.map((r) => (
            <Link
              href={`/admin/training/recordings/${r.id}`}
              className="block p-5 hover:bg-accent/5"
              key={r.id}
            >
              <strong>{r.title}</strong>
              <div className="flex flex-wrap gap-3 text-sm mt-2">
                <span className="text-accent-bright">
                  {r.status.replaceAll("_", " ")}
                </span>
                <span className="text-text-muted">
                  Due {new Date(r.publish_due_at).toLocaleDateString("en-GB")}
                </span>
              </div>
              {r.error && (
                <p className="text-amber-600 text-sm mt-2">{r.error}</p>
              )}
            </Link>
          ))
        ) : (
          <p className="p-6 text-text-muted">
            No recordings yet. New signed Fathom webhooks appear here.
          </p>
        )}
      </div>
    </div>
  );
}
