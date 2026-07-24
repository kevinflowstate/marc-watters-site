"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { InlineNotice, PageSkeleton } from "@/components/ui/PortalState";
import { createClient } from "@/lib/supabase/client";
import { usePush, type PushSupportStatus } from "@/lib/use-push";
import { useToast } from "@/components/ui/Toast";

type Message = { type: "success" | "error"; text: string };

const inputClass =
  "w-full rounded-[var(--cbb-radius-sm)] border border-white/[0.08] bg-black/20 px-4 py-3 text-sm text-text-primary outline-none transition-[border-color,box-shadow] placeholder:text-text-muted focus:border-accent/55 focus:ring-2 focus:ring-accent/15";

const sectionIcons = {
  profile: "M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.118a7.5 7.5 0 0 1 15 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.5-1.632Z",
  business: "M3.75 21h16.5M4.5 3h15v18h-15V3Zm4.5 4.5h1.5m-1.5 4h1.5m3-4H15m-1.5 4H15M9 21v-4.5h6V21",
  notifications: "M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0",
  security: "M16.5 10.5V6.75a4.5 4.5 0 0 0-9 0v3.75m-.75 10.5h10.5a2.25 2.25 0 0 0 2.25-2.25v-6a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6A2.25 2.25 0 0 0 6.75 21Z",
  access: "M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3-3H9m0 0 3-3m-3 3 3 3",
};

function SectionIcon({ path }: { path: string }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent/20 bg-accent/[0.07] text-accent-bright">
      <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d={path} />
      </svg>
    </span>
  );
}

function SectionHeading({
  id,
  icon,
  title,
  description,
}: {
  id: string;
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3 lg:max-w-[13rem]">
      <SectionIcon path={icon} />
      <div>
        <h2 id={id} className="v2-section-title">{title}</h2>
        <p className="mt-1 text-xs leading-relaxed text-text-muted">{description}</p>
      </div>
    </div>
  );
}

function getNotificationState({
  checking,
  support,
  subscribed,
  permission,
}: {
  checking: boolean;
  support: PushSupportStatus;
  subscribed: boolean;
  permission: NotificationPermission;
}) {
  if (checking) {
    return { label: "Checking this device", detail: "Confirming browser notification access.", tone: "bg-text-muted" };
  }
  if (support === "unsupported") {
    return { label: "Not supported", detail: "This browser does not support web push notifications.", tone: "bg-text-muted" };
  }
  if (support === "denied") {
    return {
      label: "Blocked in browser",
      detail: "Enable notifications in your browser or device settings, then return here.",
      tone: "bg-amber-400",
    };
  }
  if (subscribed) {
    return {
      label: "Enabled on this device",
      detail: "Check-in reminders and portal updates can reach this device.",
      tone: "bg-emerald-400",
    };
  }
  if (permission === "granted") {
    return {
      label: "Registration incomplete",
      detail: "Permission is granted, but this device still needs to finish registering.",
      tone: "bg-amber-400",
    };
  }
  return {
    label: "Not enabled",
    detail: "Turn on reminders for check-ins, messages and calendar updates.",
    tone: "bg-text-muted",
  };
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-text-secondary">
      {children}
    </label>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsLoading />}>
      <SettingsContent />
    </Suspense>
  );
}

