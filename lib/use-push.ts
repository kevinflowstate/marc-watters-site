"use client";

import { useState, useEffect, useCallback } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

async function persistSubscription(subscription: PushSubscription) {
  return fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });
}

export function usePush() {
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission;
    }
    return "default";
  });
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    // Check if already subscribed
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        if (!sub) {
          setSubscribed(false);
          return;
        }

        const res = await persistSubscription(sub);
        setSubscribed(res.ok);
      });
    }
  }, []);

  const subscribe = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return false;
    }

    const perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm !== "granted") return false;

    const reg = await navigator.serviceWorker.ready;
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) return false;

    const existingSub = await reg.pushManager.getSubscription();
    const sub =
      existingSub ||
      await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

    const res = await persistSubscription(sub);

    if (res.ok) {
      setSubscribed(true);
      return true;
    }
    return false;
  }, []);

  return { permission, subscribed, subscribe };
}
