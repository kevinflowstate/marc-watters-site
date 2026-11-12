"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Empty, Icon } from "@/components/ops/workspace/WorkspaceUI";
import type { Attachment, InboxMessage } from "@/lib/types";

interface SendPayload {
  message: string;
  attachments: Attachment[];
}

interface InboxThreadProps {
  messages: InboxMessage[];
  currentRole: "admin" | "client";
  currentUserId?: string;
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
  onToggleReaction?: (messageId: string, emoji: string) => Promise<void>;
  scrollPageToLatest?: boolean;
  /** Rendered at the top of the composer (admin reply draft card). */
  composerTop?: ReactNode;
  /** Replace the composer text when `key` changes (Edit on a reply draft). */
  prefill?: { text: string; key: string } | null;
}

const reactionOptions = ["👍", "❤️", "😂", "😮", "😢", "🙏", "👏"];

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
    <div className={`ib-voice${isOwn ? " is-own" : ""}`}>
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
      <button
        type="button"
        onClick={() => void togglePlayback()}
        className="ib-voice-play ws-focus"
        aria-label={isPlaying ? "Pause voice note" : "Play voice note"}
        title={isPlaying ? "Pause voice note" : "Play voice note"}
      >
        {isPlaying ? (
          <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 5h4v14H7V5zm6 0h4v14h-4V5z" />
          </svg>
        ) : (
          <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true" style={{ marginLeft: 2 }}>
            <path d="M8 5v14l11-7L8 5z" />
          </svg>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="ib-voice-top">
          <span className="ib-voice-l">Voice note</span>
          <span className="ib-voice-t">
            {formatAudioTime(currentTime)} / {duration > 0 ? formatAudioTime(duration) : "--:--"}
          </span>
        </div>
        <div className="ib-range">
          <span className="ib-range-track" aria-hidden="true">
            <i style={{ width: `${progress}%` }} />
          </span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step="0.1"
            value={Math.min(currentTime, duration || currentTime)}
            onChange={handleSeek}
            disabled={!duration}
            aria-label="Voice note progress"
            className="ib-range-input"
          />
        </div>
      </div>
    </div>
  );
}

