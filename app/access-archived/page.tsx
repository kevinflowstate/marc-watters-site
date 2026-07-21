"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AccessArchivedPage() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-bg-primary flex items-center justify-center px-4 py-12">
      <section className="w-full max-w-md rounded-2xl border border-[rgba(255,255,255,0.08)] bg-bg-card p-7 text-center shadow-2xl">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-300">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2h-1V7a5 5 0 00-10 0v4H6a2 2 0 00-2 2v6a2 2 0 002 2zm3-10V7a3 3 0 016 0v4H9z" />
          </svg>
        </div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">Portal access is inactive</h1>
        <p className="mt-3 text-sm leading-6 text-text-secondary">
          This account has been archived. Your historical portal records have been retained, but you can no longer access the client portal.
        </p>
        <p className="mt-3 text-xs leading-5 text-text-muted">
          If you think this is a mistake, contact Marc directly.
        </p>
        <button
          type="button"
          onClick={signOut}
          disabled={signingOut}
          className="mt-6 w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-white/5 px-4 py-2.5 text-sm font-semibold text-text-secondary transition-colors hover:bg-white/10 disabled:opacity-50"
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </section>
    </main>
  );
}
