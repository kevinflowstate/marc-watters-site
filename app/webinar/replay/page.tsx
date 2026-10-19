import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

const replayUrl = "https://fathom.video/embed/vR5AaCzd_FS9U8N7GNE216LpvbcjXBzM";
const sourceUrl = "https://fathom.video/share/vR5AaCzd_FS9U8N7GNE216LpvbcjXBzM";

export const metadata: Metadata = {
  title: "From Chaos To Control — Webinar Replay",
  description: "Watch Marc Watters’ 15 October workshop for trade and construction business owners, then take the next step with a strategy call.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/webinar/replay" },
};

export default function WebinarReplay() {
  return (
    <main className="min-h-screen bg-[#050507] px-5 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-[1120px]">
        <header className="flex items-center gap-3 border-b border-white/15 pb-6">
          <Image src="/images/cbb-logo.png" alt="" width={46} height={46} className="h-10 w-auto sm:h-12" priority />
          <p className="font-heading text-[11px] font-extrabold leading-[1.4] tracking-[0.08em] sm:text-sm">CONSTRUCTION<br /><span className="text-[#5b9cff]">BUSINESS BLUEPRINT</span></p>
          <p className="ml-auto text-right text-xs leading-5 text-text-secondary">Marc Watters<br /><span className="text-white/50">Webinar replay</span></p>
        </header>
        <section aria-labelledby="replay-title" className="pb-7 pt-10 sm:pb-9 sm:pt-14">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-[#7ab0ff]">Recorded 15 October 2026</p>
          <h1 id="replay-title" className="max-w-[850px] font-heading text-[clamp(2.4rem,7vw,5.5rem)] font-extrabold uppercase leading-[0.98] tracking-[-0.055em]">From chaos<br /><span className="text-[#5b9cff]">to control.</span></h1>
          <p className="mt-6 max-w-[660px] text-base leading-7 text-text-secondary sm:text-lg sm:leading-8">The shift from tradesman to business owner. Watch Marc&apos;s workshop on building the structure, standards and team ownership that help a construction business depend less on its owner.</p>
        </section>
        <section aria-label="Watch the webinar replay">
          <div className="aspect-video overflow-hidden border border-white/20 bg-black shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
            <iframe src={replayUrl} title="From Chaos To Control — Marc Watters webinar, 15 October 2026" className="h-full w-full border-0" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
          </div>
          <p className="mt-3 text-sm leading-6 text-text-secondary">Player not loading? <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[#8dbbff] underline underline-offset-4 hover:text-white">Open the original recording</a>.</p>
        </section>
        <section aria-labelledby="next-step" className="mt-9 grid gap-6 border-y border-white/15 py-8 sm:mt-12 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-10 sm:py-10">
          <div>
            <h2 id="next-step" className="font-heading text-xl font-extrabold tracking-[-0.03em] sm:text-2xl">What would this look like in your business?</h2>
            <p className="mt-3 max-w-[640px] text-sm leading-7 text-text-secondary sm:text-base">Book a strategy call with Marc to talk through where the business is now, what keeps landing back on you, and the next changes worth making.</p>
          </div>
          <Link href="/book-marc" className="inline-flex min-h-12 items-center justify-center gap-3 rounded-lg bg-[#2272DE] px-6 py-4 text-center font-heading text-sm font-bold text-white transition hover:bg-[#1a5db8] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8dbbff]">Book a call with Marc <span aria-hidden="true">↗</span></Link>
        </section>
        <footer className="flex flex-wrap justify-between gap-3 py-7 text-xs leading-6 text-white/50">
          <p>Construction Business Blueprint · Marc Watters</p>
          <Link href="/privacy" className="underline underline-offset-4 hover:text-white">Privacy policy</Link>
        </footer>
      </div>
    </main>
  );
}
