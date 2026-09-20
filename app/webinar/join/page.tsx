import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getEnv } from "@/lib/env";
import { WEBINAR } from "@/lib/webinar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Join From Chaos To Control",
  robots: { index: false, follow: false },
};

export default function WebinarJoinPage() {
  const joinUrl = getEnv("WEBINAR_JOIN_URL");
  if (joinUrl) {
    try {
      const parsed = new URL(joinUrl);
      if (parsed.protocol === "https:") redirect(parsed.toString());
    } catch {
      // Keep the safe pending state when the configured URL is invalid.
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-16 sm:px-8">
      <div className="mx-auto max-w-[620px] text-center">
        <Image src="/images/cbb-logo.png" alt="Construction Business Blueprint" width={56} height={56} className="mx-auto h-14 w-auto" priority />
        <p className="mt-9 text-xs font-bold uppercase tracking-[2.5px] text-accent-bright">Joining details coming soon</p>
        <h1 className="mt-4 font-heading text-[2.3rem] font-black leading-tight tracking-[-1.5px] sm:text-[3.2rem]">Your Zoom room is being prepared.</h1>
        <p className="mx-auto mt-5 max-w-[520px] text-base leading-8 text-text-secondary">We&apos;ll email your joining link before {WEBINAR.title}. Your calendar link will continue to point here, so you can use it when the workshop starts.</p>
        <div className="mt-8 rounded-2xl border border-white/[0.07] bg-white/[0.035] px-6 py-5">
          <p className="font-heading font-bold text-text-primary">{WEBINAR.dateLabel}</p>
          <p className="mt-1 text-sm text-text-muted">{WEBINAR.timeLabel} · Live on Zoom</p>
        </div>
      </div>
    </main>
  );
}
