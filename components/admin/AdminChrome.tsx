"use client";

import { useEffect, useState, type ReactNode } from "react";
import AppShell from "@/components/shell/AppShell";
import { adminConfig, operatorConfig } from "@/components/admin/admin-nav";
import { useInboxUnreadCount } from "@/components/inbox/useInboxUnreadCount";
import { useWorkspaceDecideCount } from "@/components/ops/workspace/useWorkspaceDecideCount";
import { useManagementRole } from "@/components/admin/useManagementRole";
import { useLeadsNav } from "@/components/leads/useLeadsNav";
import type { ShellConfig } from "@/components/shell/nav";

export default function AdminChrome({ children }: { children: ReactNode }) {
  const inboxUnread = useInboxUnreadCount();
  const decideCount = useWorkspaceDecideCount();
  const role = useManagementRole();
  const leads = useLeadsNav();
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

  const base = role === "growth_operator" ? operatorConfig : adminConfig;
  // The Leads tab only shows for admins it has been switched on for.
  const config: ShellConfig = leads.access
    ? base
    : { ...base, sections: base.sections.map((s) => ({ ...s, items: s.items.filter((i) => i.href !== "/admin/leads") })) };
  const counts = { "/admin/work": decideCount, "/admin/inbox": inboxUnread, "/admin/leads": leads.waiting };

  return (
    <AppShell config={config} counts={counts} userName={name}>
      {children}
    </AppShell>
  );
}
