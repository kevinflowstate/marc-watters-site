"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { Suspense } from "react";

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsContent />
    </Suspense>
  );
}

function SettingsContent() {
  const router = useRouter();
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
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isSetup, setIsSetup] = useState(false);

  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("setup") === "true") setIsSetup(true);
  }, [searchParams]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/portal/me");
        if (res.ok) {
          const data = await res.json();
          setFullName(data.fullName || "");
          setAvatarUrl(data.avatarUrl || null);
          if (data.profile) {
            setPhone(data.profile.phone || "");
            setBusinessName(data.profile.business_name || "");
            setBusinessType(data.profile.business_type || "");
            setGoals(data.profile.goals || "");
          }
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast("File too large. Maximum 2MB.");
      return;
    }
    setUploadingAvatar(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/portal/avatar", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setAvatarUrl(data.avatarUrl);
      } else {
        toast("Failed to upload avatar. Please try again.");
      }
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const res = await fetch("/api/portal/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, phone, businessName, businessType, goals }),
    });

    setSaving(false);
    if (res.ok) {
      setSaved(true);
      toast("Settings saved successfully");
      setTimeout(() => setSaved(false), 3000);
    } else {
      toast("Failed to save settings. Please try again.");
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) return (
    <div className="max-w-2xl space-y-6">
      <div className="mb-8">
        <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-8 w-32 mb-2" />
        <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-4 w-56" />
      </div>
      <div className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-6">
        <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-5 w-32 mb-4" />
        <div className="flex items-center gap-5">
          <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-full w-20 h-20" />
          <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-xl h-9 w-28" />
        </div>
      </div>
      {[...Array(2)].map((_, i) => (
        <div key={i} className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-6 space-y-5">
          <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-5 w-24" />
          {[...Array(2)].map((_, j) => (
            <div key={j}>
              <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-4 w-20 mb-2" />
              <div className="animate-pulse bg-[rgba(255,255,255,0.04)] rounded-xl h-12 border border-[rgba(255,255,255,0.06)]" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold text-text-primary">Settings</h1>
        <p className="text-text-secondary mt-1">Update your profile information.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Profile Picture */}
        <div className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-6">
          <h2 className="text-lg font-heading font-bold text-text-primary mb-4">Profile Picture</h2>
          <div className="flex items-center gap-5">
            <div className="relative">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Profile"
                  className="w-20 h-20 rounded-full object-cover border-2 border-[rgba(255,255,255,0.1)]"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-accent/10 border-2 border-[rgba(255,255,255,0.1)] flex items-center justify-center">
                  <span className="text-2xl font-heading font-bold text-accent-bright">
                    {fullName ? fullName.charAt(0).toUpperCase() : "?"}
                  </span>
                </div>
              )}
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="px-4 py-2 text-sm font-medium text-accent-bright bg-accent/10 rounded-xl hover:bg-accent/20 transition-colors disabled:opacity-40 cursor-pointer"
              >
                {uploadingAvatar ? "Uploading..." : "Change Photo"}
              </button>
              <p className="text-xs text-text-muted mt-1.5">JPG, PNG. Max 2MB.</p>
            </div>
          </div>
        </div>

        <div className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-6 space-y-5">
          <h2 className="text-lg font-heading font-bold text-text-primary">Profile</h2>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm focus:outline-none focus:border-accent/40 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm focus:outline-none focus:border-accent/40 transition-colors"
            />
          </div>
        </div>

        <div className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-6 space-y-5">
          <h2 className="text-lg font-heading font-bold text-text-primary">Business Details</h2>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Business Name</label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm focus:outline-none focus:border-accent/40 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Business Type</label>
            <input
              type="text"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              placeholder="e.g. Plumbing, Electrical, Construction"
              className="w-full bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Goals</label>
            <textarea
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              rows={3}
              placeholder="What are you looking to achieve?"
              className="w-full bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors resize-none"
            />
          </div>
        </div>

        {/* Password section */}
        <div className="bg-bg-card border border-[rgba(255,255,255,0.04)] rounded-2xl p-6 space-y-5">
          <h2 className="text-lg font-heading font-bold text-text-primary">
            {isSetup ? "Set Your Password" : "Change Password"}
          </h2>
          {isSetup && (
            <p className="text-sm text-accent-bright">Welcome! Set a password to secure your account.</p>
          )}

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Type it again"
              className="w-full bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-3 text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors"
            />
          </div>

          {passwordMessage && (
            <div className={`text-sm px-4 py-2.5 rounded-xl ${
              passwordMessage.type === "success" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
            }`}>
              {passwordMessage.text}
            </div>
          )}

          <button
            type="button"
            disabled={!newPassword || newPassword.length < 8 || newPassword !== confirmPassword || passwordSaving}
            onClick={async () => {
              setPasswordSaving(true);
              setPasswordMessage(null);
              try {
                const supabase = createClient();
                const payload: { password: string; data?: Record<string, unknown> } = { password: newPassword };
                if (isSetup) {
                  payload.data = { requires_password_setup: false };
                }
                const { error } = await supabase.auth.updateUser(payload);
                if (error) {
                  setPasswordMessage({ type: "error", text: error.message });
                } else {
                  setPasswordMessage({ type: "success", text: "Password updated successfully" });
                  setNewPassword("");
                  setConfirmPassword("");
                  setIsSetup(false);
                }
              } catch {
                setPasswordMessage({ type: "error", text: "Something went wrong" });
              } finally {
                setPasswordSaving(false);
              }
            }}
            className="px-6 py-2.5 gradient-accent text-white rounded-xl text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-opacity"
          >
            {passwordSaving ? "Updating..." : isSetup ? "Set Password" : "Update Password"}
          </button>
        </div>

        <div className="flex items-center justify-between">
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-3 gradient-accent text-white rounded-xl text-sm font-semibold disabled:opacity-40 cursor-pointer transition-opacity"
          >
            {saving ? "Saving..." : saved ? (
              <span className="inline-flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Saved
              </span>
            ) : "Save Changes"}
          </button>

          <button
            type="button"
            onClick={handleSignOut}
            className="px-6 py-3 text-sm text-red-400 hover:text-red-300 transition-colors cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </form>
    </div>
  );
}
