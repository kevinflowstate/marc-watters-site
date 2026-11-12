"use client";

import { useRef, useState } from "react";
import { WsEmpty as EmptyState } from "@/components/portal/WsState";
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
    <section className="ws-panel">
      <header className="ws-panel-head">
        <div className="min-w-0 ws-ge-head-t">
          <h2 className="ws-h2">Files and assets</h2>
          <p className="ws-caption">Private storage with explicit client visibility.</p>
        </div>
        <div className="ws-ge-acts">
          <label className="ws-check ws-ge-vis">
            <input type="checkbox" checked={clientVisible} onChange={(event) => setClientVisible(event.target.checked)} className="" />
            Visible to client
          </label>
          <label className="ws-btn ws-btn-primary ws-btn-sm">
            {busy ? "Working…" : "Upload file"}
            <input ref={inputRef} type="file" disabled={busy} onChange={(event) => void upload(event.target.files?.[0])} className="sr-only" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.zip,.png,.jpg,.jpeg,.webp" />
          </label>
        </div>
      </header>
      {assets.length ? (
        <div>
          {assets.map((asset) => (
            <div key={asset.id} className="ws-ge-file">
              <div className="min-w-0">
                <p className="ws-row-title">{asset.title}</p>
                <p className="ws-row-sub">{fileSize(asset.size_bytes)} · {visibilityLabel(asset.availability)} · Added {new Date(asset.created_at).toLocaleDateString("en-GB")}</p>
              </div>
              <div className="ws-ge-acts">
                <a href={`/api/admin/growth-engine/assets/${asset.id}/download`} className="ws-btn ws-btn-sm ws-focus">Download</a>
                <button type="button" disabled={busy} onClick={() => void update(asset.id, asset.visibility !== "client")} className="ws-btn ws-btn-sm ws-focus">{asset.visibility === "client" ? "Make private" : "Share with client"}</button>
                <button type="button" disabled={busy} onClick={() => void remove(asset.id)} className="ws-btn ws-btn-quiet ws-btn-sm ws-focus ws-ge-del">Remove</button>
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
