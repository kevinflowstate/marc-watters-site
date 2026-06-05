"use client";

import { useEffect } from "react";

export default function AppUpdateManager() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    async function updateServiceWorker() {
      try {
        const registration =
          (await navigator.serviceWorker.getRegistration("/")) ||
          (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));

        await registration.update();
      } catch (error) {
        console.error("Failed to check for app updates:", error);
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void updateServiceWorker();
      }
    }

    void updateServiceWorker();
    window.addEventListener("focus", updateServiceWorker);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const interval = window.setInterval(updateServiceWorker, 30 * 60 * 1000);

    return () => {
      window.removeEventListener("focus", updateServiceWorker);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
