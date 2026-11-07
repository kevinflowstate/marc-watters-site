"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { isActive, moreIcon, NavIcon, signOutIcon, type ShellConfig, type ShellNavItem } from "@/components/shell/nav";

export default function ShellMobileNav({
  config,
  counts,
  onSignOut,
}: {
  config: ShellConfig;
  counts: Record<string, number>;
  onSignOut: () => void;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const allItems = config.sections.flatMap((s) => s.items);

  useEffect(() => {
    if (!moreOpen) return;
    function onDown(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [moreOpen]);

  function badge(item: ShellNavItem) {
    const n = counts[item.href] ?? 0;
    return n > 0 ? <span className="adm-bdot">{n > 9 ? "9+" : n}</span> : null;
  }

  // Role-restricted users: their one page plus sign out.
  if (!config.primaryHrefs) {
    return (
      <nav className="adm-bottomnav" aria-label="Primary">
        {allItems.map((item) => {
          const on = isActive(pathname, item, config.root);
          return (
            <Link key={item.href} href={item.href} className={on ? "is-on" : undefined}>
              <NavIcon d={item.icon} size={19} stroke={on ? 2 : 1.6} />
              <span>{item.short ?? item.label}</span>
            </Link>
          );
        })}
        <button type="button" onClick={onSignOut}>
          <NavIcon d={signOutIcon} size={19} />
          <span>Sign out</span>
        </button>
      </nav>
    );
  }

  const primaryHrefs = config.primaryHrefs;
  const primary = primaryHrefs.map((h) => allItems.find((i) => i.href === h)).filter((i): i is ShellNavItem => Boolean(i));
  const more = [...allItems.filter((i) => !primaryHrefs.includes(i.href)), ...(config.settingsItem ? [config.settingsItem] : [])];
  const moreActive = more.some((i) => isActive(pathname, i, config.root));

  return (
    <nav className="adm-bottomnav" aria-label="Primary">
      {primary.map((item) => {
        const on = isActive(pathname, item, config.root);
        return (
          <Link key={item.href} href={item.href} className={on ? "is-on" : undefined} aria-current={on ? "page" : undefined}>
            <NavIcon d={item.icon} size={19} stroke={on ? 2 : 1.6} />
            <span>{item.short ?? item.label}</span>
            {badge(item)}
          </Link>
        );
      })}
      <div ref={moreRef} className="relative flex min-w-0 flex-1">
        {moreOpen && (
          <div className="adm-more" role="menu">
            {more.map((item) => (
              <Link key={item.href} href={item.href} role="menuitem" className={isActive(pathname, item, config.root) ? "is-on" : undefined} onClick={() => setMoreOpen(false)}>
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