export default function InboxThread({
  messages,
  currentRole,
  currentUserId,
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
  onToggleReaction,
  scrollPageToLatest = false,
  composerTop,
  prefill,
}: InboxThreadProps) {
  const [draft, setDraft] = useState("");
  const prefillKey = prefill?.key;
  const prefillText = prefill?.text;
  useEffect(() => {
    if (prefillKey && typeof prefillText === "string") setDraft(prefillText);
  }, [prefillKey, prefillText]);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [recordingVoiceNote, setRecordingVoiceNote] = useState(false);
  const [voiceNoteError, setVoiceNoteError] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState("");
  const [messageActionId, setMessageActionId] = useState<string | null>(null);
  const [messageActionError, setMessageActionError] = useState<string | null>(null);
  const [reactionActionKey, setReactionActionKey] = useState<string | null>(null);
  const [openReactionPickerMessageId, setOpenReactionPickerMessageId] = useState<string | null>(null);
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

  useEffect(() => {
    if (!openReactionPickerMessageId) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-reaction-picker-root]")) return;
      setOpenReactionPickerMessageId(null);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenReactionPickerMessageId(null);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [openReactionPickerMessageId]);

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

  async function handleToggleReaction(messageId: string, emoji: string) {
    if (!onToggleReaction || reactionActionKey) return;

    const actionKey = `${messageId}:${emoji}`;
    setReactionActionKey(actionKey);
    setMessageActionError(null);

    try {
      await onToggleReaction(messageId, emoji);
    } catch (err) {
      setMessageActionError(err instanceof Error ? err.message : "Could not update reaction.");
    } finally {
      setReactionActionKey(null);
    }
  }

  async function handlePickReaction(messageId: string, emoji: string) {
    await handleToggleReaction(messageId, emoji);
    setOpenReactionPickerMessageId(null);
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
  const composerPadding = showPaperclip && showVoiceButton ? "has-2" : showPaperclip || showVoiceButton ? "has-1" : "";
  const viewportHeight = !scrollPageToLatest
    ? "min-h-[32rem]"
    : currentRole === "admin"
      ? "h-[calc(100svh-18rem)] min-h-[22rem] lg:h-[calc(100svh-16rem)] lg:min-h-[28rem] xl:h-[calc(100svh-17.5rem)]"
      : "h-[calc(100svh-15rem)] min-h-[26rem] lg:h-[calc(100svh-14rem)] lg:min-h-[30rem]";

  return (
    <div
      className={`portal-v2-inbox-thread ib-thread ${viewportHeight}`}
    >
      {(threadLabel || threadMeta) && (
        <div className="ib-thread-label">
          {threadLabel && <div className="ws-h2">{threadLabel}</div>}
          {threadMeta && <div className="ws-caption mt-0.5">{threadMeta}</div>}
        </div>
      )}

      <div
        ref={scrollAreaRef}
        className="ib-scroll"
      >
        {groupedMessages.length === 0 ? (
          <div className="ib-thread-empty">
            <Empty icon="chat" title={emptyTitle} text={emptyDescription} />
          </div>
        ) : (
          groupedMessages.map((message) => {
            const isOwn = message.sender_role === currentRole;
            const reactionGroups = Array.from(new Set((message.reactions ?? []).map((reaction) => reaction.emoji)))
              .sort((first, second) => {
                const firstIndex = reactionOptions.indexOf(first);
                const secondIndex = reactionOptions.indexOf(second);

                if (firstIndex === -1 && secondIndex === -1) return first.localeCompare(second);
                if (firstIndex === -1) return 1;
                if (secondIndex === -1) return -1;
                return firstIndex - secondIndex;
              })
              .map((emoji) => {
                const reactions = (message.reactions ?? []).filter((reaction) => reaction.emoji === emoji);
                return {
                  emoji,
                  reactions,
                  reacted: Boolean(currentUserId && reactions.some((reaction) => reaction.user_id === currentUserId)),
                };
              });

            return (
              <div key={message.id} className="ib-item">
                {message.showDayDivider && (
                  <div className="ib-day">
                    <span>{message.dayLabel}</span>
                  </div>
                )}

                <div className={`ib-msg${isOwn ? " is-own" : ""}`}>
                  <div className="ib-msg-inner">
                    <div className="ib-msg-col">
                      <div className="ib-bubble">
                        <div className="ib-sender">
                          {isOwn ? "You" : otherPartyLabel}
                        </div>
                        {message.reply_context && (
                          <a
                            href={message.reply_context.href || "#"}
                            className="ib-reply ws-focus"
                          >
                            <div className="ib-reply-t">
                              {message.reply_context.title}
                            </div>
                            <div className="ib-reply-b">
                              {message.reply_context.body}
                            </div>
                          </a>
                        )}
                        {editingMessageId === message.id ? (
                          <div className="ib-edit">
                            <textarea
                              value={editingDraft}
                              onChange={(event) => setEditingDraft(event.target.value)}
                              rows={3}
                              className="ws-input ib-edit-input"
                            />
                            <div className="ib-edit-acts">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingMessageId(null);
                                  setEditingDraft("");
                                }}
                                className="ws-btn ws-btn-quiet ws-btn-sm ws-focus"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => void submitEdit(message)}
                                disabled={messageActionId === message.id || (!editingDraft.trim() && (!message.attachments || message.attachments.length === 0))}
                                className="ws-btn ws-btn-primary ws-btn-sm ws-focus"
                              >
                                {messageActionId === message.id ? "Saving..." : "Save"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          message.message.trim() && (
                            <div className="ib-text">{message.message}</div>
                          )
                        )}
                        {message.attachments && message.attachments.length > 0 && (
                          <div className="ib-atts">
                            {message.attachments.map((attachment) => (
                              attachment.type === "audio" ? (
                                <VoiceNotePlayer key={attachment.id} attachment={attachment} isOwn={isOwn} />
                              ) : (
                                <a
                                  key={attachment.id}
                                  href={attachment.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="ib-att ws-focus"
                                >
                                  <div className="min-w-0">
                                    <div className="ib-att-n">{attachment.name}</div>
                                    <div className="ib-att-m">
                                      {attachment.type.toUpperCase()}
                                      {attachment.size ? ` • ${attachment.size}` : ""}
                                    </div>
                                  </div>
                                  <span className="ib-att-dl">
                                    Download
                                  </span>
                                </a>
                              )
                            ))}
                          </div>
                        )}
                        <div className="ib-foot">
                          <span>{formatTime(message.created_at)}</span>
                          {isOwn && editingMessageId !== message.id && (onEditMessage || onDeleteMessage) && (
                            <span className="ib-foot-acts">
                              {onEditMessage && (
                                <button
                                  type="button"
                                  onClick={() => startEditing(message)}
                                  disabled={messageActionId === message.id}
                                  className="ib-textbtn ws-focus"
                                >
                                  Edit
                                </button>
                              )}
                              {onDeleteMessage && (
                                <button
                                  type="button"
                                  onClick={() => void handleDelete(message.id)}
                                  disabled={messageActionId === message.id}
                                  className="ib-textbtn is-bad ws-focus"
                                >
                                  {messageActionId === message.id ? "Removing..." : "Unsend"}
                                </button>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                      {reactionGroups.length > 0 && (
                        <div className="ib-reacts">
                          {reactionGroups.map(({ emoji, reactions, reacted }) => {
                            const actionKey = `${message.id}:${emoji}`;
                            const label = reactions.map((reaction) => reaction.user_name || "Someone").join(", ");

                            return (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => void handleToggleReaction(message.id, emoji)}
                                disabled={!onToggleReaction || reactionActionKey === actionKey}
                                title={label}
                                className={`ib-react ws-focus${reacted ? " is-on" : ""}`}
                                aria-label={`${reacted ? "Remove" : "Add"} ${emoji} reaction`}
                              >
                                <span aria-hidden="true">{emoji}</span>
                                {reactions.length > 1 && <span>{reactions.length}</span>}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    {onToggleReaction && (
                      <div
                        data-reaction-picker-root
                        className="ib-react-root"
                      >
                        {openReactionPickerMessageId === message.id && (
                          <div className="ib-picker">
                            {reactionOptions.map((emoji) => {
                              const actionKey = `${message.id}:${emoji}`;

                              return (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => void handlePickReaction(message.id, emoji)}
                                  disabled={reactionActionKey === actionKey}
                                  className="ib-pick-btn ws-focus"
                                  aria-label={`React ${emoji}`}
                                >
                                  <span aria-hidden="true">{emoji}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setOpenReactionPickerMessageId((current) => (current === message.id ? null : message.id))
                          }
                          className={`ib-react-btn ws-focus${openReactionPickerMessageId === message.id ? " is-open" : ""}`}
                          aria-expanded={openReactionPickerMessageId === message.id}
                          aria-label="React to message"
                          title="React"
                        >
                          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 21a9 9 0 100-18 9 9 0 000 18z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 10h.01M15 10h.01M8.5 14.5a5 5 0 007 0" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} aria-hidden="true" />
      </div>

      <div className="ib-composer">
        {composerTop}
        {composerError && (
          <div className="ws-note is-bad" role="alert">
            <Icon name="alert" size={15} />
            <div className="min-w-0">{composerError}</div>
          </div>
        )}
        {showPaperclip && (
          <div>
            {pendingAttachments.length > 0 && (
              <div className="ib-pending-list">
                {pendingAttachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="ib-pending"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="ib-att-n">{attachment.name}</div>
                      <div className="ib-att-m">
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
                      className="ib-textbtn is-bad ws-focus"
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
          <div className="ib-status">
            {recordingVoiceNote && <span className="is-rec">Recording voice note...</span>}
            {uploadingAttachments && !recordingVoiceNote && <span>Preparing upload...</span>}
          </div>
        )}
        <div className="ib-input-wrap">
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
            <div className="ib-tools">
              {showPaperclip && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAttachments || recordingVoiceNote}
                  className="ib-tool ws-focus"
                  aria-label="Attach file"
                  title={attachmentHelpText || "Attach file"}
                >
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m20.5 11.5-8.3 8.3a5.3 5.3 0 0 1-7.5-7.5l8.3-8.3a3.5 3.5 0 0 1 5 5l-8.3 8.3a1.8 1.8 0 0 1-2.5-2.5l7.6-7.6" />
                  </svg>
                </button>
              )}
              {showVoiceButton && (
                <button
                  type="button"
                  onClick={() => (recordingVoiceNote ? stopVoiceRecording() : void startVoiceRecording())}
                  disabled={uploadingAttachments && !recordingVoiceNote}
                  className={`ib-tool ws-focus${recordingVoiceNote ? " is-rec" : ""}`}
                  aria-label={recordingVoiceNote ? "Stop recording voice note" : "Record voice note"}
                  title={recordingVoiceNote ? "Stop recording" : "Record voice note"}
                >
                  {recordingVoiceNote ? (
                    <span className="ib-rec-stop" aria-hidden="true" />
                  ) : (
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
            aria-label={composerPlaceholder}
            className={`ib-textarea ${composerPadding}`}
            style={{ minHeight: "46px", maxHeight: "140px" }}
          />
          <button
            onClick={() => void handleSubmit()}
            disabled={sending || uploadingAttachments || recordingVoiceNote || (!draft.trim() && pendingAttachments.length === 0)}
            className="ib-send ws-focus"
            aria-label="Send message"
            title="Send"
          >
            <Icon name="send" size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
