/**
 * Shared shell navigation model. One config drives the sidebar, the phone
 * bottom nav and the topbar crumb. The admin and the client portal each
 * supply their own config (components/admin/admin-nav.tsx and
 * components/portal/portal-nav.tsx).
 */
export type ShellNavItem = {
  href: string;
  label: string;
  /** Shorter label for the phone bottom nav. */
  short?: string;
  /** What a nested route under this section opens, for the crumb. */
  child?: string;
  /** Other route prefixes that belong to this section. */
  also?: string[];
  icon: string;
  /** Growth operators only ever see this one page (admin). */
  operator?: boolean;
};
export type ShellNavSection = { label?: string; items: ShellNavItem[] };

export type ShellConfig = {
  /** Route the shell lives under, e.g. "/admin". Only an exact match activates it. */
  root: string;
  /** Crumb label when no section matches. */
  rootLabel: string;
  /** Where the logo goes. */
  homeHref: string;
  productName: string;
  ariaLabel: string;
  sections: ShellNavSection[];
  settingsItem?: ShellNavItem;
  /** Phone bottom nav: these four, then More. Omit for a compact one-item nav. */
  primaryHrefs?: string[];
  /** Show the external "Public site" link in the sidebar footer. */
  publicSite?: boolean;
};

export function isActive(pathname: string, item: Pick<ShellNavItem, "href" | "also">, root: string) {
  const prefixes = [item.href, ...(item.also ?? [])];
  return prefixes.some((href) => pathname === href || (href !== root && pathname.startsWith(`${href}/`)));
}

export function NavIcon({ d, size = 16, stroke = 1.6 }: { d: string; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export const externalIcon = "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5";
export const signOutIcon = "M14 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-3m-4-4h11m0 0-3-3m3 3-3 3";
export const moreIcon = "M4 7h16M4 12h16M4 17h16";
export const settingsIcon =
  "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z";
