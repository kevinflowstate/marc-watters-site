"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  allowVoiceNotes?: boolean;
  onUploadAttachments?: (files: FileList | File[]) => Promise<Attachment[]>;
  attachmentHelpText?: string;
  onEditMessage?: (messageId: string, message: string) => Promise<void>;
  onDeleteMessage?: (messageId: string) => Promise<void>;
  scrollPageToLatest?: boolean;
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

function getSupportedAudioMimeType() {
  if (typeof MediaRecorder === "undefined") return "";

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/aac",
  ];

  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function getAudioExtension(mimeType: string) {
  if (mimeType.includes("mp4") || mimeType.includes("aac")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("wav")) return "wav";
  return "webm";
}

function formatAudioTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";

  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const remainingSeconds = wholeSeconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function VoiceNotePlayer({ attachment, isOwn }: { attachment: Attachment; isOwn: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    try {
      await audio.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  }

  function handleLoadedMetadata() {
    const audio = audioRef.current;
    if (!audio) return;

    setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
  }

  function handleSeek(event: React.ChangeEvent<HTMLInputElement>) {
    const nextTime = Number(event.target.value);
    const audio = audioRef.current;

    setCurrentTime(nextTime);
    if (audio) {
      audio.currentTime = nextTime;
    }
  }

  return (
    <div
      className={`min-w-[15rem] rounded-2xl border px-3 py-3 ${
        isOwn
          ? "border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.07)]"
          : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)]"
      }`}
    >
      <audio
        ref={audioRef}
        preload="metadata"
        src={attachment.url}
        onLoadedMetadata={handleLoadedMetadata}
        onDurationChange={handleLoadedMetadata}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(duration);
        }}
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void togglePlayback()}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors cursor-pointer ${
            isOwn
              ? "bg-accent-bright/25 text-accent-light hover:bg-accent-bright/35"
              : "bg-accent-bright/20 text-accent-bright hover:bg-accent-bright/30"
          }`}
          aria-label={isPlaying ? "Pause voice note" : "Play voice note"}
          title={isPlaying ? "Pause voice note" : "Play voice note"}
        >
          {isPlaying ? (
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 5h4v14H7V5zm6 0h4v14h-4V5z" />
            </svg>
          ) : (
            <svg className="ml-0.5 h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 5v14l11-7L8 5z" />
            </svg>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="truncate text-sm font-medium text-text-primary">Voice note</span>
            <span className={`shrink-0 text-[11px] tabular-nums ${isOwn ? "text-accent-light/75" : "text-text-muted"}`}>
              {formatAudioTime(currentTime)} / {duration > 0 ? formatAudioTime(duration) : "--:--"}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step="0.1"
            value={Math.min(currentTime, duration || currentTime)}
            onChange={handleSeek}
            disabled={!duration}
            aria-label="Voice note progress"
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full disabled:cursor-not-allowed disabled:opacity-50 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_0_0_3px_rgba(34,114,222,0.25)] [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white"
            style={{
              background: `linear-gradient(90deg, rgba(34,114,222,0.95) ${progress}%, rgba(255,255,255,0.18) ${progress}%)`,
            }}
          />
        </div>
      </div>
    </div>
  );
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
  allowVoiceNotes = false,
  onUploadAttachments,
  attachmentHelpText,
  onEditMessage,
  onDeleteMessage,
  scrollPageToLatest = false,
}: InboxThreadProps) {
  const [draft, setDraft] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [recordingVoiceNote, setRecordingVoiceNote] = useState(false);
  const [voiceNoteError, setVoiceNoteError] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState("");
  const [messageActionId, setMessageActionId] = useState<string | null>(null);
  const [messageActionError, setMessageActionError] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const latestMessageKey = messages.length > 0 ? messages[messages.length - 1].id : "empty";

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

  const scrollToLatest = useCallback(() => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    scrollArea.scrollTop = scrollArea.scrollHeight;

    if (scrollPageToLatest) {
      bottomRef.current?.scrollIntoView({ block: "end", inline: "nearest", behavior: "auto" });
    }
  }, [scrollPageToLatest]);

  useLayoutEffect(() => {
    requestAnimationFrame(() => {
      scrollToLatest();
      requestAnimationFrame(scrollToLatest);
    });
  }, [latestMessageKey, threadLabel, scrollToLatest]);

  useEffect(() => {
    const delays = [0, 50, 150, 300, 800, 1500];
    const timers = delays.map((delay) => window.setTimeout(scrollToLatest, delay));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [latestMessageKey, threadLabel, scrollToLatest]);

  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function handleSubmit() {
    const trimmed = draft.trim();
    if ((!trimmed && pendingAttachments.length === 0) || sending || uploadingAttachments || recordingVoiceNote) return;
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

  async function startVoiceRecording() {
    if (!allowVoiceNotes || !onUploadAttachments || recordingVoiceNote || uploadingAttachments) return;

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setVoiceNoteError("Voice notes are not supported in this browser.");
      return;
    }

    setVoiceNoteError(null);
    setAttachmentError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedAudioMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      audioChunksRef.current = [];
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setVoiceNoteError("Could not record this voice note.");
        setRecordingVoiceNote(false);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.onstop = () => {
        const recordedMimeType = recorder.mimeType || mimeType || "audio/webm";
        const chunks = audioChunksRef.current;
        audioChunksRef.current = [];
        mediaRecorderRef.current = null;
        mediaStreamRef.current = null;
        stream.getTracks().forEach((track) => track.stop());

        if (chunks.length === 0) {
          setVoiceNoteError("No audio was captured. Please try again.");
          return;
        }

        const blob = new Blob(chunks, { type: recordedMimeType });
        const extension = getAudioExtension(recordedMimeType);
        const file = new File([blob], `voice-note-${Date.now()}.${extension}`, { type: recordedMimeType });

        setUploadingAttachments(true);
        void onUploadAttachments([file])
          .then((uploaded) => {
            setPendingAttachments((current) => [...current, ...uploaded]);
            setVoiceNoteError(null);
          })
          .catch((err) => {
            setVoiceNoteError(err instanceof Error ? err.message : "Failed to upload voice note.");
          })
          .finally(() => {
            setUploadingAttachments(false);
          });
      };

      recorder.start();
      setRecordingVoiceNote(true);
    } catch (err) {
      setVoiceNoteError(err instanceof Error ? err.message : "Could not access the microphone.");
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }

  function stopVoiceRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    recorder.stop();
    setRecordingVoiceNote(false);
  }

  const composerError = attachmentError || voiceNoteError || messageActionError || error;
  const showPaperclip = allowAttachments && Boolean(onUploadAttachments);
  const showVoiceButton = allowVoiceNotes && Boolean(onUploadAttachments);
  const composerPadding = showPaperclip && showVoiceButton ? "pl-24" : showPaperclip || showVoiceButton ? "pl-14" : "pl-4";

  return (
    <div
      className={`flex flex-col rounded-3xl border border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)] overflow-hidden ${
        scrollPageToLatest ? "h-[calc(100svh-13rem)] min-h-[32rem]" : "min-h-[32rem]"
      }`}
    >
      {(threadLabel || threadMeta) && (
        <div className="border-b border-[rgba(255,255,255,0.05)] px-5 py-4 bg-[rgba(255,255,255,0.015)]">
          {threadLabel && <div className="text-sm font-semibold text-text-primary">{threadLabel}</div>}
          {threadMeta && <div className="text-xs text-text-muted mt-1">{threadMeta}</div>}
        </div>
      )}

      <div
        ref={scrollAreaRef}
        className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4"
      >
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
                          attachment.type === "audio" ? (
                            <VoiceNotePlayer key={attachment.id} attachment={attachment} isOwn={isOwn} />
                          ) : (
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
                          )
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
        {showPaperclip && (
          <div className="space-y-3">
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
        {(uploadingAttachments || recordingVoiceNote) && (
          <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted">
            {recordingVoiceNote && <span className="text-red-200">Recording voice note...</span>}
            {uploadingAttachments && !recordingVoiceNote && <span>Preparing upload...</span>}
          </div>
        )}
        <div className="relative">
          {showPaperclip && (
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.zip,.png,.jpg,.jpeg,.webp"
              onChange={(event) => void handleAttachmentChange(event)}
              disabled={uploadingAttachments || recordingVoiceNote}
              className="hidden"
            />
          )}
          {(showPaperclip || showVoiceButton) && (
            <div className="absolute left-3 top-1/2 z-10 flex -translate-y-1/2 items-center gap-1.5">
              {showPaperclip && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAttachments || recordingVoiceNote}
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-base transition-colors hover:bg-[rgba(255,255,255,0.06)] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                  aria-label="Attach file"
                  title={attachmentHelpText || "Attach file"}
                >
                  <span className="-translate-y-px" aria-hidden="true">📎</span>
                </button>
              )}
              {showVoiceButton && (
                <button
                  type="button"
                  onClick={() => (recordingVoiceNote ? stopVoiceRecording() : void startVoiceRecording())}
                  disabled={uploadingAttachments && !recordingVoiceNote}
                  className={`flex h-8 w-8 items-center justify-center rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${
                    recordingVoiceNote
                      ? "bg-red-500/15 text-red-200"
                      : "text-text-muted hover:bg-[rgba(255,255,255,0.06)] hover:text-text-primary"
                  }`}
                  aria-label={recordingVoiceNote ? "Stop recording voice note" : "Record voice note"}
                  title={recordingVoiceNote ? "Stop recording" : "Record voice note"}
                >
                  {recordingVoiceNote ? (
                    <span className="h-3 w-3 rounded-sm bg-red-300" aria-hidden="true" />
                  ) : (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11a7 7 0 01-14 0M12 18v3m-4 0h8" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          )}
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={composerPlaceholder}
            className={`w-full resize-none rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] py-4 pr-14 ${composerPadding} text-sm leading-5 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-[rgba(34,114,222,0.3)] transition-colors`}
            style={{ minHeight: "52px", maxHeight: "140px" }}
          />
          <button
            onClick={() => void handleSubmit()}
            disabled={sending || uploadingAttachments || recordingVoiceNote || (!draft.trim() && pendingAttachments.length === 0)}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl bg-accent-bright/20 hover:bg-accent-bright/30 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Send message"
            title="Send"
          >
            <svg className="w-4 h-4 -translate-y-px text-accent-bright" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-9.193-5.106A1 1 0 004 6.94v10.12a1 1 0 001.559.832l9.193-6.126a1 1 0 000-1.664z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
