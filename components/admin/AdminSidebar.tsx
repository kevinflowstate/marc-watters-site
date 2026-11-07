"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useInboxUnreadCount } from "@/components/inbox/useInboxUnreadCount";
import { useWorkspaceDecideCount } from "@/components/ops/workspace/useWorkspaceDecideCount";
import { useManagementRole } from "@/components/admin/useManagementRole";
import { adminSections, isActive, NavIcon, settingsItem, type AdminNavItem } from "@/components/admin/admin-nav";

const externalIcon = "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5";
const signOutIcon = "M14 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-3m-4-4h11m0 0-3-3m3 3-3 3";

function NavLink({ item, pathname, count }: { item: AdminNavItem; pathname: string; count: number }) {
  const on = isActive(pathname, item.href);
  return (
    <Link href={item.href} className={`adm-item ${on ? "is-on" : ""}`} aria-current={on ? "page" : undefined}>
      <NavIcon d={item.icon} />
      <span>{item.label}</span>
      {count > 0 && <span className="adm-ct is-dot">{count > 99 ? "99+" : count}</span>}
    </Link>
  );
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
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

  const operator = role === "growth_operator";
  const sections = operator ? [{ items: adminSections.flatMap((s) => s.items).filter((i) => i.operator) }] : adminSections;
  const homeHref = operator ? "/admin/growth-engine" : "/admin";

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
  }

  function count(item: AdminNavItem) {
    if (item.href === "/admin/work") return decideCount;
    if (item.href === "/admin/inbox") return inboxUnread;
    return 0;
  }

  return (
    <aside className="adm-side" aria-label="Admin">
      <div className="adm-side-top">
        <Link href={homeHref} className="adm-ws">
          <Image src="/images/cbb-logo.png" alt="" width={22} height={22} />
          <span className="min-w-0 truncate">{operator ? "Growth Engine" : "Blueprint Admin"}</span>
        </Link>
      </div>
      <nav className="adm-side-scroll" aria-label="Admin sections">
        {sections.map((section, i) => (
          <div key={section.label ?? i} className={section.label ? "adm-group" : undefined}>
            {section.label && <div className="adm-group-h">{section.label}</div>}
            {section.items.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} count={count(item)} />
            ))}
          </div>
        ))}
      </nav>
      <div className="adm-side-bot">
        {!operator && <NavLink item={settingsItem} pathname={pathname} count={0} />}
        <a className="adm-item" href="/" target="_blank" rel="noreferrer">
          <NavIcon d={externalIcon} />
          <span>Public site</span>
        </a>
        <button type="button" className="adm-item" onClick={signOut}>
          <NavIcon d={signOutIcon} />
          <span>Sign out</span>
        </button>
        {name && (
          <div className="adm-user" title={name}>
            <span className="adm-av" aria-hidden="true">{initials(name)}</span>
            <span>{name}</span>
          </div>
        )}
      </div>
    </aside>
  );
}
