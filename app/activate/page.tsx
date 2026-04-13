"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function ActivateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function validateInvite() {
      if (!token) {
        setError("This activation link is missing its token.");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/auth/activate?token=${encodeURIComponent(token)}`);
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setError(data.error || "This activation link is no longer valid.");
          return;
        }

        setEmail(data.email || "");
        setFullName(data.fullName || "");
      } finally {
        setLoading(false);
      }
    }

    validateInvite();
  }, [token]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/auth/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not activate your account.");
        return;
      }

      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email || email,
        password,
      });

      if (signInError) {
        setSuccess(true);
        return;
      }

      router.push(data.redirect || "/portal");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-[440px]">
        <div className="text-center mb-8">
          <h1 className="font-heading text-3xl font-black text-text-primary">
            Activate Your Portal
          </h1>
          <p className="text-text-secondary text-sm mt-2">
            Create your password once and you are straight into Marc&apos;s client portal.
          </p>
        </div>

        <div className="bg-bg-card border border-[rgba(255,255,255,0.06)] rounded-[20px] p-8">
          {loading ? (
            <div className="space-y-4">
              <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-lg h-5 w-40" />
              <div className="animate-pulse bg-[rgba(255,255,255,0.04)] rounded-xl h-11" />
              <div className="animate-pulse bg-[rgba(255,255,255,0.04)] rounded-xl h-11" />
              <div className="animate-pulse bg-[rgba(255,255,255,0.06)] rounded-xl h-11" />
            </div>
          ) : error ? (
            <div>
              <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-sm">
                {error}
              </div>
              <p className="text-text-secondary text-sm">
                If you still need access, Marc can send you a fresh activation link from the portal.
              </p>
              <Link
                href="/login"
                className="mt-6 inline-flex text-sm font-medium text-accent-bright hover:text-accent-light no-underline"
              >
                Back to login
              </Link>
            </div>
          ) : success ? (
            <div>
              <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-sm">
                Your account is active and your password has been set.
              </div>
              <p className="text-text-secondary text-sm">
                Sign in with your email and new password to enter the portal.
              </p>
              <Link
                href="/login"
                className="mt-6 inline-flex text-sm font-medium text-accent-bright hover:text-accent-light no-underline"
              >
                Go to login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="mb-2">
                <div className="text-sm font-semibold text-text-primary">
                  {fullName ? `Welcome ${fullName.split(" ")[0]}` : "Welcome"}
                </div>
                <div className="text-xs text-text-muted mt-1">{email}</div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Create Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full h-11 bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 text-text-primary text-sm focus:outline-none focus:border-accent/40 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full h-11 bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 text-text-primary text-sm focus:outline-none focus:border-accent/40 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full h-11 gradient-accent rounded-xl flex items-center justify-center text-white font-semibold text-sm disabled:opacity-60 transition-opacity"
              >
                {saving ? "Activating..." : "Activate Account"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

export default function ActivatePage() {
  return (
    <Suspense>
      <ActivateContent />
    </Suspense>
  );
}
