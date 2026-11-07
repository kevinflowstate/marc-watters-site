"use client";

import { useEffect, useState, type ReactNode } from "react";
import AppShell from "@/components/shell/AppShell";
import { portalConfig } from "@/components/portal/portal-nav";
import NotificationsButton from "@/components/portal/NotificationsButton";
import { useInboxUnreadCount } from "@/components/inbox/useInboxUnreadCount";

export default function PortalChrome({ children }: { children: ReactNode }) {
  const inboxUnread = useInboxUnreadCount();
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/portal/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => {
        if (cancelled || !me) return;
        if (typeof me.fullName === "string") setName(me.fullName.trim());
        if (typeof me.avatarUrl === "string" && me.avatarUrl) setAvatarUrl(me.avatarUrl);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppShell
      config={portalConfig}
      counts={{ "/portal/inbox": inboxUnread }}
      userName={name}
      avatarUrl={avatarUrl}
      topbarExtra={<NotificationsButton />}
      className="portal-shell"
    >
      {children}
    </AppShell>
  );
}
