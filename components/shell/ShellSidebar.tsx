"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { externalIcon, initials, isActive, NavIcon, signOutIcon, type ShellConfig, type ShellNavItem } from "@/components/shell/nav";

function NavLink({ item, pathname, root, count }: { item: ShellNavItem; pathname: string; root: string; count: number }) {
  const on = isActive(pathname, item, root);
  return (
    <Link href={item.href} className={`adm-item ${on ? "is-on" : ""}`} aria-current={on ? "page" : undefined}>
      <NavIcon d={item.icon} />
      <span>{item.label}</span>
      {count > 0 && <span className="adm-ct is-dot">{count > 99 ? "99+" : count}</span>}
    </Link>
  );
}

export default function ShellSidebar({
  config,
  counts,
  userName,
  avatarUrl,
  onSignOut,
}: {
  config: ShellConfig;
  counts: Record<string, number>;
  userName: string;
  avatarUrl?: string | null;
  onSignOut: () => void;
}) {
  const pathname = usePathname();
  return (
    <aside className="adm-side" aria-label={config.ariaLabel}>
      <div className="adm-side-top">
        <Link href={config.homeHref} className="adm-ws">
          <Image src="/icon-192x192.png" alt="" width={22} height={22} />
          <span className="min-w-0 truncate">{config.productName}</span>
        </Link>
      </div>
      <nav className="adm-side-scroll" aria-label={`${config.ariaLabel} sections`}>
        {config.sections.map((section, i) => (
          <div key={section.label ?? i} className={section.label ? "adm-group" : undefined}>
            {section.label && <div className="adm-group-h">{section.label}</div>}
            {section.items.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} root={config.root} count={counts[item.href] ?? 0} />
            ))}
          </div>
        ))}
      </nav>
      <div className="adm-side-bot">
        {config.settingsItem && <NavLink item={config.settingsItem} pathname={pathname} root={config.root} count={0} />}
        {config.publicSite && (
          <a className="adm-item" href="/" target="_blank" rel="noreferrer">
            <NavIcon d={externalIcon} />
            <span>Public site</span>
          </a>
        )}
        <button type="button" className="adm-item" onClick={onSignOut}>
          <NavIcon d={signOutIcon} />
          <span>Sign out</span>
        </button>
        {userName && (
          <div className="adm-user" title={userName}>
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- user avatars come from storage URLs of unknown host
              <img className="adm-av" src={avatarUrl} alt="" />
            ) : (
              <span className="adm-av" aria-hidden="true">{initials(userName)}</span>
            )}
            <span>{userName}</span>
          </div>
        )}
      </div>
    </aside>
  );
}
