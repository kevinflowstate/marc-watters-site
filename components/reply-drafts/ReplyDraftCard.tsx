"use client";

import "./reply-drafts.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ops/workspace/WorkspaceUI";

type Draft = {
  id: string;
  status: "pending" | "ready" | "needs_marc" | "skipped";
  draft_text: string | null;
  needs_reason: string | null;
  due_at: string;
};

type Scope = { clientId: string; checkinId?: never } | { checkinId: string; clientId?: never };

/**
 * Suggested reply above the composer (admin only). Renders nothing when the feature is off,
 * when there is no draft, or for clients (the API is admin-only).
 * Nothing is ever sent from here without a Send click.
 */
export default function ReplyDraftCard({
  scope,
  refreshKey,
  onEdit,
  onSent,
}: {
  scope: Scope;
  /** Change this (for example the latest message id) to refetch. */
  refreshKey?: string | number | null;
  /** Put the draft text into the composer. The composer's own Send records it as edited. */
  onEdit: (text: string, draftId: string) => void;
  onSent?: (text: string) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<"send" | "discard" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const query = scope.clientId ? `client_id=${encodeURIComponent(scope.clientId)}` : `checkin_id=${encodeURIComponent(scope.checkinId!)}`;

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/reply-drafts?${query}`, { cache: "no-store" });
      if (!res.ok) return setDraft(null);
      const data = await res.json();
      setDraft(data.enabled ? (data.draft as Draft | null) : null);
    } catch {
      setDraft(null);
    }
  }, [query]);

  useEffect(() => {
    setError(null);
    void load();
  }, [load, refreshKey]);

  // While a draft is still being written, check back.
  useEffect(() => {
    if (pollRef.current) clearTimeout(pollRef.current);
    if (draft?.status === "pending") {
      const wait = Math.max(5_000, Math.min(20_000, Date.parse(draft.due_at) - Date.now() + 6_000));
      pollRef.current = setTimeout(() => void load(), wait);
    }
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [draft, load]);

  async function decide(action: "send" | "discard") {
    if (!draft) return;
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reply-drafts/${draft.id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || (action === "send" ? "Could not send the reply." : "Could not discard the draft."));
      setHidden(draft.id);
      if (action === "send") await onSent?.(draft.draft_text || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      void load();
    } finally {
      setBusy(null);
    }
  }

  if (!draft || hidden === draft.id) return null;

  if (draft.status === "pending") {
    return (
      <div className="rd-wait" role="status">
        <Icon name="sparkle" size={13} />
        Drafting a reply
      </div>
    );
  }

  if (draft.status === "skipped") {
    return (
      <div className="ws-note is-info" role="note">
        <Icon name="info" size={15} />
        <div className="min-w-0" style={{ flex: 1 }}>
          <strong>Reply yourself:</strong> {draft.needs_reason || "this one needs your own words."}
        </div>
        <button type="button" className="ws-btn ws-btn-sm ws-btn-quiet ws-focus" onClick={() => void decide("discard")} disabled={busy !== null}>
          Dismiss
        </button>
      </div>
    );
  }

  return (
    <div className="rd-card" aria-label="Suggested reply">
      <div className="rd-head">
        <Icon name="sparkle" size={13} />
        Suggested reply
        <span className="rd-meta">Not sent until you press Send</span>
      </div>
      {draft.status === "needs_marc" && (
        <div className="ws-note is-attn" role="note">
          <Icon name="alert" size={15} />
          <div className="min-w-0">
            <strong>Needs you:</strong> {draft.needs_reason || "check this before sending."}
          </div>
        </div>
      )}
      <div className="rd-text">{draft.draft_text}</div>
      {error && <div className="rd-err" role="alert">{error}</div>}
      <div className="rd-acts">
        <button type="button" className="ws-btn ws-btn-primary ws-btn-sm ws-focus" onClick={() => void decide("send")} disabled={busy !== null}>
          <Icon name="send" size={13} />
          {busy === "send" ? "Sending..." : "Send"}
        </button>
        <button
          type="button"
          className="ws-btn ws-btn-sm ws-focus"
          onClick={() => {
            onEdit(draft.draft_text || "", draft.id);
            setHidden(draft.id);
          }}
          disabled={busy !== null}
        >
          Edit
        </button>
        <span className="rd-spacer" />
        <button type="button" className="ws-btn ws-btn-sm ws-btn-quiet ws-focus" onClick={() => void decide("discard")} disabled={busy !== null}>
          {busy === "discard" ? "Discarding..." : "Discard"}
        </button>
      </div>
    </div>
  );
}