function SettingsLoading() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageSkeleton rows={5} />
    </div>
  );
}

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [goals, setGoals] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<Message | null>(null);
  const [isSetup, setIsSetup] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { permission, subscribed, checking: pushChecking, support: pushSupport, subscribe } = usePush();
  const [pushSaving, setPushSaving] = useState(false);
  const [pushMessage, setPushMessage] = useState<Message | null>(null);

  useEffect(() => {
    setIsSetup(searchParams.get("setup") === "true");
  }, [searchParams]);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setLoadError("");

      try {
        const response = await fetch("/api/portal/me");
        if (!response.ok) throw new Error("Unable to load your account details.");

        const data = await response.json();
        if (!active) return;

        setFullName(data.fullName || "");
        setAvatarUrl(data.avatarUrl || null);
        setPhone(data.profile?.phone || "");
        setBusinessName(data.profile?.business_name || "");
        setBusinessType(data.profile?.business_type || "");
        setGoals(data.profile?.goals || "");
      } catch {
        if (active) setLoadError("We couldn’t load your settings. Check your connection and try again.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [loadAttempt]);

  async function handleAvatarUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast("Choose a JPG or PNG image.");
      event.target.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast("File too large. Maximum 2MB.");
      event.target.value = "";
      return;
    }

    setUploadingAvatar(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/portal/avatar", { method: "POST", body: formData });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.avatarUrl) {
        toast(data.error || "Failed to upload avatar. Please try again.");
        return;
      }

      setAvatarUrl(data.avatarUrl);
      toast("Profile photo updated");
    } catch {
      toast("Failed to upload avatar. Check your connection and try again.");
    } finally {
      setUploadingAvatar(false);
      event.target.value = "";
    }
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setProfileMessage(null);

    try {
      const response = await fetch("/api/portal/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, phone, businessName, businessType, goals }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setProfileMessage({ type: "error", text: data.error || "We couldn’t save those changes. Please try again." });
        return;
      }

      setProfileMessage({ type: "success", text: "Your profile and business details are up to date." });
      toast("Settings saved successfully");
    } catch {
      setProfileMessage({ type: "error", text: "We couldn’t connect. Check your connection and try again." });
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordSave(event: React.FormEvent) {
    event.preventDefault();
    if (newPassword.length < 8) {
      setPasswordMessage({ type: "error", text: "Use at least 8 characters for your new password." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: "Your passwords do not match." });
      return;
    }

    setPasswordSaving(true);
    setPasswordMessage(null);

    try {
      const supabase = createClient();
      const payload: { password: string; data?: Record<string, unknown> } = { password: newPassword };
      if (isSetup) payload.data = { requires_password_setup: false };

      const { error } = await supabase.auth.updateUser(payload);
      if (error) {
        setPasswordMessage({ type: "error", text: error.message });
        return;
      }

      const completedSetup = isSetup;
      setPasswordMessage({ type: "success", text: "Your password has been updated." });
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswords(false);
      setIsSetup(false);
      if (completedSetup) router.replace("/portal/settings");
    } catch {
      setPasswordMessage({ type: "error", text: "Something went wrong. Please try again." });
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast("We couldn’t sign you out. Please try again.");
        return;
      }
      router.push("/login");
    } catch {
      toast("We couldn’t sign you out. Please try again.");
    } finally {
      setSigningOut(false);
    }
  }

  async function handleEnableNotifications() {
    setPushSaving(true);
    setPushMessage(null);

    try {
      const success = await subscribe();
      setPushMessage({
        type: success ? "success" : "error",
        text: success
          ? "Notifications are enabled on this device."
          : "Notification setup could not finish. Check your browser settings and try again.",
      });
    } finally {
      setPushSaving(false);
    }
  }

  if (loading) return <SettingsLoading />;

  if (loadError) {
    return (
      <div className="mx-auto max-w-5xl">
        <header className="mb-7">
          <div className="v2-eyebrow mb-3">Account preferences</div>
          <h1 className="v2-page-title">Settings</h1>
        </header>
        <div className="v2-surface p-5 sm:p-6">
          <InlineNotice
            tone="error"
            action={
              <button type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)} className="v2-button-secondary min-h-9 px-3 py-2">
                Try again
              </button>
            }
          >
            {loadError}
          </InlineNotice>
        </div>
      </div>
    );
  }

  const notificationState = getNotificationState({
    checking: pushChecking,
    support: pushSupport,
    subscribed,
    permission,
  });

  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const passwordReady = newPassword.length >= 8 && passwordsMatch;

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-7">
        <div className="v2-eyebrow mb-3">Account preferences</div>
        <h1 className="v2-page-title">Settings</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
          Keep your account, business details and device preferences up to date.
        </p>
      </header>

      {isSetup && (
        <InlineNotice tone="info" className="mb-5">
          <div>
            <div className="font-semibold text-text-primary">Finish securing your account</div>
            <div className="mt-0.5 text-xs text-text-secondary">Choose a password below before continuing to use the portal.</div>
          </div>
        </InlineNotice>
      )}

      <section className="v2-surface-strong mb-5 overflow-hidden p-5 sm:p-6" aria-label="Account summary">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt=""
                width={64}
                height={64}
                unoptimized
                className="h-16 w-16 shrink-0 rounded-[var(--cbb-radius-md)] border border-white/10 object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[var(--cbb-radius-md)] border border-accent/25 bg-accent/10 font-heading text-xl font-bold text-accent-bright">
                {fullName ? fullName.charAt(0).toUpperCase() : "?"}
              </div>
            )}
            <div className="min-w-0">
              <div className="v2-eyebrow">Your account</div>
              <div className="mt-1 truncate font-heading text-xl font-bold text-text-primary">{fullName || "Client profile"}</div>
              <div className="mt-0.5 truncate text-sm text-text-secondary">{businessName || "Add your business details below"}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--cbb-radius-sm)] border border-white/[0.07] bg-white/[0.07] sm:min-w-[17rem]">
            <div className="bg-black/25 px-3 py-2.5">
              <div className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-text-muted">Profile</div>
              <div className="mt-0.5 text-xs font-semibold text-text-primary">Editable</div>
            </div>
            <div className="bg-black/25 px-3 py-2.5">
              <div className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-text-muted">Security</div>
              <div className="mt-0.5 text-xs font-semibold text-text-primary">Password protected</div>
            </div>
          </div>
        </div>
      </section>

      <form onSubmit={handleSave} className="v2-surface mb-5 overflow-hidden">
        <section className="grid gap-6 border-b border-white/[0.06] p-5 sm:p-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10" aria-labelledby="profile-settings-title">
          <div>
            <SectionHeading id="profile-settings-title" icon={sectionIcons.profile} title="Profile" description="Your name, contact number and profile photo." />
          </div>

          <div className="min-w-0 space-y-5">
            <div className="flex flex-col gap-4 rounded-[var(--cbb-radius-md)] border border-white/[0.07] bg-white/[0.018] p-4 sm:flex-row sm:items-center">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt="Current profile"
                  width={64}
                  height={64}
                  unoptimized
                  className="h-16 w-16 rounded-full border border-white/10 object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-accent/20 bg-accent/10 font-heading text-lg font-bold text-accent-bright">
                  {fullName ? fullName.charAt(0).toUpperCase() : "?"}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" onChange={handleAvatarUpload} className="hidden" />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="v2-button-secondary cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {uploadingAvatar ? "Uploading…" : avatarUrl ? "Change photo" : "Add photo"}
                </button>
                <p className="mt-2 text-xs text-text-muted">JPG or PNG, up to 2MB.</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel htmlFor="full-name">Full name</FieldLabel>
                <input
                  id="full-name"
                  type="text"
                  autoComplete="name"
                  required
                  value={fullName}
                  onChange={(event) => {
                    setFullName(event.target.value);
                    setProfileMessage(null);
                  }}
                  className={inputClass}
                />
              </div>
              <div>
                <FieldLabel htmlFor="phone">Phone</FieldLabel>
                <input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(event) => {
                    setPhone(event.target.value);
                    setProfileMessage(null);
                  }}
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10" aria-labelledby="business-settings-title">
          <div>
            <SectionHeading id="business-settings-title" icon={sectionIcons.business} title="Business details" description="Context Marc and Blueprint AI use to support you." />
          </div>

          <div className="min-w-0 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel htmlFor="business-name">Business name</FieldLabel>
                <input
                  id="business-name"
                  type="text"
                  autoComplete="organization"
                  value={businessName}
                  onChange={(event) => {
                    setBusinessName(event.target.value);
                    setProfileMessage(null);
                  }}
                  className={inputClass}
                />
              </div>
              <div>
                <FieldLabel htmlFor="business-type">Business type</FieldLabel>
                <input
                  id="business-type"
                  type="text"
                  value={businessType}
                  onChange={(event) => {
                    setBusinessType(event.target.value);
                    setProfileMessage(null);
                  }}
                  placeholder="e.g. Plumbing or construction"
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <FieldLabel htmlFor="goals">Business goals</FieldLabel>
              <textarea
                id="goals"
                value={goals}
                onChange={(event) => {
                  setGoals(event.target.value);
                  setProfileMessage(null);
                }}
                rows={4}
                placeholder="What are you looking to achieve?"
                className={`${inputClass} resize-y`}
              />
              <p className="mt-2 text-xs leading-relaxed text-text-muted">Keep this current so guidance remains relevant to the business you are building.</p>
            </div>
          </div>
        </section>

        <div className="border-t border-white/[0.06] bg-white/[0.018] px-5 py-4 sm:px-6">
          {profileMessage && (
            <InlineNotice tone={profileMessage.type} className="mb-4">
              {profileMessage.text}
            </InlineNotice>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
            <p className="text-xs text-text-muted sm:mr-auto">Changes apply across your client portal.</p>
            <button type="submit" disabled={saving} className="v2-button-primary w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
              {saving ? "Saving changes…" : "Save profile changes"}
            </button>
          </div>
        </div>
      </form>

      <section className="v2-surface mb-5 grid gap-6 p-5 sm:p-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10" aria-labelledby="notification-settings-title">
        <div>
          <SectionHeading id="notification-settings-title" icon={sectionIcons.notifications} title="Notifications" description="Reminders and updates for this device." />
        </div>

        <div className="min-w-0">
          <div className="flex flex-col gap-4 rounded-[var(--cbb-radius-md)] border border-white/[0.07] bg-white/[0.018] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${notificationState.tone}`} />
              <div>
                <div className="text-sm font-semibold text-text-primary">{notificationState.label}</div>
                <p className="mt-1 text-xs leading-relaxed text-text-secondary">{notificationState.detail}</p>
              </div>
            </div>
            {pushSupport === "supported" && !subscribed && (
              <button
                type="button"
                onClick={handleEnableNotifications}
                disabled={pushChecking || pushSaving}
                className="v2-button-primary w-full shrink-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {pushSaving ? "Enabling…" : "Enable notifications"}
              </button>
            )}
          </div>
          {pushMessage && (
            <InlineNotice tone={pushMessage.type} className="mt-4">
              {pushMessage.text}
            </InlineNotice>
          )}
        </div>
      </section>

      <form aria-labelledby="security-settings-title" onSubmit={handlePasswordSave} className="v2-surface mb-5 grid gap-6 p-5 sm:p-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10">
        <div>
          <SectionHeading
            id="security-settings-title"
            icon={sectionIcons.security}
            title={isSetup ? "Set your password" : "Password"}
            description="Use at least eight characters to protect your account."
          />
        </div>

        <div className="min-w-0 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="new-password">New password</FieldLabel>
              <input
                id="new-password"
                type={showPasswords ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={8}
                value={newPassword}
                onChange={(event) => {
                  setNewPassword(event.target.value);
                  setPasswordMessage(null);
                }}
                placeholder="At least 8 characters"
                className={inputClass}
              />
            </div>
            <div>
              <FieldLabel htmlFor="confirm-password">Confirm password</FieldLabel>
              <input
                id="confirm-password"
                type={showPasswords ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  setPasswordMessage(null);
                }}
                placeholder="Type it again"
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={showPasswords}
                onChange={(event) => setShowPasswords(event.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-black/20 accent-[var(--color-accent)]"
              />
              Show password
            </label>
            {confirmPassword && !passwordsMatch && <span className="text-xs text-red-300">Passwords do not match.</span>}
            {passwordsMatch && newPassword.length < 8 && <span className="text-xs text-amber-300">Use at least 8 characters.</span>}
          </div>

          {passwordMessage && <InlineNotice tone={passwordMessage.type}>{passwordMessage.text}</InlineNotice>}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!passwordReady || passwordSaving}
              className="v2-button-primary w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
            >
              {passwordSaving ? "Updating password…" : isSetup ? "Set password" : "Update password"}
            </button>
          </div>
        </div>
      </form>

      <section className="v2-surface grid gap-6 p-5 sm:p-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10" aria-labelledby="access-settings-title">
        <div>
          <SectionHeading id="access-settings-title" icon={sectionIcons.access} title="Account access" description="End your current session on this device." />
        </div>
        <div className="flex min-w-0 flex-col gap-4 rounded-[var(--cbb-radius-md)] border border-white/[0.07] bg-white/[0.018] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-text-primary">Sign out of the portal</div>
            <p className="mt-1 text-xs leading-relaxed text-text-secondary">You will need your email address and password to sign back in.</p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="v2-button-secondary w-full shrink-0 cursor-pointer border-red-400/20 text-red-300 hover:border-red-400/35 hover:bg-red-500/[0.06] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </section>
    </div>
  );
}
