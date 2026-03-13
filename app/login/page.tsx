"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/portal";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Fetch role via API to bypass RLS
      const roleRes = await fetch("/api/portal/me");
      const roleData = roleRes.ok ? await roleRes.json() : null;
      const role = roleData?.role;

      if (role === "admin") {
        router.push("/admin");
      } else {
        router.push("/portal");
      }
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-[400px] w-full">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block mb-4">
            <Image src="/images/cbb-logo.png" alt="CBB" width={48} height={48} className="h-12 w-auto mx-auto" />
          </Link>
          <h1 className="font-heading text-2xl font-black mb-2">Client Portal</h1>
          <p className="text-text-secondary text-sm">Sign in to access your dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-bg-card border border-[rgba(255,255,255,0.06)] rounded-[20px] p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-text-secondary mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full h-11 bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 text-text-primary text-sm focus:outline-none focus:border-accent/40 transition-colors"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-text-secondary mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full h-11 bg-bg-primary border border-[rgba(255,255,255,0.06)] rounded-xl px-4 text-text-primary text-sm focus:outline-none focus:border-accent/40 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 gradient-accent rounded-xl flex items-center justify-center text-white font-semibold text-sm disabled:opacity-60 transition-opacity"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-center text-text-muted text-xs mt-6">
          <Link href="/" className="text-text-muted hover:text-text-secondary transition-colors no-underline">
            Back to main site
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
