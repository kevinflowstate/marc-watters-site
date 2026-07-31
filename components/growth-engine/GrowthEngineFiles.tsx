"use client";

import { useRef, useState } from "react";
import { EmptyState } from "@/components/ui/PortalState";
import { useToast } from "@/components/ui/Toast";
import type { GrowthAssetSummary } from "@/lib/growth-engine-admin";

export default function GrowthEngineFiles({
  clientId,
  assets,
  onChanged,
}: {
  clientId: string;
  assets: GrowthAssetSummary[];
  onChanged: () => Promise<void>;
}) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [clientVisible, setClientVisible] = useState(true);

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("clientVisible", String(clientVisible));
      const response = await fetch(`/api/admin/growth-engine/clients/${clientId}/assets`, { method: "POST", body: form });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "File could not be uploaded.");
      if (inputRef.current) inputRef.current.value = "";
      await onChanged();
      toast("File uploaded");
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function update(assetId: string, visible: boolean) {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/growth-engine/assets/${assetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientVisible: visible }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "File visibility could not be changed.");
      await onChanged();
      toast(visible ? "File is now visible to the client" : "File returned to private");
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove(assetId: string) {
    if (!window.confirm("Remove this file from the Growth Engine workspace?")) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/growth-engine/assets/${assetId}`, { method: "DELETE" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "File could not be removed.");
      await onChanged();
      toast("File removed");
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="v2-surface overflow-hidden">
      <header className="flex flex-col gap-4 border-b border-white/[0.07] px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-7">
        <div>
          <h2 className="v2-section-title">Files and assets</h2>
          <p className="mt-1 text-xs text-text-muted">Private storage with explicit client visibility.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex min-h-10 items-center gap-2 text-xs font-semibold text-text-secondary">
            <input type="checkbox" checked={clientVisible} onChange={(event) => setClientVisible(event.target.checked)} className="h-4 w-4 accent-[var(--cbb-accent)]" />
            Visible to client
          </label>
          <label className="v2-button-primary cursor-pointer">
            {busy ? "Working…" : "Upload file"}
            <input ref={inputRef} type="file" disabled={busy} onChange={(event) => void upload(event.target.files?.[0])} className="sr-only" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.zip,.png,.jpg,.jpeg,.webp" />
          </label>
        </div>
      </header>
      {assets.length ? (
        <div className="divide-y divide-white/[0.06]">
          {assets.map((asset) => (
            <div key={asset.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-text-primary">{asset.title}</p>
                <p className="mt-1 text-xs text-text-muted">{fileSize(asset.size_bytes)} · {visibilityLabel(asset.availability)} · Added {new Date(asset.created_at).toLocaleDateString("en-GB")}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a href={`/api/admin/growth-engine/assets/${asset.id}/download`} className="v2-button-secondary no-underline">Download</a>
                <button type="button" disabled={busy} onClick={() => void update(asset.id, asset.visibility !== "client")} className="v2-button-secondary">{asset.visibility === "client" ? "Make private" : "Share with client"}</button>
                <button type="button" disabled={busy} onClick={() => void remove(asset.id)} className="min-h-10 rounded-xl px-3 text-xs font-bold text-red-300 hover:bg-red-500/10">Remove</button>
              </div>
            </div>
          ))}
        </div>
      ) : <EmptyState title="No files yet" description="Upload strategies, creative, exports or supporting documents for this client." />}
    </section>
  );
}

function fileSize(value: number | null) {
  if (!value) return "Document";
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function visibilityLabel(value: GrowthAssetSummary["availability"]) {
  if (value === "visible") return "Client visible";
  if (value === "on_publish") return "Shares when report is published";
  return "Private";
}
