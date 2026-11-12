"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import InboxThread from "@/components/inbox/InboxThread";
import { Empty, Icon, SkeletonRows } from "@/components/ops/workspace/WorkspaceUI";
import { useToast } from "@/components/ui/Toast";
import type { Attachment, InboxConversation, InboxMessage } from "@/lib/types";

interface ThreadResponse {
  clientId: string;
  clientName: string;
  clientEmail: string;
  businessName: string | null;
  viewerUserId: string;
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
  const [markingUnread, setMarkingUnread] = useState(false);
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
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load inbox conversations.");
    } finally {
      setLoadingList(false);
    }
  }, []);

  async function uploadAttachments(files: FileList | File[]): Promise<Attachment[]> {
    if (!selectedClientId) {
      throw new Error("Choose a client before attaching files.");
    }

    const uploaded: Attachment[] = [];

    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("client_id", selectedClientId);

      const res = await fetch("/api/inbox/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to upload ${file.name}`);
      }

      const data = await res.json();
      uploaded.push(data.attachment);
    }

    return uploaded;
  }

  const loadThread = useCallback(async (clientId: string, markRead = false) => {
    setLoadingThread(true);
    try {
      const res = await fetch(`/api/inbox/thread?client_id=${encodeURIComponent(clientId)}`);
      if (!res.ok) throw new Error("Could not load conversation.");
      const data = (await res.json()) as ThreadResponse;
      setThread(data);
      setError(null);

      if (markRead) {
        const unreadMessageIds = data.messages
          .filter((message) => message.sender_role === "client" && !message.read_by_admin)
          .map((message) => message.id);

        if (unreadMessageIds.length > 0) {
          const readRes = await fetch("/api/inbox/read", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ client_id: clientId, read: true, message_ids: unreadMessageIds }),
          });

          if (!readRes.ok) throw new Error("Could not mark the conversation as read.");

          setThread((current) => current && current.clientId === clientId
            ? {
                ...current,
                messages: current.messages.map((message) =>
                  unreadMessageIds.includes(message.id) ? { ...message, read_by_admin: true } : message
                ),
              }
            : current
          );
          setConversations((current) => current.map((conversation) =>
            conversation.client_id === clientId ? { ...conversation, unread_count: 0 } : conversation
          ));
        }
      }
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
    void loadThread(selectedClientId, true);
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
    const current = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname;
    if (next !== current) {
      router.replace(next, { scroll: false });
    }
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

  async function handleToggleReaction(messageId: string, emoji: string) {
    if (!selectedClientId) return;

    try {
      const res = await fetch("/api/inbox/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_id: messageId, emoji }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update reaction.");
      }

      await loadThread(selectedClientId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update reaction.");
      throw err;
    }
  }

  async function handleMarkUnread() {
    if (!selectedClientId || !thread || markingUnread) return;

    const latestClientMessage = [...thread.messages]
      .reverse()
      .find((message) => message.sender_role === "client");

    if (!latestClientMessage) {
      toast("There are no client messages to mark unread", "error");
      return;
    }

    setMarkingUnread(true);
    setError(null);

    try {
      const res = await fetch("/api/inbox/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: selectedClientId,
          read: false,
          message_ids: [latestClientMessage.id],
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not mark this conversation as unread.");
      }

      setThread((current) => current
        ? {
            ...current,
            messages: current.messages.map((message) =>
              message.id === latestClientMessage.id ? { ...message, read_by_admin: false } : message
            ),
          }
        : current
      );
      setConversations((current) => current.map((conversation) =>
        conversation.client_id === selectedClientId
          ? { ...conversation, unread_count: Math.max(1, conversation.unread_count) }
          : conversation
      ));
      toast("Conversation marked unread");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not mark this conversation as unread.";
      setError(message);
      toast(message, "error");
    } finally {
      setMarkingUnread(false);
    }
  }

  function handleSelectConversation(clientId: string) {
    setSelectedClientId(clientId);
    setMobileThreadOpen(true);
  }

  const conversationList = (
    <section className="ws-panel ib-list" aria-label="Conversations">
      <div className="ws-panel-head">
        <h2 className="ws-h2">Conversations</h2>
        <span className="ws-caption">{conversations.length}</span>
      </div>
      <div className="ib-search">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search conversations..."
          aria-label="Search conversations"
          className="ws-input"
        />
      </div>
      <div className="ib-convos">
        {loadingList ? (
          <SkeletonRows count={4} />
        ) : filteredConversations.length === 0 ? (
          <Empty
            icon="inbox"
            title={query ? "No matching conversations" : "No conversations yet"}
            text={query ? "Try a client name, business or email address." : "Client messages will appear here when a conversation starts."}
          />
        ) : (
          filteredConversations.map((conversation) => {
            const selected = conversation.client_id === selectedClientId;
            const unread = conversation.unread_count > 0;
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
                aria-current={selected ? "true" : undefined}
                className={`ib-convo ws-focus${selected ? " is-on" : ""}${unread ? " is-unread" : ""}`}
              >
                <span className="ws-avatar is-md" aria-hidden="true">
                  {conversation.client_name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
                <span className="ib-convo-m">
                  <span className="ib-convo-top">
                    <span className="ib-convo-n">{conversation.client_name}</span>
                    <span className="ib-convo-w">{formatRelativeTime(conversation.latest_message_at)}</span>
                  </span>
                  <span className="ib-convo-e">{conversation.client_email}</span>
                  <span className="ib-convo-s">
                    <span className="ib-convo-p">{previewPrefix}</span>
                    {conversation.latest_message || "No messages yet"}
                  </span>
                </span>
                {unread ? (
                  <span className="ib-convo-ct">
                    {conversation.unread_count > 9 ? "9+" : conversation.unread_count}
                  </span>
                ) : (
                  <span className="ib-convo-ct is-none" aria-hidden="true" />
                )}
              </button>
            );
          })
        )}
      </div>
    </section>
  );

  const threadPane = selectedClientId ? (
    loadingThread && !thread ? (
      <SkeletonRows count={5} />
    ) : (
      <InboxThread
        messages={thread?.messages ?? []}
        currentRole="admin"
        currentUserId={thread?.viewerUserId}
        onSend={handleSend}
        sending={sending}
        error={error}
        emptyTitle="Start this conversation"
        emptyDescription="Send this client a message directly from Marc’s admin inbox."
        composerPlaceholder={`Message ${thread?.clientName || "client"}...`}
        allowAttachments
        allowVoiceNotes
        onUploadAttachments={uploadAttachments}
        attachmentHelpText="Attach PDFs, worksheets, spreadsheets, or other resources for this client."
        onEditMessage={handleEditMessage}
        onDeleteMessage={handleDeleteMessage}
        onToggleReaction={handleToggleReaction}
        scrollPageToLatest
      />
    )
  ) : (
    <div className="ib-pick">
      <Empty icon="inbox" title="Choose a conversation" text="Select a client to read their messages and reply." />
    </div>
  );

  const conversationHeader = (
    <div className="ib-conv-head">
      <span className="ws-avatar is-md" aria-hidden="true">
        {selectedConversation
          ? selectedConversation.client_name
              .split(" ")
              .map((part) => part[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()
          : <Icon name="inbox" size={13} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="ws-h2 ib-trunc">
          {selectedConversation?.client_name || "Select a conversation"}
        </div>
        <div className="ib-conv-meta">
          <span className="ib-trunc">{selectedConversation?.client_email || "Choose a client to view the thread."}</span>
          {selectedConversation?.latest_message_at && (
            <span className="ib-nowrap">Last activity {formatRelativeTime(selectedConversation.latest_message_at)}</span>
          )}
        </div>
      </div>
      {selectedClientId && (
        <button
          type="button"
          onClick={() => void handleMarkUnread()}
          disabled={markingUnread || !thread?.messages.some((message) => message.sender_role === "client")}
          className="ws-btn ws-focus shrink-0"
        >
          <Icon name="inbox" size={14} />
          {markingUnread ? "Marking..." : "Mark as unread"}
        </button>
      )}
    </div>
  );

  const conversationCard = (
    <section className="ws-panel ib-conv" aria-label="Conversation">
      {conversationHeader}
      {threadPane}
    </section>
  );

  return (
    <div className={`ws ws-page ib-page${mobileThreadOpen ? " is-thread-open" : ""}`}>
      <div className="ws-ph ib-title">
        <div className="min-w-0">
          <h1 className="ws-title">Inbox</h1>
          <p className="ws-meta mt-1">Manage client conversations from one place.</p>
        </div>
      </div>

      {error && !selectedClientId && (
        <div className="ws-note is-bad" role="alert">
          <Icon name="alert" size={15} />
          <div className="min-w-0">{error}</div>
        </div>
      )}

      <div className="xl:hidden ib-stack">
        {mobileThreadOpen ? (
          <>
            <div>
              <button
                onClick={() => setMobileThreadOpen(false)}
                className="ws-btn ws-btn-quiet ws-focus ib-back"
              >
                <Icon name="chevron" size={14} className="ib-back-ic" />
                Back to conversations
              </button>
            </div>
            {conversationCard}
          </>
        ) : (
          conversationList
        )}
      </div>

      <div className="hidden xl:grid ib-grid">
        {conversationList}
        {conversationCard}
      </div>
    </div>
  );
}
