"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "@/components/portal/ThemeToggle";
import { useInboxUnreadCount } from "@/components/inbox/useInboxUnreadCount";
import { useManagementRole } from "@/components/admin/useManagementRole";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" },
  { href: "/admin/clients", label: "Clients", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
  { href: "/admin/business-plans", label: "Business Plans", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" },
  { href: "/admin/training", label: "Training", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
  { href: "/admin/inbox", label: "Inbox", icon: "M8 10h8m-8 4h5m-7 6h12a2 2 0 002-2V8a2 2 0 00-.586-1.414l-4-4A2 2 0 0014 2H6a2 2 0 00-2 2v14a2 2 0 002 2z" },
  { href: "/admin/calendar", label: "Calendar", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
  { href: "/admin/ai", label: "Blueprint AI", icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" },
  { href: "/admin/growth-engine", label: "CBB Growth Engine", icon: "M4 19V9m5 10V5m5 14v-7m5 7V3M3 19h18" },
  { href: "/admin/settings", label: "Settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const inboxUnreadCount = useInboxUnreadCount();
  const role = useManagementRole();
  const visibleNavItems = role === "admin"
    ? navItems
    : navItems.filter((item) => item.href === "/admin/growth-engine");
  const homeHref = role === "admin" ? "/admin" : "/admin/growth-engine";
  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <>
      <aside className="portal-v2-sidebar hidden lg:flex fixed top-0 left-0 h-full w-[260px] backdrop-blur-[20px] z-50 flex-col">
        <div className="px-5 py-6 border-b border-[rgba(255,255,255,0.06)]">
          <Link href={homeHref} className="flex items-center gap-3 no-underline">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-accent/20 bg-accent/8">
              <Image src="/images/cbb-logo.png" alt="CBB" width={30} height={30} className="h-7 w-auto" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">Construction Business</div>
              <div className="font-heading text-sm font-extrabold text-text-primary">
                {role === "growth_operator" ? "Growth Engine" : "Blueprint Admin"}
              </div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-5 flex flex-col gap-1.5" aria-label="Admin portal">
          {visibleNavItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`portal-v2-nav-item ${isActive ? "is-active" : ""} flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium no-underline transition-all duration-200 ${
                  isActive
                    ? "bg-[rgba(34,114,222,0.11)] text-accent-bright border-accent/20"
                    : "text-text-secondary hover:text-text-primary hover:bg-[rgba(255,255,255,0.035)] hover:border-[rgba(255,255,255,0.05)]"
                }`}
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                </svg>
                <span>{item.label}</span>
                {item.href === "/admin/inbox" && inboxUnreadCount > 0 && (
                  <span className="ml-auto bg-accent-bright text-white text-[10px] font-bold min-w-5 h-5 rounded-full px-1.5 flex items-center justify-center">
                    {inboxUnreadCount > 9 ? "9+" : inboxUnreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[rgba(255,255,255,0.04)]">
          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-xs text-text-muted">Theme</span>
            <ThemeToggle />
          </div>
          <Link href="/" className="block px-4 py-2 text-xs text-text-muted hover:text-text-secondary transition-colors no-underline">
            View Public Site
          </Link>
          <button onClick={handleSignOut} className="w-full mt-1 px-4 py-2 text-xs text-text-muted hover:text-red-400 transition-colors text-left cursor-pointer">
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
