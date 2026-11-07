"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/components/portal/ThemeToggle";
import { adminSections } from "@/components/admin/admin-nav";

/** Section and, for a nested route, the kind of record it opens. */
function crumbs(pathname: string) {
  const match = adminSections
    .flatMap((s) => s.items)
    .filter((i) => pathname === i.href || (i.href !== "/admin" && pathname.startsWith(`${i.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0];
  if (!match) return [{ label: "Admin", href: "/admin" }];
  const nested = pathname !== match.href && match.child;
  return nested ? [{ label: match.label, href: match.href }, { label: match.child! }] : [{ label: match.label }];
}

export default function AdminTopbar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const trail = crumbs(pathname);
  return (
    <header className="adm-topbar">
      <Link href="/admin" className="adm-topbar-mark" aria-label="Admin home">
        <Image src="/images/cbb-logo.png" alt="" width={22} height={22} />
      </Link>
      <nav className="adm-crumbs" aria-label="Breadcrumb">
        {trail.map((c, i) => (
          <span key={i} className="contents">
            {i > 0 && <span className="adm-sep">/</span>}
            {c.href && i < trail.length - 1 ? <Link href={c.href}>{c.label}</Link> : <span className="is-cur">{c.label}</span>}
          </span>
        ))}
      </nav>
      <span className="flex-1" />
      <button
        type="button"
        className="adm-ibtn"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      >
        {theme === "dark" ? (
          <svg fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3v1.5M12 19.5V21M4.2 4.2l1.1 1.1M18.7 18.7l1.1 1.1M3 12h1.5M19.5 12H21M4.2 19.8l1.1-1.1M18.7 5.3l1.1-1.1M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
          </svg>
        ) : (
          <svg fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20.3 15.3A8.5 8.5 0 0 1 8.7 3.7 8.5 8.5 0 1 0 20.3 15.3Z" />
          </svg>
        )}
      </button>
    </header>
  );
}
