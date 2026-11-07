"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  read: boolean;
  link?: string;
  created_at: string;
}

const bellIcon =
  "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9";

/** Topbar bell for client notifications: unread dot, popover list, marks read on open. */
export default function NotificationsButton() {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/notifications");
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.unreadCount);
          setNotifications(data.notifications);
        }
      } catch {
        // Notifications are non-critical.
      }
    }
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function markAsRead(ids: string[]) {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      setNotifications((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - ids.length));
    } catch {
      // Non-critical.
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unreadCount > 0) {
      const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
      if (unreadIds.length > 0) markAsRead(unreadIds);
    }
  }

  function select(n: NotificationItem) {
    if (!n.read) markAsRead([n.id]);
    if (n.link) router.push(n.link);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="adm-ibtn"
        onClick={toggle}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-expanded={open}
        title="Notifications"
      >
        <svg fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
          <path d={bellIcon} />
        </svg>
        {unreadCount > 0 && <span className="adm-ibtn-dot" aria-hidden="true" />}
      </button>
      {open && (
        <div className="adm-pop" role="menu" aria-label="Notifications">
          <div className="adm-pop-h">Notifications</div>
          {notifications.length === 0 ? (
            <div className="adm-pop-empty">Nothing new right now.</div>
          ) : (
            notifications.slice(0, 10).map((n) => (
              <button key={n.id} type="button" role="menuitem" className={`adm-pop-row${n.read ? "" : " is-unread"}`} onClick={() => select(n)}>
                <span className="adm-pop-dot" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="adm-pop-title">{n.title}</span>
                  <span className="adm-pop-msg">{n.message}</span>
                  <span className="adm-pop-time">
                    {new Date(n.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
