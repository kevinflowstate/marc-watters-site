"use client";

import { useCallback, useEffect, useState } from "react";
import InboxThread from "@/components/inbox/InboxThread";
import { PageSkeleton } from "@/components/ui/PortalState";
import { useToast } from "@/components/ui/Toast";
import type { Attachment, InboxMessage } from "@/lib/types";

interface ThreadResponse {
  clientId: string;
  clientName: string;
  clientEmail: string;
  businessName: string | null;
  viewerUserId: string;
  messages: InboxMessage[];
}

interface SendPayload {
  message: string;
  attachments: Attachment[];
}

export default function ClientInboxClient() {
  const { toast } = useToast();
  const [thread, setThread] = useState<ThreadResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadThread = useCallback(async () => {
    try {
      const res = await fetch("/api/inbox/thread");
      if (!res.ok) {
        throw new Error("Could not load your inbox.");
      }
      const data = await res.json();
      setThread(data);
      setError(null);
      await fetch("/api/inbox/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your inbox.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadThread();
    const interval = setInterval(() => {
      void loadThread();
    }, 10000);
    return () => clearInterval(interval);
  }, [loadThread]);

  async function uploadAttachments(files: FileList | File[]): Promise<Attachment[]> {
    const uploaded: Attachment[] = [];

    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);

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

  async function handleSend({ message, attachments }: SendPayload) {
    setSending(true);
    setError(null);

    try {
      const res = await fetch("/api/inbox/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, attachments }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to send message.");
      }

      toast(attachments.length > 0 ? "Message and attachments sent" : "Message sent");
      await loadThread();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message.");
      toast("Failed to send message", "error");
      throw err;
    } finally {
      setSending(false);
    }
  }

  async function handleEditMessage(messageId: string, message: string) {
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
      await loadThread();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to edit message.");
      toast("Failed to edit message", "error");
      throw err;
    }
  }

  async function handleDeleteMessage(messageId: string) {
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
      await loadThread();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unsend message.");
      toast("Failed to unsend message", "error");
      throw err;
    }
  }

  async function handleToggleReaction(messageId: string, emoji: string) {
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

      await loadThread();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update reaction.");
      throw err;
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 sm:mb-8">
        <div className="v2-eyebrow mb-3">Direct support</div>
        <h1 className="v2-page-title">Inbox</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Message Marc directly from the portal.
        </p>
      </div>

      {loading ? (
        <PageSkeleton rows={5} />
      ) : (
        <div>
          <InboxThread
            messages={thread?.messages ?? []}
            currentRole="client"
            currentUserId={thread?.viewerUserId}
            onSend={handleSend}
            sending={sending}
            error={error}
            emptyTitle="Start the conversation"
            emptyDescription="If you need help, want to ask a question, or need clarity on your plan, send Marc a message here."
            composerPlaceholder="Message Marc..."
            allowAttachments
            onUploadAttachments={uploadAttachments}
            attachmentHelpText="Attach files or images for Marc to review."
            onEditMessage={handleEditMessage}
            onDeleteMessage={handleDeleteMessage}
            onToggleReaction={handleToggleReaction}
            scrollPageToLatest
          />
        </div>
      )}
    </div>
  );
}
