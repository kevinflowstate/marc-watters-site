"use client";

import { useState, useEffect, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window {
    __pwaInstallPrompt: BeforeInstallPromptEvent | null;
  }
}

export function useInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => {
    if (typeof window === "undefined") return null;
    return window.__pwaInstallPrompt || null;
  });
  const [installed, setInstalled] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(display-mode: standalone)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Also listen for future events
    const handler = (e: Event) => {
      e.preventDefault();
      const prompt = e as BeforeInstallPromptEvent;
      window.__pwaInstallPrompt = prompt;
      setDeferredPrompt(prompt);
    };

    const installedHandler = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      window.__pwaInstallPrompt = null;
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);

    // Poll briefly in case the event fires between the inline script and this effect
    const timer = setTimeout(() => {
      if (window.__pwaInstallPrompt) {
        setDeferredPrompt(window.__pwaInstallPrompt);
      }
    }, 1000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
      clearTimeout(timer);
    };
  }, []);

  const install = useCallback(async () => {
    const prompt = deferredPrompt || window.__pwaInstallPrompt;
    if (!prompt) return false;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    setDeferredPrompt(null);
    window.__pwaInstallPrompt = null;
    if (outcome === "accepted") {
      setInstalled(true);
      return true;
    }
    return false;
  }, [deferredPrompt]);

  return { canInstall: !!(deferredPrompt || (typeof window !== "undefined" && window.__pwaInstallPrompt)), installed, install };
}
