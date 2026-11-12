"use client";

import "./reply-drafts.css";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/ops/workspace/WorkspaceUI";
import type { DraftReview } from "@/lib/reply-drafts/review";

const OPEN = ["ready", "needs_marc", "skipped"];

function when(at: string) {
  return new Date(at).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
}

const DONE_TEXT: Record<string, string> = {
  sent: "Sent.",
  edited_sent: "Sent with your edits.",
  discarded: "Draft discarded.",
  superseded: "This conversation has moved on, so this draft was retired.",
  failed: "This draft could not be written. Reply from the inbox.",
  pending: "This draft is still being written. Check back in a minute.",
};

export default function ApproveDraftClient({ review }: { review: DraftReview }) {
  const { draft } = review;
  const [status, setStatus] = useState(draft.status);
  const [text, setText] = useState(draft.draft_text || "");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<"send" | "discard" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const open = OPEN.includes(status);
  const threadHref = draft.kind === "checkin" ? `/admin/clients/${draft.client_id}` : `/admin/inbox?client=${draft.client_id}`;

  async function decide(action: "send" | "discard") {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reply-drafts/${draft.id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "send" ? { action, text } : { action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setStatus(data.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="ws ws-page">
      <div className="rd-approve">
        <div>
          <p className="ws-caption">{draft.kind === "checkin" ? "Check-in reply" : draft.kind === "checkin_followup" ? "Check-in follow-up" : "Inbox reply"}</p>
          <h1 className="rd-approve-h">{review.clientName}</h1>
          {review.businessName && <p className="ws-meta">{review.businessName}</p>}
        </div>

        <section className="ws-panel" aria-label="What they said">
          <div className="ws-panel-head">
            <h2 className="ws-h2">{review.checkin ? `Week ${review.checkin.weekNumber} check-in` : "Their message"}</h2>
          </div>
          <div className="ws-pad rd-qa">
            {review.checkin && draft.kind === "checkin"
              ? review.checkin.answers.map((a) => (
                  <div key={a.label}>
                    <div className="ws-field-l">{a.label}</div>
                    <p className="ws-prose">{a.answer}</p>
                  </div>
                ))
              : review.clientMessages.map((m) => (
                  <div key={m.id} className="rd-bubble">
                    {m.text}
                    <span className="rd-bubble-at">{when(m.at)}</span>
                  </div>
                ))}
          </div>
        </section>

        {!open ? (
          <div className="ws-note is-ok" role="status">
            <Icon name="checkCircle" size={15} />
            <div className="min-w-0">
              {DONE_TEXT[status] || "This draft has been handled."}{" "}
              <Link className="ws-link" href={threadHref}>Open the conversation</Link>
            </div>
          </div>
        ) : status === "skipped" ? (
          <div className="ws-note is-info" role="note">
            <Icon name="info" size={15} />
            <div className="min-w-0">
              <strong>Reply yourself:</strong> {draft.needs_reason || "this one needs your own words."}{" "}
              <Link className="ws-link" href={threadHref}>Open the conversation</Link>
            </div>
          </div>
        ) : (
          <section className="ws-panel" aria-label="Suggested reply">
            <div className="ws-panel-head">
              <h2 className="ws-h2">Suggested reply</h2>
              <span className="ws-caption">Not sent until you press Send</span>
            </div>
            <div className="ws-pad rd-qa">
              {status === "needs_marc" && (
                <div className="ws-note is-attn" role="note">
                  <Icon name="alert" size={15} />
                  <div className="min-w-0"><strong>Needs you:</strong> {draft.needs_reason || "check this before sending."}</div>
                </div>
              )}
              {editing ? (
                <textarea
                  className="ws-input rd-draft-box"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  aria-label="Edit reply"
                  autoFocus
                />
              ) : (
                <div className="rd-text" style={{ maxHeight: "none" }}>{text}</div>
              )}
              {error && <div className="rd-err" role="alert">{error}</div>}
            </div>
          </section>
        )}

        {open && status !== "skipped" && (
          <div className="rd-approve-bar">
            <button type="button" className="ws-btn ws-btn-quiet ws-focus" onClick={() => void decide("discard")} disabled={busy !== null}>
              {busy === "discard" ? "Discarding..." : "Discard"}
            </button>
            {!editing && (
              <button type="button" className="ws-btn ws-focus" onClick={() => setEditing(true)} disabled={busy !== null}>
                Edit
              </button>
            )}
            <button type="button" className="ws-btn ws-btn-primary ws-focus" onClick={() => void decide("send")} disabled={busy !== null || !text.trim()}>
              <Icon name="send" size={14} />
              {busy === "send" ? "Sending..." : "Send"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
