"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatFileSize, guessAttachmentType } from "@/lib/attachments";
import InboxThread from "@/components/inbox/InboxThread";
import { useToast } from "@/components/ui/Toast";
import type { Attachment, InboxConversation, InboxMessage } from "@/lib/types";

interface ThreadResponse {
  clientId: string;
  clientName: string;
  clientEmail: string;
  businessName: string | null;
  messages: InboxMessage[];
}

interface ConversationResponse {
  conversations: InboxConversation[];
}

interface SendPayload {
  message: string;
  attachments: Attachment[];
}

function formatRelativeTime(timestamp: string | null) {
  if (!timestamp) return "";

  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));

  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Date(timestamp).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export default function AdminInboxClient() {
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialClientId = searchParams.get("client");
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(initialClientId);
  const [thread, setThread] = useState<ThreadResponse | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [mobileThreadOpen, setMobileThreadOpen] = useState(Boolean(initialClientId));

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.client_id === selectedClientId) ?? null,
    [conversations, selectedClientId],
  );

  const filteredConversations = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return conversations;

    return conversations.filter((conversation) => {
      const haystack = [
        conversation.client_name,
        conversation.client_email,
        conversation.business_name,
        conversation.latest_message,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(trimmed);
    });
  }, [conversations, query]);

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/inbox");
      if (!res.ok) throw new Error("Could not load inbox conversations.");
      const data = (await res.json()) as ConversationResponse;
      setConversations(data.conversations || []);
      setSelectedClientId((current) => current || data.conversations?.[0]?.client_id || null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load inbox conversations.");
    } finally {
      setLoadingList(false);
    }
  }, []);

  async function uploadAttachments(files: FileList | File[]): Promise<Attachment[]> {
    const uploaded: Attachment[] = [];

    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("bucket", "plan-documents");

      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to upload ${file.name}`);
      }

      const data = await res.json();
      uploaded.push({
        id: crypto.randomUUID(),
        name: data.fileName || file.name,
        url: data.url,
        type: guessAttachmentType(file.name, file.type),
        size: formatFileSize(file.size),
      });
    }

    return uploaded;
  }

  const loadThread = useCallback(async (clientId: string) => {
    setLoadingThread(true);
    try {
      const res = await fetch(`/api/inbox/thread?client_id=${encodeURIComponent(clientId)}`);
      if (!res.ok) throw new Error("Could not load conversation.");
      const data = (await res.json()) as ThreadResponse;
      setThread(data);
      setError(null);
      await fetch("/api/inbox/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load conversation.");
    } finally {
      setLoadingThread(false);
    }
  }, []);

  useEffect(() => {
    void loadConversations();
    const interval = setInterval(() => {
      void loadConversations();
    }, 10000);
    return () => clearInterval(interval);
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedClientId) return;
    void loadThread(selectedClientId);
    const interval = setInterval(() => {
      void loadThread(selectedClientId);
    }, 10000);
    return () => clearInterval(interval);
  }, [selectedClientId, loadThread]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (selectedClientId) {
      params.set("client", selectedClientId);
    } else {
      params.delete("client");
    }

    const next = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(next, { scroll: false });
  }, [pathname, router, searchParams, selectedClientId]);

  async function handleSend({ message, attachments }: SendPayload) {
    if (!selectedClientId) return;
    setSending(true);
    setError(null);

    try {
      const res = await fetch("/api/inbox/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: selectedClientId, message, attachments }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to send message.");
      }

      toast(attachments.length > 0 ? "Message and attachments sent" : "Message sent");
      await Promise.all([loadConversations(), loadThread(selectedClientId)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message.");
      toast("Failed to send message", "error");
      throw err;
    } finally {
      setSending(false);
    }
  }

  async function handleEditMessage(messageId: string, message: string) {
    if (!selectedClientId) return;
    setError(null);

    try {
      const res = await fetch("/api/inbox/message", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_id: messageId, message }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to edit message.");
      }

      toast("Message updated");
      await Promise.all([loadConversations(), loadThread(selectedClientId)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to edit message.");
      toast("Failed to edit message", "error");
      throw err;
    }
  }

  async function handleDeleteMessage(messageId: string) {
    if (!selectedClientId) return;
    setError(null);

    try {
      const res = await fetch("/api/inbox/message", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_id: messageId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to unsend message.");
      }

      toast("Message unsent");
      await Promise.all([loadConversations(), loadThread(selectedClientId)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unsend message.");
      toast("Failed to unsend message", "error");
      throw err;
    }
  }

  function handleSelectConversation(clientId: string) {
    setSelectedClientId(clientId);
    setMobileThreadOpen(true);
  }

  const conversationList = (
    <div className="rounded-3xl border border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)] overflow-hidden">
      <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.05)] space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-text-primary">Conversations</h2>
          <div className="text-xs text-text-muted">{conversations.length}</div>
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search conversations..."
          className="w-full rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.025)] px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-[rgba(34,114,222,0.3)]"
        />
      </div>
      <div className="max-h-[42rem] overflow-y-auto">
        {loadingList ? (
          <div className="px-5 py-10 text-sm text-text-muted">Loading conversations...</div>
        ) : filteredConversations.length === 0 ? (
          <div className="px-5 py-10 text-sm text-text-muted">No conversations yet.</div>
        ) : (
          filteredConversations.map((conversation) => {
            const selected = conversation.client_id === selectedClientId;
            const previewPrefix =
              conversation.latest_sender_role === "admin"
                ? "You: "
                : conversation.latest_sender_role === "client"
                  ? `${conversation.client_name.split(" ")[0]}: `
                  : "";
            return (
              <button
                key={conversation.client_id}
                onClick={() => handleSelectConversation(conversation.client_id)}
                className={`w-full text-left px-5 py-4 border-b border-[rgba(255,255,255,0.04)] transition-colors cursor-pointer ${
                  selected
                    ? "bg-[rgba(34,114,222,0.08)]"
                    : conversation.unread_count > 0
                      ? "bg-[rgba(255,255,255,0.015)] hover:bg-[rgba(255,255,255,0.04)]"
                      : "hover:bg-[rgba(255,255,255,0.03)]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] flex items-center justify-center text-xs font-bold text-text-primary">
                        {conversation.client_name
                          .split(" ")
                          .map((part) => part[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-text-primary truncate">{conversation.client_name}</div>
                          <div className="text-[11px] text-text-muted whitespace-nowrap">
                            {formatRelativeTime(conversation.latest_message_at)}
                          </div>
                        </div>
                        <div className="text-xs text-text-muted truncate">{conversation.client_email}</div>
                      </div>
                    </div>
                    <div className={`text-xs mt-3 line-clamp-2 ${conversation.unread_count > 0 ? "text-text-primary" : "text-text-secondary"}`}>
                      <span className="text-text-muted">{previewPrefix}</span>
                      {conversation.latest_message || "No messages yet"}
                    </div>
                  </div>
                  {conversation.unread_count > 0 && (
                    <span className="mt-0.5 bg-accent-bright text-white text-[10px] font-bold min-w-5 h-5 rounded-full px-1.5 flex items-center justify-center">
                      {conversation.unread_count > 9 ? "9+" : conversation.unread_count}
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  const threadPane = selectedClientId ? (
    loadingThread && !thread ? (
      <div className="rounded-3xl border border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)] px-6 py-12 text-sm text-text-muted">
        Loading conversation...
      </div>
    ) : (
      <InboxThread
        messages={thread?.messages ?? []}
        currentRole="admin"
        onSend={handleSend}
        sending={sending}
        error={error}
        threadLabel={thread?.clientName || selectedConversation?.client_name || "Conversation"}
        threadMeta={
          thread?.businessName
            ? `${thread.businessName}${thread.clientEmail ? ` • ${thread.clientEmail}` : ""}`
            : thread?.clientEmail || "Direct conversation"
        }
        emptyTitle="Start this conversation"
        emptyDescription="Send this client a message directly from Marc’s admin inbox."
        composerPlaceholder={`Message ${thread?.clientName || "client"}...`}
        allowAttachments
        onUploadAttachments={uploadAttachments}
        attachmentHelpText="Attach PDFs, worksheets, spreadsheets, or other resources for this client."
        onEditMessage={handleEditMessage}
        onDeleteMessage={handleDeleteMessage}
        scrollPageToLatest
      />
    )
  ) : (
    <div className="rounded-3xl border border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)] px-6 py-12 text-sm text-text-muted">
      No client selected.
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-extrabold text-text-primary">Inbox</h1>
        <p className="text-sm text-text-secondary mt-1">
          Manage client conversations from one place.
        </p>
      </div>

      <div className="xl:hidden space-y-4">
        {mobileThreadOpen ? (
          <>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileThreadOpen(false)}
                className="inline-flex items-center gap-2 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm text-text-primary cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to conversations
              </button>
            </div>
            <div className="rounded-3xl border border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)] px-5 py-4">
              <div className="text-sm font-semibold text-text-primary">
                {selectedConversation?.client_name || "Select a conversation"}
              </div>
              <div className="text-xs text-text-muted mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span>{selectedConversation?.client_email || "Choose a client to view the thread."}</span>
                {selectedConversation?.latest_message_at && (
                  <span>Last activity {formatRelativeTime(selectedConversation.latest_message_at)}</span>
                )}
              </div>
            </div>
            {threadPane}
          </>
        ) : (
          conversationList
        )}
      </div>

      <div className="hidden xl:grid xl:grid-cols-[24rem_minmax(0,1fr)] gap-6">
        {conversationList}

        <div className="space-y-4">
          <div className="rounded-3xl border border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)] px-5 py-4">
            <div className="text-sm font-semibold text-text-primary">
              {selectedConversation?.client_name || "Select a conversation"}
            </div>
            <div className="text-xs text-text-muted mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>{selectedConversation?.client_email || "Choose a client from the left to view the thread."}</span>
              {selectedConversation?.latest_message_at && (
                <span>Last activity {formatRelativeTime(selectedConversation.latest_message_at)}</span>
              )}
            </div>
          </div>
          {threadPane}
        </div>
      </div>
    </div>
  );
}
