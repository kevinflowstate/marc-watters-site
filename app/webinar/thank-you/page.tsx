import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { WEBINAR, WEBINAR_BOOKING_PATH, WEBINAR_CALENDAR_URL } from "@/lib/webinar";

export const metadata: Metadata = {
  title: "From Chaos To Control | What To Do Next",
  description: "Watch this short message from Marc before the live workshop.",
  robots: { index: false, follow: false },
};

export default function WebinarThankYou() {
  return (
    <main className="relative min-h-screen overflow-hidden px-5 py-12 sm:px-8 sm:py-16">
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 8%, rgba(34,114,222,0.13) 0%, transparent 48%)" }} />
      <div className="relative z-10 mx-auto max-w-[820px]">
        <div className="flex items-center justify-center gap-3">
          <Image src="/images/cbb-logo.png" alt="Construction Business Blueprint" width={42} height={42} className="h-10 w-auto" priority />
          <span className="font-heading text-sm font-extrabold"><span className="text-text-primary">CONSTRUCTION</span>{" "}<span className="text-accent-bright">BUSINESS BLUEPRINT</span></span>
        </div>

        <div className="mt-9 text-center">
          <div className="inline-flex items-center rounded-full border border-accent/25 bg-accent/10 px-4 py-2 text-xs font-bold uppercase tracking-[1.5px] text-accent-bright">Before the workshop</div>
          <h1 className="mt-5 font-heading text-[2.4rem] font-black leading-[1.05] tracking-[-1.8px] sm:text-[3.5rem]">
            Your workshop details.
            <br /><span className="gradient-text">Here&apos;s what to do next.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-[620px] text-base leading-7 text-text-secondary">Watch this short video from Marc, then add the live workshop to your calendar. Your joining details will arrive by email.</p>
        </div>

        <div className="mt-9 overflow-hidden rounded-[20px] border border-white/[0.08] bg-bg-card shadow-[0_25px_70px_rgba(0,0,0,0.45)]">
          <video controls playsInline preload="metadata" poster="/images/webinar/marc-webinar-thank-you-vsl-poster.jpg" className="aspect-video w-full bg-black" aria-label="A message from Marc Watters about the From Chaos To Control workshop">
            <source src="/media/webinar/marc-webinar-thank-you-vsl.mp4" type="video/mp4" />
            <track kind="captions" src="/media/webinar/marc-webinar-thank-you-vsl.en-GB.vtt" srcLang="en-GB" label="English" default />
            Your browser does not support embedded video.
          </video>
        </div>

        <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[["Date", WEBINAR.shortDateLabel], ["Time", WEBINAR.timeLabel], ["Where", "Live on Zoom"]].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/[0.07] bg-white/[0.035] px-5 py-4 text-center">
              <div className="text-[0.67rem] font-bold uppercase tracking-[1.5px] text-text-muted">{label}</div>
              <div className="mt-1 font-heading text-sm font-bold text-text-primary">{value}</div>
            </div>
          ))}
        </div>

        <a href={WEBINAR_CALENDAR_URL} className="btn-primary gradient-accent mt-5 flex w-full items-center justify-center rounded-xl px-7 py-4 font-heading font-bold text-white transition hover:-translate-y-0.5 hover:shadow-[0_14px_45px_rgba(34,114,222,0.3)]">
          Add to my calendar
        </a>
        <p className="mt-3 text-center text-xs leading-5 text-text-muted">Your joining details will be sent by email. If you opted in to WhatsApp, we&apos;ll send them there too.</p>

        <div className="my-12 border-t border-white/[0.07]" />

        <section className="rounded-[22px] border border-accent/20 bg-accent/[0.055] p-6 text-center sm:p-9">
          <p className="text-xs font-bold uppercase tracking-[2.5px] text-accent-bright">Want to work through it sooner?</p>
          <h2 className="mt-3 font-heading text-2xl font-black tracking-[-0.8px]">Book a business deep dive with Marc</h2>
          <p className="mx-auto mt-4 max-w-[620px] text-sm leading-7 text-text-secondary">We&apos;ll look at your numbers, team, jobs and where your time is going, then discuss what to address first.</p>
          <Link href={WEBINAR_BOOKING_PATH} className="mt-6 inline-flex rounded-xl border border-accent/40 bg-accent px-7 py-3.5 font-bold text-white transition hover:-translate-y-0.5 hover:bg-accent-light">Book a call with Marc</Link>
        </section>
      </div>
    </main>
  );
}
