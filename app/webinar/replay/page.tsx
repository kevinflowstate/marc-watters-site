import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { WEBINAR } from "@/lib/webinar";

export const metadata: Metadata = {
  title: "From Chaos To Control Replay",
  description: "Replay information for From Chaos To Control.",
  robots: { index: false, follow: false },
};

export default function WebinarReplay() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-16 sm:px-8">
      <div className="mx-auto max-w-[620px] text-center">
        <Image src="/images/cbb-logo.png" alt="Construction Business Blueprint" width={56} height={56} className="mx-auto h-14 w-auto" priority />
        <p className="mt-9 text-xs font-bold uppercase tracking-[2.5px] text-accent-bright">Replay not available yet</p>
        <h1 className="mt-4 font-heading text-[2.3rem] font-black leading-tight tracking-[-1.5px] sm:text-[3.2rem]">Join us live for {WEBINAR.title}.</h1>
        <p className="mx-auto mt-5 max-w-[520px] text-base leading-8 text-text-secondary">The workshop takes place on {WEBINAR.dateLabel} at {WEBINAR.timeLabel}. We&apos;ll only share replay details if a recording is made available after the event.</p>
        <Link href="/webinar#register" className="btn-primary gradient-accent mt-8 inline-flex rounded-xl px-7 py-3.5 font-bold text-white transition hover:-translate-y-0.5">Register for the live workshop</Link>
      </div>
    </main>
  );
}
