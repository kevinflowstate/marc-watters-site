"use client";

import { useState, useEffect } from "react";
import { usePush } from "@/lib/use-push";
import { useInstall } from "@/lib/use-install";

const DISMISSED_KEY = "push-banner-dismissed";
const INSTALL_DISMISSED_KEY = "install-banner-dismissed";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as unknown as { standalone: boolean }).standalone)
  );
}

function hasPushSupport() {
  return typeof window !== "undefined" && "PushManager" in window && "Notification" in window;
}

export default function PushNotificationBanner() {
  const { permission, subscribed, subscribe } = usePush();
  const { canInstall, installed, install } = useInstall();
  const [dismissed, setDismissed] = useState(true);
  const [installDismissed, setInstallDismissed] = useState(true);
  const [loading, setLoading] = useState(false);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    const sa = isStandalone();
    setStandalone(sa);

    const installWasDismissed = localStorage.getItem(INSTALL_DISMISSED_KEY) === "true";
    setInstallDismissed(installWasDismissed || sa || installed);

    const pushWasDismissed = localStorage.getItem(DISMISSED_KEY) === "true";
    if (hasPushSupport()) {
      setDismissed(pushWasDismissed || permission === "granted" || subscribed);
    } else {
      setDismissed(true);
    }
  }, [permission, subscribed, installed]);

  const handleEnable = async () => {
    setLoading(true);
    await subscribe();
    setLoading(false);
  };

  const [showManual, setShowManual] = useState(false);

  const handleInstall = async () => {
    setLoading(true);
    const success = await install();
    setLoading(false);
    if (success) {
      setInstallDismissed(true);
    } else {
      // Native prompt not available -- show manual instructions
      setShowManual(true);
    }
  };

  const handleDismissPush = () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setDismissed(true);
  };

  const handleDismissInstall = () => {
    localStorage.setItem(INSTALL_DISMISSED_KEY, "true");
    setInstallDismissed(true);
  };

  // Show install banner if not standalone and not dismissed
  if (!installDismissed && !standalone && !installed) {
    return (
      <div className="mb-6 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(12,12,18,0.6)] px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <svg
              className="w-5 h-5 text-accent-light flex-shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-text-primary mb-1">
                Install this app on your phone
              </p>
              <p className="text-xs text-text-muted leading-relaxed">
                Get quick access from your home screen with push notifications and a full-screen experience.
              </p>
              {showManual && (
                <p className="text-xs text-accent-light leading-relaxed mt-2">
                  Tap the <strong>three dots</strong> menu in Chrome, then tap <strong>&quot;Add to Home Screen&quot;</strong> or <strong>&quot;Install App&quot;</strong>.
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleInstall}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-accent-primary text-white hover:bg-accent-light transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Installing..." : "Install App"}
            </button>
            <button
              onClick={handleDismissInstall}
              className="p-1.5 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
              aria-label="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Push notification banner
  if (dismissed || permission === "granted" || subscribed) {
    return null;
  }

  return (
    <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(12,12,18,0.6)] px-5 py-4">
      <div className="flex items-center gap-3 min-w-0">
        <svg
          className="w-5 h-5 text-accent-light flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        <p className="text-sm text-text-muted">
          Enable notifications to get check-in reminders and updates.
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={handleEnable}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-accent-primary text-white hover:bg-accent-light transition-colors disabled:opacity-50 cursor-pointer"
        >
          {loading ? "Enabling..." : "Enable"}
        </button>
        <button
          onClick={handleDismissPush}
          className="p-1.5 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
