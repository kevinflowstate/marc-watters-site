"use client";

import { useEffect } from "react";

export default function AppUpdateManager() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let reloading = false;

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

    function handleControllerChange() {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void updateServiceWorker();
      }
    }

    void updateServiceWorker();
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    window.addEventListener("focus", updateServiceWorker);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const interval = window.setInterval(updateServiceWorker, 30 * 60 * 1000);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      window.removeEventListener("focus", updateServiceWorker);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
