"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import PushNotificationBanner from "@/components/portal/PushNotificationBanner";
import { ToastProvider } from "@/components/ui/Toast";
import ShellSidebar from "@/components/shell/ShellSidebar";
import ShellTopbar from "@/components/shell/ShellTopbar";
import ShellMobileNav from "@/components/shell/ShellMobileNav";
import type { ShellConfig } from "@/components/shell/nav";

/**
 * The flat product shell shared by /admin and /portal: 240px sidebar,
 * 46px topbar with crumb and theme toggle, phone bottom nav, .adm-page content.
 * Tokens and overrides live under `.portal-v2-shell.admin-shell` in globals.css.
 */
export default function AppShell({
  config,
  counts,
  userName,
  avatarUrl,
  topbarExtra,
  className,
  children,
}: {
  config: ShellConfig;
  counts: Record<string, number>;
  userName: string;
  avatarUrl?: string | null;
  topbarExtra?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
  }

  return (
    <div className={`portal-v2-shell admin-shell${className ? ` ${className}` : ""}`}>
      <ToastProvider>
        <ShellSidebar config={config} counts={counts} userName={userName} avatarUrl={avatarUrl} onSignOut={signOut} />
        <div className="adm-main">
          <ShellTopbar config={config} extra={topbarExtra} />
          <main className="adm-content">
            <div className="portal-v2-content adm-page">
              <PushNotificationBanner />
              {children}
            </div>
          </main>
        </div>
        <ShellMobileNav config={config} counts={counts} onSignOut={signOut} />
      </ToastProvider>
    </div>
  );
}
