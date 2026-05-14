"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useInboxUnreadCount } from "@/components/inbox/useInboxUnreadCount";

const items = [
  { href: "/portal", label: "Home", icon: "M3.75 11.25 12 4l8.25 7.25M5.75 10.5V20h4.5v-5.25h3.5V20h4.5v-9.5" },
  { href: "/portal/calendar", label: "Calendar", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
  { href: "/portal/checkin", label: "Check-In", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
  { href: "/portal/inbox", label: "Inbox", icon: "M8 10h8m-8 4h5m-7 6h12a2 2 0 002-2V8a2 2 0 00-.586-1.414l-4-4A2 2 0 0014 2H6a2 2 0 00-2 2v14a2 2 0 002 2z" },
  { href: "/portal/ai", label: "AI", icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" },
];

const moreItems = [
  { href: "/portal/training", label: "Training", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
  { href: "/portal/plan", label: "Plan", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" },
];

export default function MobileNav() {
  const pathname = usePathname();
  const inboxUnreadCount = useInboxUnreadCount();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const moreActive = moreItems.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    }

    if (moreOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [moreOpen]);

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-bg-primary/95 backdrop-blur-lg border-t border-[rgba(255,255,255,0.06)] px-2 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-14">
        {items.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/portal" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-1 rounded-lg transition-colors no-underline ${
                isActive ? "text-accent-bright" : "text-text-muted"
              }`}
            >
              <span className="relative flex h-5 w-5 items-center justify-center">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isActive ? 2 : 1.5} d={item.icon} />
                </svg>
                {item.href === "/portal/inbox" && inboxUnreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-accent-bright text-white text-[9px] font-bold min-w-4 h-4 rounded-full px-1 flex items-center justify-center">
                    {inboxUnreadCount > 9 ? "9+" : inboxUnreadCount}
                  </span>
                )}
              </span>
              <span className="text-[9px] font-medium">{item.label}</span>
            </Link>
          );
        })}
        <div ref={moreRef} className="relative flex min-w-0 flex-1 justify-center">
          {moreOpen && (
            <div className="absolute bottom-full right-0 mb-2 w-44 overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] bg-bg-card shadow-2xl">
              {moreItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 text-sm font-medium no-underline transition-colors ${
                      isActive ? "bg-accent/10 text-accent-bright" : "text-text-secondary hover:bg-[rgba(255,255,255,0.04)] hover:text-text-primary"
                    }`}
                  >
                    <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d={item.icon} />
                    </svg>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          )}
          <button
            type="button"
            onClick={() => setMoreOpen((open) => !open)}
            className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-1 rounded-lg transition-colors cursor-pointer ${
              moreActive || moreOpen ? "text-accent-bright" : "text-text-muted"
            }`}
            aria-label="More portal sections"
            aria-expanded={moreOpen}
          >
            <span className="relative flex h-5 w-5 items-center justify-center">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={moreActive || moreOpen ? 2 : 1.5} d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </span>
            <span className="text-[9px] font-medium">More</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
