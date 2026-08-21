"use client";

import { useEffect } from "react";

export default function AppUpdateManager() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") return;
    if (!window.location.pathname.startsWith("/portal") && window.location.pathname !== "/login") return;
    if (!("serviceWorker" in navigator)) return;

    let reloading = false;

    function reloadOnce() {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    }

    async function updateDocument() {
      try {
        const response = await fetch("/api/version", { cache: "no-store" });
        if (!response.ok) return;

        const data = (await response.json()) as { version?: string };
        const loadedVersion = document.body.dataset.buildVersion;
        if (
          loadedVersion &&
          loadedVersion !== "development" &&
          data.version &&
          data.version !== loadedVersion
        ) {
          reloadOnce();
        }
      } catch (error) {
        console.error("Failed to check for a portal update:", error);
      }
    }

    async function updateServiceWorker() {
      try {
        const registration =
          (await navigator.serviceWorker.getRegistration("/")) ||
          (await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }));

        await registration.update();
      } catch (error) {
        console.error("Failed to check for app updates:", error);
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void updateServiceWorker();
        void updateDocument();
      }
    }

    void updateServiceWorker();
    void updateDocument();

    function handleFocus() {
      void updateServiceWorker();
      void updateDocument();
    }

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const interval = window.setInterval(() => {
      void updateServiceWorker();
      void updateDocument();
    }, 30 * 60 * 1000);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
