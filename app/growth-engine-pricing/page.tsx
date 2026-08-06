import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AdminBackground from "@/components/admin/AdminBackground";
import GrowthEngineExperience from "@/components/portal/GrowthEngineExperience";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Growth Engine Pricing - Admin",
};

export const dynamic = "force-dynamic";

export default async function AdminGrowthEnginePricingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/growth-engine-pricing");
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    notFound();
  }

  return (
    <div className="portal-v2-shell relative min-h-screen bg-bg-primary">
      <AdminBackground />
      <main className="relative z-[1]">
        <div className="mx-auto max-w-[1240px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] pb-5">
            <Link
              href="/admin/growth-engine"
              className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-text-secondary no-underline transition-colors hover:text-text-primary"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="m15 18-6-6 6-6" />
              </svg>
              Back to Growth Engine
            </Link>
            <span className="rounded-full border border-accent/20 bg-accent/[0.07] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-accent-bright">
              Admin pricing view
            </span>
          </div>
          <GrowthEngineExperience previewUnlocked />
        </div>
      </main>
    </div>
  );
}
