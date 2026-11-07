import { settingsIcon, type ShellConfig, type ShellNavSection } from "@/components/shell/nav";

/** Client portal nav config. One list for the sidebar, the phone nav and the topbar crumb. */
export const portalSections: ShellNavSection[] = [
  {
    items: [
      { href: "/portal", label: "Dashboard", short: "Home", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
      { href: "/portal/inbox", label: "Inbox", icon: "M8 10h8m-8 4h5m-7 6h12a2 2 0 002-2V8a2 2 0 00-.586-1.414l-4-4A2 2 0 0014 2H6a2 2 0 00-2 2v14a2 2 0 002 2z" },
      { href: "/portal/calendar", label: "Calendar", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
      { href: "/portal/checkin", label: "Check-In", also: ["/portal/checkins"], child: "Reply", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
    ],
  },
  {
    label: "Programme",
    items: [
      { href: "/portal/plan", label: "Business Plan", short: "Plan", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" },
      { href: "/portal/training", label: "Training", child: "Lesson", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
      { href: "/portal/ai", label: "Blueprint AI", short: "AI", icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" },
      { href: "/portal/growth-engine", label: "CBB Growth Engine", short: "Growth Engine", child: "Report", icon: "M4 19V9m5 10V5m5 14v-7m5 7V3M3 19h18" },
    ],
  },
];

export const portalConfig: ShellConfig = {
  root: "/portal",
  rootLabel: "Portal",
  homeHref: "/portal",
  productName: "Blueprint Portal",
  ariaLabel: "Client portal",
  sections: portalSections,
  settingsItem: { href: "/portal/settings", label: "Settings", icon: settingsIcon },
  primaryHrefs: ["/portal", "/portal/checkin", "/portal/inbox", "/portal/calendar"],
};
