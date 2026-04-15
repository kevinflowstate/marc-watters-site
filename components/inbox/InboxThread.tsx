"use client";

import { useMemo, useState } from "react";
import type { InboxMessage } from "@/lib/types";

interface InboxThreadProps {
  messages: InboxMessage[];
  currentRole: "admin" | "client";
  onSend: (message: string) => Promise<void>;
  sending: boolean;
  error: string | null;
  emptyTitle: string;
  emptyDescription: string;
  threadLabel?: string;
  threadMeta?: string;
  composerPlaceholder?: string;
}

function formatTime(timestamp: string) {
  return new Date(timestamp).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDayLabel(timestamp: string) {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  if (sameDay) return "Today";

  const sameYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (sameYesterday) return "Yesterday";

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: today.getFullYear() === date.getFullYear() ? undefined : "numeric",
  });
}

export default function InboxThread({
  messages,
  currentRole,
  onSend,
  sending,
  error,
  emptyTitle,
  emptyDescription,
  threadLabel,
  threadMeta,
  composerPlaceholder = "Write a message...",
}: InboxThreadProps) {
  const [draft, setDraft] = useState("");

  const groupedMessages = useMemo(
    () =>
      messages.map((message, index) => {
        const previous = messages[index - 1];
        const showDayDivider =
          !previous ||
          new Date(previous.created_at).toDateString() !== new Date(message.created_at).toDateString();

        return {
          ...message,
          showDayDivider,
          dayLabel: showDayDivider ? formatDayLabel(message.created_at) : null,
        };
      }),
    [messages],
  );

  const otherPartyLabel = currentRole === "admin" ? "Client" : "Marc";

  async function handleSubmit() {
    const trimmed = draft.trim();
    if (!trimmed || sending) return;
    await onSend(trimmed);
    setDraft("");
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit();
    }
  }

  return (
    <div className="flex flex-col min-h-[32rem] rounded-3xl border border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)] overflow-hidden">
      {(threadLabel || threadMeta) && (
        <div className="border-b border-[rgba(255,255,255,0.05)] px-5 py-4 bg-[rgba(255,255,255,0.015)]">
          {threadLabel && <div className="text-sm font-semibold text-text-primary">{threadLabel}</div>}
          {threadMeta && <div className="text-xs text-text-muted mt-1">{threadMeta}</div>}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
        {groupedMessages.length === 0 ? (
          <div className="h-full min-h-[18rem] flex flex-col items-center justify-center text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-[rgba(34,114,222,0.1)] border border-[rgba(34,114,222,0.2)] flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-accent-bright" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4v-4z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-text-primary mb-2">{emptyTitle}</h2>
            <p className="text-sm text-text-muted max-w-md">{emptyDescription}</p>
          </div>
        ) : (
          groupedMessages.map((message) => {
            const isOwn = message.sender_role === currentRole;
            return (
              <div key={message.id} className="space-y-4">
                {message.showDayDivider && (
                  <div className="flex items-center gap-3 py-1">
                    <div className="h-px flex-1 bg-[rgba(255,255,255,0.06)]" />
                    <div className="text-[11px] uppercase tracking-[0.24em] text-text-muted">{message.dayLabel}</div>
                    <div className="h-px flex-1 bg-[rgba(255,255,255,0.06)]" />
                  </div>
                )}

                <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[88%] rounded-2xl px-4 py-3 shadow-[0_8px_30px_rgba(0,0,0,0.12)] ${
                      isOwn
                        ? "bg-[linear-gradient(180deg,rgba(34,114,222,0.22),rgba(34,114,222,0.14))] text-text-primary border border-[rgba(34,114,222,0.18)] rounded-br-md"
                        : "bg-[rgba(255,255,255,0.03)] text-text-secondary border border-[rgba(255,255,255,0.05)] rounded-bl-md"
                    }`}
                  >
                    <div className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${isOwn ? "text-accent-light/80" : "text-text-muted"}`}>
                      {isOwn ? "You" : otherPartyLabel}
                    </div>
                    <div className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">{message.message}</div>
                    <div className={`mt-2 text-[11px] ${isOwn ? "text-accent-light/70" : "text-text-muted"}`}>
                      {formatTime(message.created_at)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-[rgba(255,255,255,0.05)] p-4 space-y-3">
        {error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}
        <div className="relative">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={composerPlaceholder}
            className="w-full resize-none rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-4 py-3.5 pr-14 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-[rgba(34,114,222,0.3)] transition-colors"
            style={{ minHeight: "52px", maxHeight: "140px" }}
          />
          <button
            onClick={() => void handleSubmit()}
            disabled={sending || !draft.trim()}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl bg-accent-bright/20 hover:bg-accent-bright/30 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4 text-accent-bright" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-9.193-5.106A1 1 0 004 6.94v10.12a1 1 0 001.559.832l9.193-6.126a1 1 0 000-1.664z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
