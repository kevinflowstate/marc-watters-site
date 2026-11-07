"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useInboxUnreadCount } from "@/components/inbox/useInboxUnreadCount";
import { useWorkspaceDecideCount } from "@/components/ops/workspace/useWorkspaceDecideCount";
import { useManagementRole } from "@/components/admin/useManagementRole";
import { createClient } from "@/lib/supabase/client";
import { adminSections, isActive, NavIcon, settingsItem, type AdminNavItem } from "@/components/admin/admin-nav";

const allItems = adminSections.flatMap((s) => s.items);
const primaryHrefs = ["/admin", "/admin/work", "/admin/clients", "/admin/inbox"];
const primary = primaryHrefs.map((h) => allItems.find((i) => i.href === h)!);
const more = [...allItems.filter((i) => !primaryHrefs.includes(i.href)), settingsItem];
const moreIcon = "M4 7h16M4 12h16M4 17h16";
const signOutIcon = "M14 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-3m-4-4h11m0 0-3-3m3 3-3 3";

export default function AdminMobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const inboxUnread = useInboxUnreadCount();
  const decideCount = useWorkspaceDecideCount();
  const role = useManagementRole();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    function onDown(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [moreOpen]);

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
  }

  function badge(item: AdminNavItem) {
    const n = item.href === "/admin/work" ? decideCount : item.href === "/admin/inbox" ? inboxUnread : 0;
    return n > 0 ? <span className="adm-bdot">{n > 9 ? "9+" : n}</span> : null;
  }

  if (role === "growth_operator") {
    const item = allItems.find((i) => i.operator)!;
    const on = isActive(pathname, item.href);
    return (
      <nav className="adm-bottomnav" aria-label="Primary">
        <Link href={item.href} className={on ? "is-on" : undefined}>
          <NavIcon d={item.icon} size={19} stroke={on ? 2 : 1.6} />
          <span>{item.label}</span>
        </Link>
        <button type="button" onClick={signOut}>
          <NavIcon d={signOutIcon} size={19} />
          <span>Sign out</span>
        </button>
      </nav>
    );
  }

  const moreActive = more.some((i) => isActive(pathname, i.href));
  return (
    <nav className="adm-bottomnav" aria-label="Primary">
      {primary.map((item) => {
        const on = isActive(pathname, item.href);
        return (
          <Link key={item.href} href={item.href} className={on ? "is-on" : undefined} aria-current={on ? "page" : undefined}>
            <NavIcon d={item.icon} size={19} stroke={on ? 2 : 1.6} />
            <span>{item.label === "Dashboard" ? "Home" : item.label}</span>
            {badge(item)}
          </Link>
        );
      })}
      <div ref={moreRef} className="relative flex min-w-0 flex-1">
        {moreOpen && (
          <div className="adm-more" role="menu">
            {more.map((item) => (
              <Link key={item.href} href={item.href} role="menuitem" className={isActive(pathname, item.href) ? "is-on" : undefined} onClick={() => setMoreOpen(false)}>
                <NavIcon d={item.icon} size={15} />
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        )}
        <button
          type="button"
          className={moreActive || moreOpen ? "is-on" : undefined}
          onClick={() => setMoreOpen((o) => !o)}
          aria-label="More sections"
          aria-expanded={moreOpen}
        >
          <NavIcon d={moreIcon} size={19} stroke={moreActive || moreOpen ? 2 : 1.6} />
          <span>More</span>
        </button>
      </div>
    </nav>
  );
}
