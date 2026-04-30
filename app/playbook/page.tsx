import type { Metadata } from "next";
import Image from "next/image";
import PlaybookCTA from "@/components/PlaybookCTA";

export const metadata: Metadata = {
  title:
    "From Tradesman to Business Owner | The 10-Step Playbook (Free PDF)",
  description:
    "How Dan 5X'd his revenue, doubled his margins, and walked off the tools for good. The 10 steps he took, written down. Free download.",
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
            How Dan 5X&apos;d his revenue, doubled his margins, and walked off
            the tools for good. The exact 10 steps he took - written down,
            free.
          </p>

          {/* VSL THUMBNAIL */}
          <a
            href="#get"
            className="block max-w-[920px] mx-auto mb-10 group relative rounded-[18px] overflow-hidden border border-[rgba(34,114,222,0.18)] shadow-[0_30px_80px_rgba(0,0,0,0.45),0_0_50px_rgba(34,114,222,0.08)] transition-transform duration-300 hover:-translate-y-1"
            aria-label="Get the playbook"
          >
            <Image
              src="/images/playbook-vsl-thumbnail.png"
              alt="Marc Watters - 5x Revenue, 2x Profit Margin training"
              width={1660}
              height={930}
              priority
              className="w-full h-auto block"
            />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.25)_100%)] pointer-events-none" />
          </a>

          {/* Stats strip */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4 max-w-[680px] mx-auto mb-10">
            {[
              { stat: "5X", label: "Revenue Growth" },
              { stat: "2X", label: "Profit Margins" },
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
