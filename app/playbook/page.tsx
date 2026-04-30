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
      <section className="min-h-[85vh] flex items-center pt-12 pb-20 px-8 relative overflow-hidden">
        <div
          className="absolute inset-0 z-[1] pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 70% 40%, rgba(34,114,222,0.07) 0%, transparent 55%), radial-gradient(ellipse at 20% 80%, rgba(34,114,222,0.04) 0%, transparent 40%), radial-gradient(ellipse at 50% 100%, rgba(5,5,7,1) 0%, transparent 50%)",
          }}
        />

        {/* Mobile hero */}
        <div className="absolute inset-0 lg:hidden z-0 pointer-events-none">
          <Image
            src="/images/marc-hero.png"
            alt="Marc Watters"
            width={800}
            height={900}
            className="w-full h-full object-cover object-[center_top] brightness-[0.3] contrast-[1.1]"
            priority
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to top, #050507 5%, rgba(5,5,7,0.7) 50%, transparent 100%)",
            }}
          />
        </div>

        <div className="max-w-[1400px] mx-auto w-full grid grid-cols-1 lg:grid-cols-2 items-center relative z-[3]">
          <div className="max-w-[600px] lg:pl-8">
            <div className="flex items-center gap-3 mb-8">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/cbb-logo.png"
                alt="CBB"
                width={34}
                height={34}
                className="h-[34px] w-auto"
              />
              <span className="font-heading font-extrabold text-[0.95rem] tracking-[-0.3px]">
                <span className="text-text-primary">CONSTRUCTION</span>{" "}
                <span className="text-accent-bright">BUSINESS BLUEPRINT</span>
              </span>
            </div>

            <div className="inline-flex items-center gap-2 bg-[rgba(34,114,222,0.08)] border border-[rgba(34,114,222,0.2)] rounded-full px-[18px] py-[7px] text-[0.78rem] font-semibold text-accent-bright mb-6 tracking-[0.5px] uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_10px_var(--color-accent),0_0_20px_rgba(34,114,222,0.3)] animate-[pulse-dot_2s_ease-in-out_infinite]" />
              Free 10-Step Playbook
            </div>

            <h1 className="font-heading text-[2.4rem] md:text-[3.5rem] font-black leading-[1.05] tracking-[-2px] mb-5">
              From Tradesman to{" "}
              <span className="text-accent-bright relative">
                Business Owner.
                <span className="absolute bottom-0.5 left-0 right-0 h-[3px] gradient-accent rounded-sm opacity-50" />
              </span>
            </h1>

            <p className="text-[1.15rem] text-text-secondary leading-[1.7] mb-4 max-w-[520px]">
              How Dan 5X&apos;d his revenue, doubled his margins, and walked
              off the tools for good. The 10 steps he took. Written down.
              Free.
            </p>

            <p className="text-[0.92rem] text-text-muted leading-[1.7] mb-8 max-w-[520px]">
              Under £90k a year, six days a week on site, evenings and
              weekends gone. Six months later he replaced his entire annual
              turnover in a single month - and stepped off the tools
              completely. This is the playbook he followed.
            </p>

            {/* Stats strip */}
            <div className="grid grid-cols-3 gap-3 mb-8">
              {[
                { stat: "500%", label: "Revenue Growth" },
                { stat: "2X", label: "Profit Margins" },
                { stat: "0", label: "Days On The Tools" },
              ].map((s, i) => (
                <div
                  key={i}
                  className="py-4 px-3 bg-[rgba(12,12,18,0.6)] border border-[rgba(255,255,255,0.06)] rounded-[14px] backdrop-blur-[10px] text-center"
                >
                  <div className="font-heading font-black text-accent-bright text-[1.5rem] md:text-[1.75rem] leading-none mb-1 tracking-[-1px]">
                    {s.stat}
                  </div>
                  <div className="text-[0.65rem] text-text-muted uppercase tracking-[1px] leading-tight">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            <PlaybookCTA className="btn-primary inline-flex items-center gap-2 bg-accent text-white px-9 py-4 rounded-[10px] font-bold text-base no-underline transition-all duration-300 hover:-translate-y-[3px] hover:shadow-[0_10px_40px_rgba(34,114,222,0.4),0_0_60px_rgba(34,114,222,0.15)] cursor-pointer">
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

          <div className="relative hidden lg:flex justify-end items-center -mr-8">
            <div className="absolute w-[500px] h-[500px] bg-[radial-gradient(circle,rgba(34,114,222,0.1)_0%,transparent_70%)] rounded-full top-[40%] right-[15%] -translate-y-1/2 pointer-events-none z-0" />
            <Image
              src="/images/marc-hero.png"
              alt="Marc Watters"
              width={800}
              height={900}
              className="w-[115%] max-w-none h-[85vh] min-h-[550px] object-cover object-[center_top] relative z-[1] brightness-[0.85] contrast-[1.1]"
              style={{
                WebkitMaskImage:
                  "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.4) 15%, rgba(0,0,0,0.8) 40%, rgba(0,0,0,1) 60%, rgba(0,0,0,0.6) 90%, transparent 100%), linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,1) 20%, rgba(0,0,0,1) 70%, transparent 100%)",
                WebkitMaskComposite: "source-in",
                maskImage:
                  "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.4) 15%, rgba(0,0,0,0.8) 40%, rgba(0,0,0,1) 60%, rgba(0,0,0,0.6) 90%, transparent 100%), linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,1) 20%, rgba(0,0,0,1) 70%, transparent 100%)",
                maskComposite: "intersect",
              }}
              priority
            />
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
