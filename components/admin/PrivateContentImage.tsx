"use client";

import Image from "next/image";
import { useState } from "react";
import type { OpsArtifact } from "@/lib/ops/action-types";

/** The preview reads the exact private image; uploading never approves a post. */
export default function PrivateContentImage({ artifact, assetId, fallback, label }: {
  artifact: OpsArtifact;
  assetId: string;
  fallback: string | null;
  label: string;
}) {
  const path = `/api/admin/ops/artifacts/${artifact.id}/media/${encodeURIComponent(assetId)}?version=${artifact.version}&manifest_hash=${artifact.manifest_hash}`;
  const [privateMissing, setPrivateMissing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const imageUrl = privateMissing ? fallback : `${path}&preview=${revision}`;
  const canUpload = !artifact.execution_started_at && ["draft", "approved", "rejected"].includes(artifact.status);

  async function upload(file: File) {
    setError("");
    if (file.size > 3 * 1024 * 1024) { setError("Choose the original PNG or JPEG, up to 3 MB."); return; }
    setBusy(true);
    try {
      const response = await fetch(path, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "The image could not be saved.");
      setLoaded(false);
      setPrivateMissing(false);
      setRevision((value) => value + 1);
    } catch (e) { setError(e instanceof Error ? e.message : "The image could not be saved."); }
    finally { setBusy(false); }
  }

  return <div className="min-w-0 rounded-lg border border-current/10 p-2">
    {imageUrl ? <a href={imageUrl} target="_blank" rel="noreferrer" className="block">
      <Image unoptimized referrerPolicy="no-referrer" src={imageUrl} width={1080} height={1350}
        alt={label} className="aspect-[4/5] w-full rounded-md bg-bg-primary object-contain"
        onLoad={() => setLoaded(true)} onError={() => { setLoaded(false); setPrivateMissing(true); }} />
    </a> : <p className="p-3 text-sm text-text-muted">Upload the original image to review it here.</p>}
    <p className="mt-2 text-center text-xs font-semibold">{label}</p>
    <p className="mt-1 text-center text-xs text-text-muted" aria-live="polite">
      {busy ? "Saving private copy…" : loaded && !privateMissing ? "Saved privately" : privateMissing ? "Private copy not saved yet" : "Checking private image…"}
    </p>
    {canUpload && <label className={`mt-2 flex min-h-11 cursor-pointer items-center justify-center rounded-md border border-current/10 p-2 text-center text-xs font-semibold ${busy ? "opacity-50" : "hover:bg-current/5"}`}>
      Upload original image
      <input type="file" accept="image/png,image/jpeg" className="sr-only" disabled={busy}
        aria-label={`Upload original for ${label}`} onChange={(event) => {
          const file = event.currentTarget.files?.[0]; event.currentTarget.value = "";
          if (file) void upload(file);
        }} />
    </label>}
    {error && <p role="alert" className="mt-2 break-words text-xs text-amber-700">{error}</p>}
  </div>;
}
