"use client";

import { useCallback, useEffect, useState } from "react";
import type { InboxMessage } from "@/lib/types";
import InboxThread from "@/components/inbox/InboxThread";
import { useToast } from "@/components/ui/Toast";

interface ThreadResponse {
  clientId: string;
  clientName: string;
  clientEmail: string;
  businessName: string | null;
  messages: InboxMessage[];
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

  async function handleSend(message: string) {
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
        <div className="space-y-4">
          <div className="rounded-3xl border border-[rgba(255,255,255,0.05)] bg-[linear-gradient(180deg,rgba(34,114,222,0.08),rgba(255,255,255,0.02))] px-5 py-4">
            <div className="text-sm font-semibold text-text-primary">Conversation with Marc</div>
            <div className="text-xs text-text-muted mt-1">
              Use this space for questions, updates, blockers, or anything you need clarity on.
            </div>
          </div>

          <InboxThread
            messages={thread?.messages ?? []}
            currentRole="client"
            onSend={handleSend}
            sending={sending}
            error={error}
            threadLabel="Marc Watters"
            threadMeta="Direct support inside your portal"
            emptyTitle="Start the conversation"
            emptyDescription="If you need help, want to ask a question, or need clarity on your plan, send Marc a message here."
            composerPlaceholder="Message Marc..."
          />
        </div>
      )}
    </div>
  );
}
