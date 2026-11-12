"use client";

import Image from "next/image";
import { Icon } from "@/components/ops/workspace/WorkspaceUI";

/* Flat cover from the approved mock: solid tone, a large faint line icon on the right,
 * a small "Module N" kicker and the title bottom-left. An uploaded cover image (client
 * pages only, as before) replaces it. Styles live in the Training block of app/restyle.css. */
const coverTones = ["#1f3a5f", "#204a3c", "#3b2f5c", "#5a3a1e", "#2b3d47", "#4a2a33", "#33353b"];
const fallbackArt = ["book", "lessons", "flag", "sparkle", "content"];
const artByKeyword: Array<[RegExp, string]> = [
  [/welcome|onboard|start here|getting started/i, "onboarding"],
  [/mindset|thinking|belief|habit/i, "bulb"],
  [/replay|recording|call|webinar|video/i, "play"],
  [/result|deliver|goal|target|outcome/i, "target"],
  [/client|attract|sales|lead|marketing|customer/i, "users"],
  [/organis|organiz|system|streamline|process|operation|admin/i, "plan"],
  [/pric|profit|money|cash|finance|number/i, "finance"],
  [/hir|team|staff|foreman/i, "users"],
  [/schedule|programme|plan/i, "calendar"],
];

function hash(text: string) {
  let value = 0;
  for (let i = 0; i < text.length; i += 1) value = (value * 41 + text.charCodeAt(i)) >>> 0;
  return value;
}

function coverArt(title: string) {
  const match = artByKeyword.find(([pattern]) => pattern.test(title));
  return match ? match[1] : fallbackArt[hash(title) % fallbackArt.length];
}

export default function ModuleCover({
  title,
  variant = "card",
  imageUrl,
  number,
}: {
  title: string;
  variant?: "card" | "banner";
  imageUrl?: string;
  number?: number;
}) {
  return (
    <div
      className={`ws-cover${variant === "banner" ? " is-lg" : ""}${imageUrl ? " has-img" : ""}`}
      style={{ "--cv-bg": coverTones[hash(title) % coverTones.length] } as React.CSSProperties}
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt=""
          fill
          unoptimized
          sizes={variant === "banner" ? "(min-width: 768px) 340px, 100vw" : "(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"}
          className="ws-cover-img"
          aria-hidden
        />
      ) : (
        <>
          <Icon name={coverArt(title)} size={24} stroke={1.6} className="ws-cover-art" />
          {number !== undefined && <span className="ws-cover-k" aria-hidden>Module {number}</span>}
          <span className="ws-cover-t" aria-hidden>{title}</span>
        </>
      )}
    </div>
  );
}
