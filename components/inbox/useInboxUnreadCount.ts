"use client";

import { useEffect, useState } from "react";

export function useInboxUnreadCount() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadUnreadCount() {
      try {
        const res = await fetch("/api/inbox/unread-count");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setUnreadCount(data.unreadCount || 0);
        }
      } catch {
        // Non-critical UI state
      }
    }

    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return unreadCount;
}
