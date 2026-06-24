"use client";

import { useEffect } from "react";

/**
 * Fades out the server-rendered #cbb-splash overlay once the app has hydrated.
 * The splash markup lives in the root layout so it paints instantly (before
 * this controller — or any JS — runs). A minimum visible window stops it
 * flashing on fast loads; an inline <head> fallback hides it if JS stalls.
 */
export default function SplashController() {
  useEffect(() => {
    const el = document.getElementById("cbb-splash");
    if (!el) return;
    const hide = window.setTimeout(() => el.classList.add("is-hidden"), 650);
    const remove = window.setTimeout(() => el.remove(), 1300);
    return () => {
      window.clearTimeout(hide);
      window.clearTimeout(remove);
    };
  }, []);

  return null;
}
