"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Attachment, InboxMessage } from "@/lib/types";

interface SendPayload {
  message: string;
  attachments: Attachment[];
}

interface InboxThreadProps {
  messages: InboxMessage[];
  currentRole: "admin" | "client";
  onSend: (payload: SendPayload) => Promise<void>;
  sending: boolean;
  error: string | null;
  emptyTitle: string;
  emptyDescription: string;
  threadLabel?: string;
  threadMeta?: string;
  composerPlaceholder?: string;
  allowAttachments?: boolean;
  onUploadAttachments?: (files: FileList | File[]) => Promise<Attachment[]>;
  attachmentHelpText?: string;
  onEditMessage?: (messageId: string, message: string) => Promise<void>;
  onDeleteMessage?: (messageId: string) => Promise<void>;
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
  allowAttachments = false,
  onUploadAttachments,
  attachmentHelpText,
  onEditMessage,
  onDeleteMessage,
}: InboxThreadProps) {
  const [draft, setDraft] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState("");
  const [messageActionId, setMessageActionId] = useState<string | null>(null);
  const [messageActionError, setMessageActionError] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    requestAnimationFrame(() => {
      scrollArea.scrollTop = scrollArea.scrollHeight;
      bottomRef.current?.scrollIntoView({ block: "end" });
    });
  }, [messages.length, threadLabel]);

  async function handleSubmit() {
    const trimmed = draft.trim();
    if ((!trimmed && pendingAttachments.length === 0) || sending || uploadingAttachments) return;
    await onSend({ message: trimmed, attachments: pendingAttachments });
    setDraft("");
    setPendingAttachments([]);
    setAttachmentError(null);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    const isTouchKeyboard =
      typeof window !== "undefined" &&
      (window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0);

    if (event.key === "Enter" && !event.shiftKey && !isTouchKeyboard) {
      event.preventDefault();
      void handleSubmit();
    }
  }

  function startEditing(message: InboxMessage) {
    setEditingMessageId(message.id);
    setEditingDraft(message.message);
    setMessageActionError(null);
  }

  async function submitEdit(message: InboxMessage) {
    if (!onEditMessage || messageActionId) return;

    const trimmed = editingDraft.trim();
    if (!trimmed && (!message.attachments || message.attachments.length === 0)) return;

    setMessageActionId(message.id);
    setMessageActionError(null);

    try {
      await onEditMessage(message.id, trimmed);
      setEditingMessageId(null);
      setEditingDraft("");
    } catch (err) {
      setMessageActionError(err instanceof Error ? err.message : "Could not edit message.");
    } finally {
      setMessageActionId(null);
    }
  }

  async function handleDelete(messageId: string) {
    if (!onDeleteMessage || messageActionId) return;
    if (!window.confirm("Unsend this message?")) return;

    setMessageActionId(messageId);
    setMessageActionError(null);

    try {
      await onDeleteMessage(messageId);
      if (editingMessageId === messageId) {
        setEditingMessageId(null);
        setEditingDraft("");
      }
    } catch (err) {
      setMessageActionError(err instanceof Error ? err.message : "Could not unsend message.");
    } finally {
      setMessageActionId(null);
    }
  }

  async function handleAttachmentChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files?.length || !onUploadAttachments) return;

    setUploadingAttachments(true);
    setAttachmentError(null);

    try {
      const uploaded = await onUploadAttachments(files);
      setPendingAttachments((current) => [...current, ...uploaded]);
    } catch (err) {
      setAttachmentError(err instanceof Error ? err.message : "Failed to upload attachment.");
    } finally {
      setUploadingAttachments(false);
      event.target.value = "";
    }
  }

  const composerError = attachmentError || messageActionError || error;

  return (
    <div className="flex flex-col min-h-[32rem] rounded-3xl border border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)] overflow-hidden">
      {(threadLabel || threadMeta) && (
        <div className="border-b border-[rgba(255,255,255,0.05)] px-5 py-4 bg-[rgba(255,255,255,0.015)]">
          {threadLabel && <div className="text-sm font-semibold text-text-primary">{threadLabel}</div>}
          {threadMeta && <div className="text-xs text-text-muted mt-1">{threadMeta}</div>}
        </div>
      )}

      <div ref={scrollAreaRef} className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
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
                    {message.reply_context && (
                      <a
                        href={message.reply_context.href || "#"}
                        className={`mt-3 block rounded-xl border-l-4 px-3 py-2 no-underline ${
                          isOwn
                            ? "border-accent-bright bg-[rgba(255,255,255,0.08)]"
                            : "border-accent-bright bg-[rgba(34,114,222,0.08)]"
                        }`}
                      >
                        <div className="text-xs font-semibold text-accent-bright">
                          {message.reply_context.title}
                        </div>
                        <div className="mt-1 line-clamp-3 text-sm leading-relaxed text-text-secondary">
                          {message.reply_context.body}
                        </div>
                      </a>
                    )}
                    {editingMessageId === message.id ? (
                      <div className="mt-3 space-y-2">
                        <textarea
                          value={editingDraft}
                          onChange={(event) => setEditingDraft(event.target.value)}
                          rows={3}
                          className="w-full resize-none rounded-xl border border-[rgba(255,255,255,0.1)] bg-bg-primary/70 px-3 py-2 text-sm leading-relaxed text-text-primary placeholder:text-text-muted focus:outline-none focus:border-[rgba(34,114,222,0.35)]"
                        />
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMessageId(null);
                              setEditingDraft("");
                            }}
                            className="rounded-lg px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:text-text-primary"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => void submitEdit(message)}
                            disabled={messageActionId === message.id || (!editingDraft.trim() && (!message.attachments || message.attachments.length === 0))}
                            className="rounded-lg bg-accent-bright/20 px-3 py-1.5 text-xs font-semibold text-accent-bright transition-colors hover:bg-accent-bright/30 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {messageActionId === message.id ? "Saving..." : "Save"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      message.message.trim() && (
                        <div className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">{message.message}</div>
                      )
                    )}
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {message.attachments.map((attachment) => (
                          <a
                            key={attachment.id}
                            href={attachment.url}
                            target="_blank"
                            rel="noreferrer"
                            className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 transition-colors ${
                              isOwn
                                ? "border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.1)]"
                                : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.025)] hover:bg-[rgba(255,255,255,0.05)]"
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-text-primary">{attachment.name}</div>
                              <div className={`text-[11px] ${isOwn ? "text-accent-light/70" : "text-text-muted"}`}>
                                {attachment.type.toUpperCase()}
                                {attachment.size ? ` • ${attachment.size}` : ""}
                              </div>
                            </div>
                            <span className={`shrink-0 text-[11px] font-semibold ${isOwn ? "text-accent-light" : "text-accent-bright"}`}>
                              Download
                            </span>
                          </a>
                        ))}
                      </div>
                    )}
                    <div className={`mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] ${isOwn ? "text-accent-light/70" : "text-text-muted"}`}>
                      <span>{formatTime(message.created_at)}</span>
                      {isOwn && editingMessageId !== message.id && (onEditMessage || onDeleteMessage) && (
                        <span className="flex items-center gap-2">
                          {onEditMessage && (
                            <button
                              type="button"
                              onClick={() => startEditing(message)}
                              disabled={messageActionId === message.id}
                              className="font-medium transition-colors hover:text-text-primary disabled:opacity-50"
                            >
                              Edit
                            </button>
                          )}
                          {onDeleteMessage && (
                            <button
                              type="button"
                              onClick={() => void handleDelete(message.id)}
                              disabled={messageActionId === message.id}
                              className="font-medium transition-colors hover:text-red-300 disabled:opacity-50"
                            >
                              {messageActionId === message.id ? "Removing..." : "Unsend"}
                            </button>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} aria-hidden="true" />
      </div>

      <div className="border-t border-[rgba(255,255,255,0.05)] p-4 space-y-3">
        {composerError && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {composerError}
          </div>
        )}
        {allowAttachments && onUploadAttachments && (
          <div className="space-y-3">
            <div>
              <input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.zip,.png,.jpg,.jpeg,.webp"
                onChange={(event) => void handleAttachmentChange(event)}
                className="w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-4 py-3 text-sm text-text-primary file:mr-4 file:rounded-lg file:border-0 file:bg-accent-bright/15 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-accent-bright"
              />
              {attachmentHelpText && <p className="mt-2 text-xs text-text-muted">{attachmentHelpText}</p>}
              {uploadingAttachments && <p className="mt-2 text-xs text-text-muted">Uploading attachments...</p>}
            </div>
            {pendingAttachments.length > 0 && (
              <div className="space-y-2">
                {pendingAttachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center gap-3 rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-text-primary">{attachment.name}</div>
                      <div className="text-xs text-text-muted">
                        {attachment.type.toUpperCase()}
                        {attachment.size ? ` • ${attachment.size}` : ""}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingAttachments((current) => current.filter((item) => item.id !== attachment.id));
                        setAttachmentError(null);
                      }}
                      className="text-xs text-text-muted transition-colors hover:text-red-400 cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
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
            disabled={sending || uploadingAttachments || (!draft.trim() && pendingAttachments.length === 0)}
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
