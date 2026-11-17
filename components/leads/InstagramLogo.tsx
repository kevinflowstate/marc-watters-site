import { useId } from "react";

/**
 * The Instagram app logo: the rounded square in Instagram's own gradient with the white camera glyph.
 * Drawn from the official mark's geometry (outer rounded square, inner rounded square, lens, flash).
 */
export function InstagramLogo({ size = 18, title = "Instagram" }: { size?: number; title?: string | null }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role={title ? "img" : undefined}
      aria-label={title ?? undefined}
      aria-hidden={title ? undefined : true}
      className="ld-ig"
    >
      <defs>
        <radialGradient id={`ig-a-${id}`} cx="0.3" cy="1.07" r="1.2">
          <stop offset="0" stopColor="#ffdd55" />
          <stop offset="0.1" stopColor="#ffdd55" />
          <stop offset="0.5" stopColor="#ff543e" />
          <stop offset="1" stopColor="#c837ab" />
        </radialGradient>
        <radialGradient id={`ig-b-${id}`} cx="-0.17" cy="0.07" r="0.6">
          <stop offset="0" stopColor="#3771c8" />
          <stop offset="0.13" stopColor="#3771c8" />
          <stop offset="1" stopColor="#6600ff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="1" y="1" width="22" height="22" rx="6.2" fill={`url(#ig-a-${id})`} />
      <rect x="1" y="1" width="22" height="22" rx="6.2" fill={`url(#ig-b-${id})`} />
      <rect x="5.4" y="5.4" width="13.2" height="13.2" rx="3.9" fill="none" stroke="#fff" strokeWidth="1.55" />
      <circle cx="12" cy="12" r="3.2" fill="none" stroke="#fff" strokeWidth="1.55" />
      <circle cx="15.85" cy="8.15" r="0.95" fill="#fff" />
    </svg>
  );
}
