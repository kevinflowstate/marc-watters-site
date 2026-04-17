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

async function getPublicVapidKey() {
  if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY.replace(/\\n/g, "").trim();
  }

  const response = await fetch("/api/push/public-key", { cache: "no-store" });
  if (!response.ok) {
    return null;
  }

  const data = await response.json().catch(() => ({}));
  return typeof data.publicKey === "string" && data.publicKey ? data.publicKey.replace(/\\n/g, "").trim() : null;
}

async function ensureServiceWorkerRegistration() {
  if (!("serviceWorker" in navigator)) {
    return null;
  }

  const existingRegistration = await navigator.serviceWorker.getRegistration();

  if (existingRegistration) {
    existingRegistration.update().catch(() => {});
    return existingRegistration;
  }

  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

export function usePush() {
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission;
    }
    return "default";
  });
  const [subscribed, setSubscribed] = useState(false);
  const [vapidPublicKey, setVapidPublicKey] = useState<string | null>(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.replace(/\\n/g, "").trim() ?? null,
  );

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    ensureServiceWorkerRegistration()
      .then(async (reg) => {
        if (!reg) {
          setSubscribed(false);
          return;
        }

        const sub = await reg.pushManager.getSubscription();
        if (!sub) {
          setSubscribed(false);
          return;
        }

        const res = await persistSubscription(sub);
        setSubscribed(res.ok);
      })
      .catch((error) => {
        console.error("Failed to initialise push subscription state", error);
        setSubscribed(false);
      });
  }, []);

  useEffect(() => {
    if (vapidPublicKey) return;

    getPublicVapidKey()
      .then((key) => {
        if (key) {
          setVapidPublicKey(key);
        }
      })
      .catch((error) => {
        console.error("Failed to load public VAPID key", error);
      });
  }, [vapidPublicKey]);

  const subscribe = useCallback(async () => {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        return false;
      }

      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return false;

      const reg = await ensureServiceWorkerRegistration();
      const vapidKey = vapidPublicKey ?? await getPublicVapidKey();

      if (!reg || !vapidKey) return false;

      if (vapidKey !== vapidPublicKey) {
        setVapidPublicKey(vapidKey);
      }

      const existingSub = await reg.pushManager.getSubscription();
      const sub =
        existingSub ||
        await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });

      const res = await persistSubscription(sub);
      setSubscribed(res.ok);
      return res.ok;
    } catch (error) {
      console.error("Failed to enable push notifications", error);
      setSubscribed(false);
      return false;
    }
  }, [vapidPublicKey]);

  return { permission, subscribed, subscribe };
}
