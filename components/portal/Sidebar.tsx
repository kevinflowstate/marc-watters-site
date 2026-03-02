"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { href: "/portal", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { href: "/portal/training", label: "Training", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
  { href: "/portal/checkin", label: "Check-In", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
  { href: "/portal/settings", label: "Settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [userName, setUserName] = useState("");
  const [initials, setInitials] = useState("");

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("users")
          .select("full_name")
          .eq("id", user.id)
          .single();
        if (data?.full_name) {
          setUserName(data.full_name);
          setInitials(data.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2));
        }
      }
    }
    loadUser();
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="lg:hidden fixed top-4 left-4 z-[60] w-10 h-10 bg-bg-card border border-[rgba(255,255,255,0.06)] rounded-xl flex items-center justify-center text-text-primary"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={collapsed ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
        </svg>
      </button>

      <aside className={`fixed top-0 left-0 h-full w-[260px] bg-[rgba(5,5,7,0.97)] border-r border-[rgba(255,255,255,0.04)] backdrop-blur-[20px] z-50 flex flex-col transition-transform duration-300 ${collapsed ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}>
        <div className="p-6 border-b border-[rgba(255,255,255,0.04)]">
          <Link href="/" className="flex items-center gap-3 no-underline">
            <Image src="/images/cbb-logo.png" alt="CBB" width={28} height={28} className="h-7 w-auto" />
            <span className="font-heading font-extrabold text-sm text-text-primary">Client Portal</span>
          </Link>
        </div>

        <nav className="flex-1 p-4 flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/portal" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setCollapsed(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium no-underline transition-all duration-200 ${
                  isActive
                    ? "bg-[rgba(34,114,222,0.1)] text-accent-bright border border-[rgba(34,114,222,0.2)]"
                    : "text-text-secondary hover:text-text-primary hover:bg-[rgba(255,255,255,0.03)]"
                }`}
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                </svg>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[rgba(255,255,255,0.04)]">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-9 h-9 bg-[rgba(34,114,222,0.1)] border border-[rgba(34,114,222,0.2)] rounded-full flex items-center justify-center text-accent-bright text-xs font-bold">
              {initials || "??"}
            </div>
            <div>
              <div className="text-sm font-medium text-text-primary">{userName || "Loading..."}</div>
              <div className="text-xs text-text-muted">Client</div>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full mt-2 px-4 py-2 text-xs text-text-muted hover:text-red-400 transition-colors text-left"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {collapsed && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setCollapsed(false)} />
      )}
    </>
  );
}
