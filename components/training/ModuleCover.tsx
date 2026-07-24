"use client";

import Image from "next/image";
import { useId } from "react";

export default function ModuleCover({
  title,
  variant = "card",
  imageUrl,
}: {
  title: string;
  variant?: "card" | "banner";
  imageUrl?: string;
}) {
  const h = variant === "banner" ? "h-40" : "h-36";
  const patternId = `module-dots-${useId().replace(/:/g, "")}`;

  return (
    <div className={`v2-dark-media relative ${h} w-full overflow-hidden bg-[#070A10]`}>
      {imageUrl && (
        <Image
          src={imageUrl}
          alt=""
          fill
          unoptimized
          sizes={variant === "banner" ? "(min-width: 768px) 320px, 100vw" : "(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"}
          className="object-cover opacity-55"
          aria-hidden
        />
      )}

      {/* Blueprint SVG pattern */}
      <svg
        className={`absolute inset-0 h-full w-full ${imageUrl ? "opacity-50" : ""}`}
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        {/* Dot grid */}
        <pattern id={patternId} x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
          <circle cx="16" cy="16" r="1" fill="#2272DE" opacity="0.15" />
        </pattern>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />

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
        <path d="M 70 15 L 82 15 L 82 30" fill="none" stroke="#2272DE" strokeWidth="1.5" opacity="0.22" />
        <circle cx="70%" cy="15%" r="3.5" fill="#2272DE" opacity="0.28" />
        <rect x="79%" y="28%" width="6%" height="4%" rx="1" fill="none" stroke="#2272DE" strokeWidth="1" opacity="0.18" />

        <path d="M 15 75 L 30 75 L 30 90" fill="none" stroke="#2272DE" strokeWidth="1.5" opacity="0.18" />
        <circle cx="15%" cy="75%" r="3" fill="#2272DE" opacity="0.22" />
        <rect x="27%" y="88%" width="5%" height="3.5%" rx="1" fill="none" stroke="#2272DE" strokeWidth="1" opacity="0.15" />

        <path d="M 85 55 L 95 55 L 95 72" fill="none" stroke="#2272DE" strokeWidth="1.5" opacity="0.2" />
        <circle cx="85%" cy="55%" r="3" fill="#2272DE" opacity="0.25" />
        <rect x="92%" y="70%" width="5%" height="3.5%" rx="1" fill="none" stroke="#2272DE" strokeWidth="1" opacity="0.16" />
      </svg>

      {/* Tone and focus */}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,7,12,0.82),rgba(5,7,12,0.36)_55%,rgba(5,7,12,0.7))]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_40%,rgba(34,114,222,0.16)_0%,transparent_55%)]" />

      {/* Top accent line */}
      <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-[#2272DE] to-transparent opacity-80" />

      {/* CBB text logo */}
      <div className="absolute top-4 left-0 right-0 flex items-center justify-center">
        <span className="font-heading text-[11px] font-extrabold tracking-[0.15em] text-blue-300">CBB</span>
      </div>

      {/* Module title */}
      <div className="absolute inset-0 flex items-center justify-center px-8 pt-4">
        <div aria-hidden className="text-center font-heading text-xl font-extrabold leading-tight tracking-tight text-white md:text-2xl">
          {title}
        </div>
      </div>

      {/* Bottom accent bar */}
      <div className="absolute bottom-4 left-1/2 h-0.5 w-12 -translate-x-1/2 rounded-full bg-[#2272DE] opacity-70" />
    </div>
  );
}
