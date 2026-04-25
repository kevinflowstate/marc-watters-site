"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface ClientCheckinReplyFormProps {
  checkinId: string;
  initialReply?: string;
  initialRepliedAt?: string;
}

function formatReplyDate(timestamp: string) {
  return new Date(timestamp).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function ClientCheckinReplyForm({
  checkinId,
  initialReply,
  initialRepliedAt,
}: ClientCheckinReplyFormProps) {
  const router = useRouter();
  const [reply, setReply] = useState(initialReply || "");
  const [savedReply, setSavedReply] = useState(initialReply || "");
  const [savedAt, setSavedAt] = useState(initialRepliedAt || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const trimmed = reply.trim();
    if (!trimmed || saving || savedReply) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/portal/checkin-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkin_id: checkinId, reply_text: trimmed }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not send your reply.");
      }

      const now = new Date().toISOString();
      setSavedReply(trimmed);
      setSavedAt(now);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send your reply.");
    } finally {
      setSaving(false);
    }
  }

  if (savedReply) {
    return (
      <div className="rounded-3xl border border-[rgba(34,197,94,0.18)] bg-[rgba(34,197,94,0.08)] p-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
          Your Reply
        </div>
        <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap text-text-primary">
          {savedReply}
        </p>
        {savedAt && (
          <div className="mt-4 text-xs text-text-muted">
            Sent {formatReplyDate(savedAt)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)] p-5">
      <div className="text-sm font-semibold text-text-primary">Reply to Marc</div>
      <textarea
        value={reply}
        onChange={(event) => setReply(event.target.value)}
        rows={4}
        placeholder="Type your reply about this check-in..."
        disabled={saving}
        className="mt-3 w-full resize-none rounded-2xl border border-[rgba(255,255,255,0.08)] bg-bg-primary px-4 py-3 text-sm leading-relaxed text-text-primary placeholder:text-text-muted transition-colors focus:outline-none focus:border-[rgba(34,114,222,0.35)] disabled:opacity-50"
      />
      {error && (
        <div className="mt-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}
      <button
        type="button"
        onClick={() => void handleSubmit()}
        disabled={!reply.trim() || saving}
        className="mt-3 inline-flex items-center justify-center rounded-xl bg-accent-bright/20 px-4 py-2 text-sm font-semibold text-accent-bright transition-colors hover:bg-accent-bright/30 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {saving ? "Sending..." : "Send Reply"}
      </button>
    </div>
  );
}
