"use client";

import { useState, useEffect } from "react";
import { usePush } from "@/lib/use-push";

const DISMISSED_KEY = "push-banner-dismissed";

export default function PushNotificationBanner() {
  const { permission, subscribed, subscribe } = usePush();
  const [dismissed, setDismissed] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Only show if not already granted/subscribed and not previously dismissed
    const wasDismissed = localStorage.getItem(DISMISSED_KEY) === "true";
    setDismissed(wasDismissed || permission === "granted" || subscribed);
  }, [permission, subscribed]);

  if (dismissed || permission === "granted" || subscribed) {
    return null;
  }

  const handleEnable = async () => {
    setLoading(true);
    await subscribe();
    setLoading(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setDismissed(true);
  };

  return (
    <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(12,12,18,0.6)] px-5 py-4">
      <div className="flex items-center gap-3 min-w-0">
        <svg
          className="w-5 h-5 text-accent-light flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        <p className="text-sm text-text-muted">
          Enable push notifications to stay updated on new content, sessions, and messages.
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={handleEnable}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-accent-primary text-white hover:bg-accent-light transition-colors disabled:opacity-50 cursor-pointer"
        >
          {loading ? "Enabling..." : "Enable Notifications"}
        </button>
        <button
          onClick={handleDismiss}
          className="p-1.5 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
