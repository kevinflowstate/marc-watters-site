"use client";

import { useEffect, useState, type ReactNode } from "react";
import AppShell from "@/components/shell/AppShell";
import { adminConfig, operatorConfig } from "@/components/admin/admin-nav";
import { useInboxUnreadCount } from "@/components/inbox/useInboxUnreadCount";
import { useWorkspaceDecideCount } from "@/components/ops/workspace/useWorkspaceDecideCount";
import { useManagementRole } from "@/components/admin/useManagementRole";

export default function AdminChrome({ children }: { children: ReactNode }) {
  const inboxUnread = useInboxUnreadCount();
  const decideCount = useWorkspaceDecideCount();
  const role = useManagementRole();
  const [name, setName] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/portal/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => {
        if (!cancelled && me && typeof me.fullName === "string") setName(me.fullName.trim());
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const config = role === "growth_operator" ? operatorConfig : adminConfig;
  const counts = { "/admin/work": decideCount, "/admin/inbox": inboxUnread };

  return (
    <AppShell config={config} counts={counts} userName={name}>
      {children}
    </AppShell>
  );
}
