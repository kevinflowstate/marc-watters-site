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
  const [fallbackFailed, setFallbackFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const imageUrl = privateMissing ? (fallbackFailed ? null : fallback) : `${path}&preview=${revision}`;
  const canUpload = !artifact.execution_started_at && ["draft", "approved", "rejected"].includes(artifact.status);

  async function upload(file: File) {
    setError("");
    if (!["image/png", "image/jpeg"].includes(file.type) || file.size === 0 || file.size > 3 * 1024 * 1024) { setError("Choose the original PNG or JPEG, up to 3 MB."); return; }
    setBusy(true);
    try {
      const response = await fetch(path, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "The image could not be saved.");
      setLoaded(false);
      setPrivateMissing(false);
      setFallbackFailed(false);
      setRevision((value) => value + 1);
    } catch (e) { setError(e instanceof Error ? e.message : "The image could not be saved."); }
    finally { setBusy(false); }
  }

  return <div className="min-w-0 rounded-lg border border-current/10 p-2">
    {imageUrl ? <a href={imageUrl} target="_blank" rel="noreferrer" className="block rounded-md focus-visible:outline-2 focus-visible:outline-accent" aria-label={`Open ${label} at full size`}>
      <Image unoptimized referrerPolicy="no-referrer" src={imageUrl} width={1080} height={1350}
        alt={label} className="aspect-[4/5] w-full rounded-md bg-bg-primary object-contain"
        onLoad={() => setLoaded(true)} onError={() => {
          setLoaded(false);
          if (privateMissing) setFallbackFailed(true);
          else setPrivateMissing(true);
        }} />
    </a> : <p className="p-3 text-sm text-text-muted">This image could not be opened. {canUpload ? "Retry the private copy, or upload the original file." : "Retry the private copy."}</p>}
    <p className="mt-2 text-center text-xs font-semibold">{label}</p>
    <p className="mt-1 text-center text-xs text-text-muted" aria-live="polite">
      {busy ? "Saving private copy…" : loaded && !privateMissing ? "Saved privately" : privateMissing && loaded ? "Showing the saved reference. Private copy could not be checked." : privateMissing ? "Private copy could not be opened." : "Checking private image…"}
    </p>
    {privateMissing && <button type="button" disabled={busy} className="mt-2 min-h-11 w-full rounded-md border border-current/10 p-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50" onClick={() => {
      setError(""); setLoaded(false); setPrivateMissing(false); setFallbackFailed(false); setRevision((value) => value + 1);
    }}>Retry private image</button>}
    {canUpload && <label className={`mt-2 flex min-h-11 cursor-pointer items-center justify-center rounded-md border border-current/10 p-2 text-center text-xs font-semibold focus-within:outline-2 focus-within:outline-accent ${busy ? "opacity-50" : "hover:bg-current/5"}`}>
      Upload original image
      <input type="file" accept="image/png,image/jpeg" className="sr-only" disabled={busy}
        aria-label={`Upload original for ${label}`} onChange={(event) => {
          const file = event.currentTarget.files?.[0]; event.currentTarget.value = "";
          if (file) void upload(file);
        }} />
    </label>}
    {canUpload && <p className="mt-2 text-center text-xs text-text-muted">Original PNG or JPEG, up to 3 MB. A changed image needs a new content version.</p>}
    {error && <p role="alert" className="mt-2 break-words text-xs text-amber-700">{error}</p>}
  </div>;
}
