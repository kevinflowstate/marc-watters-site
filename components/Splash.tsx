"use client";

import { useEffect, useState } from "react";

/**
 * CBB launch splash. Server-renders the overlay (so it paints on first paint,
 * before hydration), then fades and unmounts itself via React state.
 *
 * Visibility is driven purely by React state — never by manual DOM removal —
 * so React keeps ownership of the node and reconciliation stays intact during
 * client-side navigation.
 */
export default function Splash() {
  const [hidden, setHidden] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const fade = window.setTimeout(() => setHidden(true), 650);
    const unmount = window.setTimeout(() => setGone(true), 1300);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(unmount);
    };
  }, []);

  if (gone) return null;

  return (
    <div id="cbb-splash" aria-hidden="true" className={hidden ? "is-hidden" : undefined}>
      <div className="splash-logo relative flex items-center justify-center">
        <span className="brand-loader-halo absolute h-32 w-32 rounded-full" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/cbb-logo.png"
          alt=""
          width={72}
          height={72}
          className="relative h-16 w-auto"
        />
      </div>
      <div
        className="h-[3px] w-44 overflow-hidden rounded-full"
        style={{ background: "rgba(34,114,222,0.12)" }}
      >
        <div className="brand-loader-bar h-full w-1/2 gradient-accent rounded-full" />
      </div>
    </div>
  );
}
