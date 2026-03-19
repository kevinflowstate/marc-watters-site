"use client";

/**
 * Auto-generated module cover - renders as a styled div with SVG blueprint pattern.
 * No API calls, no image generation. Just CSS + inline SVG.
 *
 * Usage: <ModuleCover title="Financial Foundations" />
 * Variants: "card" (default, for grid) or "banner" (wider, for detail headers)
 */

export default function ModuleCover({
  title,
  variant = "card",
}: {
  title: string;
  variant?: "card" | "banner";
}) {
  const h = variant === "banner" ? "h-40" : "h-36";

  return (
    <div className={`relative ${h} w-full overflow-hidden bg-[#070A10]`}>
      {/* Blueprint SVG pattern */}
      <svg
        className="absolute inset-0 w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        {/* Dot grid */}
        <pattern id={`dots-${variant}`} x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
          <circle cx="16" cy="16" r="1" fill="#2272DE" opacity="0.15" />
        </pattern>
        <rect width="100%" height="100%" fill={`url(#dots-${variant})`} />

        {/* Horizontal pipes */}
        <line x1="5%" y1="20%" x2="45%" y2="20%" stroke="#2272DE" strokeWidth="1.5" opacity="0.25" />
        <circle cx="5%" cy="20%" r="4" fill="#2272DE" opacity="0.3" />
        <circle cx="45%" cy="20%" r="4" fill="#2272DE" opacity="0.3" />

        <line x1="55%" y1="40%" x2="95%" y2="40%" stroke="#2272DE" strokeWidth="1.5" opacity="0.2" />
        <circle cx="55%" cy="40%" r="4" fill="#2272DE" opacity="0.25" />
        <circle cx="95%" cy="40%" r="4" fill="#2272DE" opacity="0.25" />

        <line x1="10%" y1="65%" x2="40%" y2="65%" stroke="#2272DE" strokeWidth="1.5" opacity="0.2" />
        <circle cx="10%" cy="65%" r="3" fill="#2272DE" opacity="0.25" />
        <circle cx="40%" cy="65%" r="3" fill="#2272DE" opacity="0.25" />

        <line x1="60%" y1="80%" x2="90%" y2="80%" stroke="#2272DE" strokeWidth="1.5" opacity="0.18" />
        <circle cx="60%" cy="80%" r="3" fill="#2272DE" opacity="0.22" />
        <circle cx="90%" cy="80%" r="3" fill="#2272DE" opacity="0.22" />

        {/* Vertical connectors */}
        <line x1="45%" y1="20%" x2="45%" y2="40%" stroke="#2272DE" strokeWidth="1.5" opacity="0.2" />
        <line x1="75%" y1="40%" x2="75%" y2="65%" stroke="#2272DE" strokeWidth="1.5" opacity="0.18" />
        <line x1="25%" y1="65%" x2="25%" y2="85%" stroke="#2272DE" strokeWidth="1.5" opacity="0.15" />

        {/* L-shaped brackets */}
        <path d="M 70% 15% L 82% 15% L 82% 30%" fill="none" stroke="#2272DE" strokeWidth="1.5" opacity="0.22" />
        <circle cx="70%" cy="15%" r="3.5" fill="#2272DE" opacity="0.28" />
        <rect x="79%" y="28%" width="6%" height="4%" rx="1" fill="none" stroke="#2272DE" strokeWidth="1" opacity="0.18" />

        <path d="M 15% 75% L 30% 75% L 30% 90%" fill="none" stroke="#2272DE" strokeWidth="1.5" opacity="0.18" />
        <circle cx="15%" cy="75%" r="3" fill="#2272DE" opacity="0.22" />
        <rect x="27%" y="88%" width="5%" height="3.5%" rx="1" fill="none" stroke="#2272DE" strokeWidth="1" opacity="0.15" />

        <path d="M 85% 55% L 95% 55% L 95% 72%" fill="none" stroke="#2272DE" strokeWidth="1.5" opacity="0.2" />
        <circle cx="85%" cy="55%" r="3" fill="#2272DE" opacity="0.25" />
        <rect x="92%" y="70%" width="5%" height="3.5%" rx="1" fill="none" stroke="#2272DE" strokeWidth="1" opacity="0.16" />
      </svg>

      {/* Blue radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_40%,rgba(34,114,222,0.18)_0%,transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_75%,rgba(34,114,222,0.12)_0%,transparent_45%)]" />

      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-[#2272DE] to-transparent opacity-60" />

      {/* CBB text logo */}
      <div className="absolute top-4 left-0 right-0 flex items-center justify-center">
        <span className="text-[11px] font-extrabold tracking-[0.15em] text-[#2272DE] font-heading">CBB</span>
      </div>

      {/* Module title */}
      <div className="absolute inset-0 flex items-center justify-center px-8 pt-4">
        <h3 className="text-xl md:text-2xl font-heading font-extrabold text-white text-center leading-tight tracking-tight">
          {title}
        </h3>
      </div>

      {/* Bottom accent bar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-12 h-[3px] bg-[#2272DE] opacity-50 rounded-full" />
    </div>
  );
}
