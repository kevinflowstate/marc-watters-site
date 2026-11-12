"use client";

import Image from "next/image";

/* Flat, Skool-style cover: the module's own cover image when it has one, otherwise a solid
 * tone with the CBB mark and the module title. Styles live in the Training block of app/restyle.css. */
const coverTones = ["#1f3a5f", "#204a3c", "#3b2f5c", "#5a3a1e", "#2b3d47", "#4a2a33", "#33353b"];

function coverTone(title: string) {
  let hash = 0;
  for (let i = 0; i < title.length; i += 1) hash = (hash * 31 + title.charCodeAt(i)) >>> 0;
  return coverTones[hash % coverTones.length];
}

export default function ModuleCover({
  title,
  variant = "card",
  imageUrl,
}: {
  title: string;
  variant?: "card" | "banner";
  imageUrl?: string;
}) {
  return (
    <div
      className={`ws-cover${variant === "banner" ? " is-lg" : ""}${imageUrl ? " has-img" : ""}`}
      style={{ "--cv-bg": coverTone(title) } as React.CSSProperties}
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
          <Image src="/images/cbb-logo.png" alt="" width={18} height={21} unoptimized className="ws-cover-logo" aria-hidden />
          <span aria-hidden className="ws-cover-t">{title}</span>
        </>
      )}
    </div>
  );
}
