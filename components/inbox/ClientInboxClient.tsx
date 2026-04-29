"use client";

import { useCallback, useEffect, useState } from "react";
import InboxThread from "@/components/inbox/InboxThread";
import { useToast } from "@/components/ui/Toast";
import type { Attachment, InboxMessage } from "@/lib/types";

interface ThreadResponse {
  clientId: string;
  clientName: string;
  clientEmail: string;
  businessName: string | null;
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

  async function handleSend({ message }: SendPayload) {
    setSending(true);
    setError(null);

    try {
      const res = await fetch("/api/inbox/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to send message.");
      }

      toast("Message sent");
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

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-extrabold text-text-primary">Inbox</h1>
        <p className="text-sm text-text-secondary mt-1">
          Message Marc directly from the portal.
        </p>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)] px-6 py-12 text-sm text-text-muted">
          Loading inbox...
        </div>
      ) : (
        <div>
          <InboxThread
            messages={thread?.messages ?? []}
            currentRole="client"
            onSend={handleSend}
            sending={sending}
            error={error}
            emptyTitle="Start the conversation"
            emptyDescription="If you need help, want to ask a question, or need clarity on your plan, send Marc a message here."
            composerPlaceholder="Message Marc..."
            onEditMessage={handleEditMessage}
            onDeleteMessage={handleDeleteMessage}
            scrollPageToLatest
          />
        </div>
      )}
    </div>
  );
}
