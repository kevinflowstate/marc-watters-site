import type { Metadata } from "next";
import Image from "next/image";
import PlaybookCTA from "@/components/PlaybookCTA";

export const metadata: Metadata = {
  title:
    "From Tradesman to Business Owner | The 10-Step Playbook (Free PDF)",
  description:
    "How Dan went from £90k per year to £140k per month, tripled his margins, and walked off the tools for good. The exact 10 steps he took - written down, free.",
};

export default function PlaybookOptIn() {
  return (
    <main>
      {/* HERO */}
      <section className="pt-10 pb-16 lg:pt-14 lg:pb-20 px-6 lg:px-8 relative overflow-hidden">
        <div
          className="absolute inset-0 z-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 70% 30%, rgba(34,114,222,0.10) 0%, transparent 55%), radial-gradient(ellipse at 20% 80%, rgba(34,114,222,0.05) 0%, transparent 45%), radial-gradient(ellipse at 50% 100%, rgba(5,5,7,1) 0%, transparent 60%)",
          }}
        />

        <div className="max-w-[1240px] mx-auto w-full relative z-[2]">
          {/* Brand bar */}
          <div className="flex items-center justify-center gap-3 mb-8 lg:mb-10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/cbb-logo.png"
              alt="CBB"
              width={32}
              height={32}
              className="h-[30px] w-auto"
            />
            <span className="font-heading font-extrabold text-[0.85rem] tracking-[-0.3px]">
              <span className="text-text-primary">CONSTRUCTION</span>{" "}
              <span className="text-accent-bright">BUSINESS BLUEPRINT</span>
            </span>
          </div>

          {/* Eyebrow */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center gap-2 bg-[rgba(34,114,222,0.08)] border border-[rgba(34,114,222,0.2)] rounded-full px-[18px] py-[7px] text-[0.78rem] font-semibold text-accent-bright tracking-[0.5px] uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_10px_var(--color-accent),0_0_20px_rgba(34,114,222,0.3)] animate-[pulse-dot_2s_ease-in-out_infinite]" />
              Free 10-Step Playbook · PDF
            </div>
          </div>

          {/* Headline */}
          <h1 className="font-heading text-center text-[2.1rem] sm:text-[2.6rem] lg:text-[3.6rem] font-black leading-[1.04] tracking-[-1.8px] mb-5 max-w-[920px] mx-auto">
            From Tradesman to{" "}
            <span className="text-accent-bright relative whitespace-nowrap">
              Business Owner.
              <span className="absolute -bottom-0.5 left-0 right-0 h-[3px] gradient-accent rounded-sm opacity-60" />
            </span>
          </h1>

          {/* Sub */}
          <p className="text-center text-[1.05rem] lg:text-[1.2rem] text-text-secondary leading-[1.6] mb-10 max-w-[680px] mx-auto">
            How Dan went from £90k per year, to £140k per month, tripled his
            margins, and walked off the tools for good. The exact 10 steps he
            took - written down, free.
          </p>

          {/* HERO MOCKUP - book + tablets + VSL composite, blended into page */}
          <a
            href="#get"
            className="block relative max-w-[1100px] mx-auto -mb-6 group"
            aria-label="Get the playbook"
            style={{ marginTop: "-12px" }}
          >
            {/* Ambient glow behind the mockup, bleeds into the page bg */}
            <div
              className="absolute -inset-x-20 -inset-y-10 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse 60% 55% at 30% 50%, rgba(120,60,220,0.18) 0%, transparent 65%), radial-gradient(ellipse 55% 50% at 75% 55%, rgba(34,114,222,0.22) 0%, transparent 65%)",
                filter: "blur(20px)",
                zIndex: 0,
              }}
            />
            {/* The mockup, with bottom fade into page so it doesn't sit like a card */}
            <Image
              src="/images/playbook-hero-mockup.png"
              alt="Marc Watters 10-Step Playbook book and training preview"
              width={1660}
              height={935}
              priority
              className="relative z-[1] w-full h-auto block transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-1"
              style={{
                WebkitMaskImage:
                  "linear-gradient(to bottom, transparent 0%, black 6%, black 70%, transparent 100%)",
                maskImage:
                  "linear-gradient(to bottom, transparent 0%, black 6%, black 70%, transparent 100%)",
                filter:
                  "drop-shadow(0 30px 60px rgba(0,0,0,0.55)) drop-shadow(0 0 80px rgba(34,114,222,0.18))",
              }}
            />
            {/* Floor reflection / fade out band so it merges into the next section */}
            <div
              className="absolute left-1/2 -translate-x-1/2 bottom-0 w-[80%] h-[12%] pointer-events-none z-[2]"
              style={{
                background:
                  "radial-gradient(ellipse at 50% 0%, rgba(34,114,222,0.10) 0%, transparent 70%)",
                filter: "blur(12px)",
              }}
            />
          </a>

          {/* Stats strip */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4 max-w-[680px] mx-auto mb-10">
            {[
              { stat: "£140k", label: "Per Month Revenue" },
              { stat: "3X", label: "Profit Margins" },
              { stat: "0", label: "Days On The Tools" },
            ].map((s, i) => (
              <div
                key={i}
                className="py-4 px-3 bg-[rgba(12,12,18,0.6)] border border-[rgba(255,255,255,0.06)] rounded-[14px] backdrop-blur-[10px] text-center"
              >
                <div className="font-heading font-black text-accent-bright text-[1.6rem] sm:text-[1.9rem] leading-none mb-1 tracking-[-1px]">
                  {s.stat}
                </div>
                <div className="text-[0.62rem] sm:text-[0.7rem] text-text-muted uppercase tracking-[1px] leading-tight">
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="text-center">
            <PlaybookCTA className="btn-primary inline-flex items-center gap-2 bg-accent text-white px-10 py-[18px] rounded-[12px] font-bold text-[1.05rem] no-underline transition-all duration-300 hover:-translate-y-[3px] hover:shadow-[0_10px_40px_rgba(34,114,222,0.4),0_0_60px_rgba(34,114,222,0.15)] cursor-pointer">
              Send Me The Playbook
              <svg
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
            </PlaybookCTA>
            <p className="text-[0.82rem] text-text-muted mt-3">
              Free PDF. No upsell. Just the playbook.
            </p>
          </div>
        </div>
      </section>

      {/* DAN'S STORY */}
      <section className="py-[100px] px-8 bg-bg-secondary relative">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(34,114,222,0.3)] to-transparent" />
        <div className="max-w-[820px] mx-auto">
          <div className="text-center mb-10">
            <div className="text-[0.75rem] font-bold text-accent uppercase tracking-[3px] mb-4">
              Dan&apos;s Story
            </div>
            <div className="font-heading text-[1.85rem] md:text-[2.5rem] font-black leading-[1.1] tracking-[-1.5px] mb-4">
              From Lost in the Van. To Running The Business.
            </div>
            <div className="w-[60px] h-[3px] gradient-accent rounded-sm mx-auto" />
          </div>

          <div className="space-y-5 text-text-secondary text-[1rem] leading-[1.8]">
            <p>
              When Dan came to me, he was knackered. Six days a week on site.
              Evenings spent quoting. Weekends spent chasing payments. Turnover
              under £90k. Margin paper-thin. No clear direction. No idea why
              he was working this hard for this little.
            </p>
            <p>
              He didn&apos;t need a course. He didn&apos;t need a vision board.
              He needed a structure. So we sat down and built one. Ten
              specific steps. In a specific order. Each one fixed something
              that was broken before we touched the next.
            </p>
            <p className="text-text-primary font-medium">
              Six months later, Dan replaced his entire previous annual
              turnover in a single month. Net margin went from sub-20% to
              45%. He stepped off the tools completely. The business runs
              without him in it.
            </p>
            <p>
              He&apos;s not the only one. But he&apos;s the cleanest example of
              what happens when a tradesman stops trying harder, and starts
              building a business properly.
            </p>
            <p>
              I&apos;ve written down the exact 10 steps Dan took. The order
              matters. The reasons matter. You can have it.
            </p>
          </div>
        </div>
      </section>

      {/* WHAT'S INSIDE */}
      <section className="py-[100px] px-8 relative">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 50% 30%, rgba(34,114,222,0.04) 0%, transparent 60%)",
          }}
        />
        <div className="max-w-[1000px] mx-auto relative">
          <div className="text-center mb-12">
            <div className="text-[0.75rem] font-bold text-accent uppercase tracking-[3px] mb-4">
              What&apos;s Inside
            </div>
            <div className="font-heading text-[1.85rem] md:text-[2.5rem] font-black leading-[1.1] tracking-[-1.5px] mb-4">
              The 10-Step Playbook
            </div>
            <div className="w-[60px] h-[3px] gradient-accent rounded-sm mx-auto" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
            {[
              {
                title: "The exact 10 steps Dan followed",
                desc: "From Founder First through to Compound. The full sequence.",
              },
              {
                title: "Why the order matters",
                desc: "Skip a step and the whole thing collapses. Here&apos;s why.",
              },
              {
                title: "The signs each step is broken",
                desc: "How to know which step you&apos;re actually stuck on right now.",
              },
              {
                title: "What most people get wrong",
                desc: "The default mistake at every stage - and how to avoid it.",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="bg-[rgba(12,12,18,0.6)] border border-[rgba(255,255,255,0.04)] rounded-[18px] px-6 py-7 backdrop-blur-[10px] transition-all duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] relative overflow-hidden group hover:-translate-y-1.5 hover:border-[rgba(34,114,222,0.3)] hover:shadow-[0_15px_40px_rgba(34,114,222,0.1),0_0_0_1px_rgba(34,114,222,0.1)]"
              >
                <div className="absolute top-0 left-0 right-0 h-0.5 gradient-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                <h3 className="font-heading text-[1.05rem] font-bold mb-2 text-text-primary">
                  {item.title}
                </h3>
                <p
                  className="text-[0.9rem] text-text-secondary leading-[1.7]"
                  dangerouslySetInnerHTML={{ __html: item.desc }}
                />
              </div>
            ))}
          </div>

          <div className="text-center">
            <p className="text-text-secondary text-[1rem] leading-[1.7] max-w-[600px] mx-auto">
              Same framework I run with private clients across the UK and
              Ireland. Written plainly. Built for trade and construction.
              Nothing held back.
            </p>
          </div>
        </div>
      </section>

      {/* PRODUCT SHOWCASE */}
      <section className="relative pt-6 pb-0 -mb-px overflow-hidden">
        {/* Vertical gradient that bleeds bg-primary into bg-secondary so the image lands on a continuous backdrop */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(to bottom, var(--color-bg-primary, #050507) 0%, #07070c 60%, var(--color-bg-secondary, #0a0a12) 100%)",
          }}
        />
        {/* Ambient side glows that match the lighting baked into the image */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 45% 50% at 18% 55%, rgba(120,60,220,0.18) 0%, transparent 65%), radial-gradient(ellipse 50% 50% at 82% 60%, rgba(34,114,222,0.18) 0%, transparent 65%)",
            filter: "blur(10px)",
          }}
        />

        <div className="relative max-w-[1100px] mx-auto px-6 lg:px-8">
          <div className="text-center max-w-[640px] mx-auto pb-2">
            <div className="text-[0.72rem] font-bold text-accent uppercase tracking-[3px] mb-3">
              The Playbook · Yours Free
            </div>
            <h3 className="font-heading text-[1.5rem] sm:text-[1.85rem] font-black leading-[1.1] tracking-[-1px] mb-3">
              30 pages. No filler. The exact 10 steps.
            </h3>
            <p className="text-text-secondary text-[0.95rem] leading-[1.7]">
              Read it on the laptop, the iPad, the phone on a Sunday morning -
              wherever you actually have ten quiet minutes.
            </p>
          </div>

          <div className="relative">
            <Image
              src="/images/playbook-book-tablets.png"
              alt="The 10-Step Tradesman to Business Owner Framework - book and tablet preview"
              width={1660}
              height={935}
              className="w-full h-auto block relative z-[1]"
              style={{
                WebkitMaskImage:
                  "linear-gradient(to bottom, transparent 0%, black 8%, black 72%, transparent 100%)",
                maskImage:
                  "linear-gradient(to bottom, transparent 0%, black 8%, black 72%, transparent 100%)",
                filter:
                  "drop-shadow(0 25px 50px rgba(0,0,0,0.55)) drop-shadow(0 0 80px rgba(34,114,222,0.15))",
              }}
            />
            {/* Floor highlight bleeds the mockup into the next section */}
            <div
              className="absolute left-1/2 -translate-x-1/2 bottom-0 w-[78%] h-[10%] pointer-events-none z-[2]"
              style={{
                background:
                  "radial-gradient(ellipse at 50% 0%, rgba(34,114,222,0.10) 0%, transparent 70%)",
                filter: "blur(14px)",
              }}
            />
          </div>
        </div>
      </section>

      {/* WHO THIS IS FOR */}
      <section className="py-[100px] px-8 bg-bg-secondary relative">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(34,114,222,0.2)] to-transparent" />
        <div className="max-w-[800px] mx-auto">
          <div className="text-center mb-10">
            <div className="text-[0.75rem] font-bold text-accent uppercase tracking-[3px] mb-4">
              Is This For You?
            </div>
            <div className="font-heading text-[1.85rem] md:text-[2.5rem] font-black leading-[1.1] tracking-[-1.5px] mb-4">
              Read This If
            </div>
            <div className="w-[60px] h-[3px] gradient-accent rounded-sm mx-auto" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              "You&apos;re a trade or construction business owner doing decent revenue but the profit doesn&apos;t match the effort",
              "You&apos;re still on the tools when you know you shouldn&apos;t be",
              "You&apos;ve got staff but the business stops moving the second you do",
              "You&apos;re working evenings and weekends and you can&apos;t see when it ends",
              "You&apos;ve tried courses, books, accountants - none of it stuck",
              "You want a proper structure, not another motivational quote",
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-3 text-[0.9rem] text-text-secondary p-4 bg-[rgba(12,12,18,0.6)] border border-[rgba(255,255,255,0.04)] rounded-xl backdrop-blur-[10px] transition-all duration-300 hover:border-[rgba(34,114,222,0.2)] hover:bg-[rgba(34,114,222,0.03)]"
              >
                <span className="mt-0.5 w-2 h-2 rounded-full bg-accent-bright shrink-0" />
                <span dangerouslySetInnerHTML={{ __html: item }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT MARC */}
      <section className="py-[80px] px-8 relative">
        <div className="max-w-[800px] mx-auto">
          <div className="flex gap-6 items-start">
            <Image
              src="/images/marc-about.png"
              alt="Marc Watters"
              width={120}
              height={160}
              className="w-[120px] h-[160px] rounded-[16px] object-cover shrink-0 border border-[rgba(255,255,255,0.06)] hidden sm:block"
            />
            <div>
              <div className="text-[0.75rem] font-bold text-accent uppercase tracking-[3px] mb-3">
                Who Wrote It
              </div>
              <div className="font-heading text-[1.4rem] font-black mb-3">
                Marc Watters
              </div>
              <p className="text-text-secondary text-[0.95rem] leading-[1.8] mb-3">
                20 years in construction. Started on building sites at fourteen.
                Apprentice to director level across major M&amp;E firms. Managed
                everything from one-man operations to sixty-million-pound
                companies.
              </p>
              <p className="text-text-secondary text-[0.95rem] leading-[1.8]">
                Now works privately with trade and construction business owners
                across the UK and Ireland to build companies that run with
                structure, profit, and control - without burning them out. No
                fluff. No guru nonsense. Straight talking.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section
        id="get"
        className="py-[100px] px-8 text-center relative overflow-hidden bg-bg-secondary"
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 50% 50%, rgba(34,114,222,0.08) 0%, transparent 60%)",
          }}
        />
        <div className="relative z-[1] max-w-[640px] mx-auto">
          <div className="text-[0.75rem] font-bold text-accent uppercase tracking-[3px] mb-4">
            Get The Playbook
          </div>
          <div className="font-heading text-[1.85rem] md:text-[2.5rem] font-black leading-[1.1] tracking-[-1.5px] mb-4">
            10 Steps. The Order. The Mistakes. Free.
          </div>
          <div className="w-[60px] h-[3px] gradient-accent rounded-sm mx-auto mb-6" />

          <p className="text-text-secondary text-[1rem] leading-[1.7] mb-8">
            Drop your details, watch a quick message from me, then download
            the PDF. That&apos;s it.
          </p>

          <PlaybookCTA className="btn-primary inline-flex items-center gap-2 bg-accent text-white px-11 py-[18px] rounded-[10px] font-bold text-[1.1rem] no-underline transition-all duration-300 hover:-translate-y-[3px] hover:shadow-[0_10px_40px_rgba(34,114,222,0.4),0_0_60px_rgba(34,114,222,0.15)] cursor-pointer">
            Send Me The Playbook
            <svg
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M17 8l4 4m0 0l-4 4m4-4H3"
              />
            </svg>
          </PlaybookCTA>

          <p className="text-text-muted text-[0.78rem] mt-4">
            One email. The playbook. No spam.
          </p>
        </div>
      </section>
    </main>
  );
}
