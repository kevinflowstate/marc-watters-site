import type { Metadata } from "next";
import Image from "next/image";
import WebinarCTA from "@/components/WebinarCTA";

export const metadata: Metadata = {
  title: "Time Profit Control | Free Live Workshop for Trade & Construction Business Owners",
  description:
    "Free live workshop: fix the three areas holding your construction business back. Time, profit, and control. Tuesday 1st April at 7pm.",
};

export default function WebinarOptIn() {
  return (
    <main>
      {/* HERO */}
      <section className="min-h-[85vh] flex items-center pt-12 pb-20 px-8 relative overflow-hidden">
        {/* Gradient overlay */}
        <div
          className="absolute inset-0 z-[1] pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 70% 40%, rgba(34,114,222,0.07) 0%, transparent 55%), radial-gradient(ellipse at 20% 80%, rgba(34,114,222,0.04) 0%, transparent 40%), radial-gradient(ellipse at 50% 100%, rgba(5,5,7,1) 0%, transparent 50%)",
          }}
        />

        {/* Mobile hero image */}
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
          <div className="max-w-[580px] lg:pl-8">
            {/* Logo */}
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

            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-[rgba(34,114,222,0.08)] border border-[rgba(34,114,222,0.2)] rounded-full px-[18px] py-[7px] text-[0.78rem] font-semibold text-accent-bright mb-6 tracking-[0.5px] uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_10px_var(--color-accent),0_0_20px_rgba(34,114,222,0.3)] animate-[pulse-dot_2s_ease-in-out_infinite]" />
              Free Live Workshop - Limited Spaces
            </div>

            <h1 className="font-heading text-[2.4rem] md:text-[3.5rem] font-black leading-[1.05] tracking-[-2px] mb-5">
              Time. Profit.{" "}
              <span className="text-accent-bright relative">
                Control.
                <span className="absolute bottom-0.5 left-0 right-0 h-[3px] gradient-accent rounded-sm opacity-50" />
              </span>
            </h1>

            <p className="text-[1.1rem] text-text-secondary leading-[1.8] mb-4 max-w-[500px]">
              The free workshop for trade and construction business owners who
              are flat out busy but the profit doesn&apos;t match the effort.
            </p>

            <p className="text-[0.9rem] text-text-muted leading-[1.7] mb-8 max-w-[500px]">
              No theory. No motivational quotes. No vision boards. Just a
              straight-talking session built for how construction actually works.
            </p>

            {/* Event details inline */}
            <div className="flex gap-6 items-center flex-wrap mb-8 py-4 px-5 bg-[rgba(12,12,18,0.6)] border border-[rgba(255,255,255,0.06)] rounded-[14px] backdrop-blur-[10px]">
              <div>
                <div className="text-[0.65rem] text-text-muted uppercase tracking-[1px]">
                  Date
                </div>
                <div className="text-text-primary font-heading font-bold text-[0.95rem]">
                  Tues 1st April
                </div>
              </div>
              <div className="w-px h-8 bg-border-light" />
              <div>
                <div className="text-[0.65rem] text-text-muted uppercase tracking-[1px]">
                  Time
                </div>
                <div className="text-text-primary font-heading font-bold text-[0.95rem]">
                  7:00 PM
                </div>
              </div>
              <div className="w-px h-8 bg-border-light" />
              <div>
                <div className="text-[0.65rem] text-text-muted uppercase tracking-[1px]">
                  Location
                </div>
                <div className="text-text-primary font-heading font-bold text-[0.95rem]">
                  Live on Zoom
                </div>
              </div>
            </div>

            <WebinarCTA className="btn-primary inline-flex items-center gap-2 bg-accent text-white px-9 py-4 rounded-[10px] font-bold text-base no-underline transition-all duration-300 hover:-translate-y-[3px] hover:shadow-[0_10px_40px_rgba(34,114,222,0.4),0_0_60px_rgba(34,114,222,0.15)] cursor-pointer">
              Register Free
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
            </WebinarCTA>
            <p className="text-[0.82rem] text-text-muted mt-3">
              Limited to 50 businesses. Free. One session.
            </p>
          </div>

          {/* Desktop hero image */}
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

      {/* WHAT YOU'LL LEARN */}
      <section className="py-[100px] px-8 bg-bg-secondary relative">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(34,114,222,0.3)] to-transparent" />
        <div className="max-w-[1000px] mx-auto">
          <div className="text-center mb-12">
            <div className="text-[0.75rem] font-bold text-accent uppercase tracking-[3px] mb-4">
              What We&apos;ll Cover
            </div>
            <div className="font-heading text-[1.85rem] md:text-[2.5rem] font-black leading-[1.1] tracking-[-1.5px] mb-4">
              One Session. Everything You Need.
            </div>
            <div className="w-[60px] h-[3px] gradient-accent rounded-sm mx-auto" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                icon: "\u23F1",
                title: "Time",
                desc: "Why most construction businesses hit a ceiling - and it's got nothing to do with how hard you work. We'll dig into where time actually goes and how to get it back.",
              },
              {
                icon: "\u00A3",
                title: "Profit",
                desc: "The profit doesn't match the effort. That's not a work ethic problem - it's a structure problem. We'll break down the real fix for margins, pricing, and cash flow.",
              },
              {
                icon: "\u2699",
                title: "Control",
                desc: "You can't grow a business while you're knee deep in every job. We'll cover how to build something that actually runs without you doing everything yourself.",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="bg-[rgba(12,12,18,0.6)] border border-[rgba(255,255,255,0.04)] rounded-[18px] px-6 py-8 backdrop-blur-[10px] transition-all duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] relative overflow-hidden group hover:-translate-y-1.5 hover:border-[rgba(34,114,222,0.3)] hover:shadow-[0_15px_40px_rgba(34,114,222,0.1),0_0_0_1px_rgba(34,114,222,0.1)]"
              >
                <div className="absolute top-0 left-0 right-0 h-0.5 gradient-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="w-14 h-14 bg-[rgba(34,114,222,0.08)] border border-[rgba(34,114,222,0.12)] rounded-[14px] flex items-center justify-center mb-5 text-[1.4rem] text-accent-bright relative z-[1] transition-all duration-300 group-hover:bg-[rgba(34,114,222,0.15)] group-hover:shadow-[0_0_20px_rgba(34,114,222,0.2)]">
                  {item.icon}
                </div>
                <h3 className="font-heading text-[1.1rem] font-bold mb-3">
                  {item.title}
                </h3>
                <p className="text-[0.88rem] text-text-secondary leading-[1.7]">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <p className="text-text-secondary text-[1rem] leading-[1.7] max-w-[550px] mx-auto">
              Plus practical steps you can put into your business the same week.
              This is the same framework Marc uses with private clients across
              the UK and Ireland.
            </p>
          </div>
        </div>
      </section>

      {/* WHO THIS IS FOR */}
      <section className="py-[100px] px-8 relative">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 50% 30%, rgba(34,114,222,0.04) 0%, transparent 60%)",
          }}
        />
        <div className="max-w-[800px] mx-auto relative">
          <div className="text-center mb-10">
            <div className="text-[0.75rem] font-bold text-accent uppercase tracking-[3px] mb-4">
              Is This For You?
            </div>
            <div className="font-heading text-[1.85rem] md:text-[2.5rem] font-black leading-[1.1] tracking-[-1.5px] mb-4">
              Built for Trade and Construction
            </div>
            <div className="w-[60px] h-[3px] gradient-accent rounded-sm mx-auto" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              "You've got a team but the business still depends on you for everything",
              "You're working harder than ever but the profit doesn't reflect it",
              "You can't switch off - the business follows you home every night",
              "You're firefighting from morning to night instead of actually leading",
              "You've tried courses, books, accountants - nothing's stuck",
              "You want structure, control, and a business that actually works for you",
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-3 text-[0.9rem] text-text-secondary p-4 bg-[rgba(12,12,18,0.6)] border border-[rgba(255,255,255,0.04)] rounded-xl backdrop-blur-[10px] transition-all duration-300 hover:border-[rgba(34,114,222,0.2)] hover:bg-[rgba(34,114,222,0.03)]"
              >
                <span className="mt-0.5 w-2 h-2 rounded-full bg-accent-bright shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT MARC */}
      <section className="py-[80px] px-8 bg-bg-secondary relative">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(34,114,222,0.2)] to-transparent" />
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
                Your Host
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

      {/* REGISTER CTA */}
      <section
        id="register"
        className="py-[100px] px-8 text-center relative overflow-hidden"
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 50% 50%, rgba(34,114,222,0.08) 0%, transparent 60%)",
          }}
        />
        <div className="relative z-[1] max-w-[600px] mx-auto">
          <div className="text-[0.75rem] font-bold text-accent uppercase tracking-[3px] mb-4">
            Register Now
          </div>
          <div className="font-heading text-[1.85rem] md:text-[2.5rem] font-black leading-[1.1] tracking-[-1.5px] mb-4">
            Secure Your Spot
          </div>
          <div className="w-[60px] h-[3px] gradient-accent rounded-sm mx-auto mb-6" />

          <p className="text-text-secondary text-[1rem] leading-[1.7] mb-4">
            Tuesday 1st April at 7pm. Live on Zoom. One session. Free.
          </p>
          <p className="text-text-muted text-[0.88rem] leading-[1.7] mb-8">
            We&apos;ve got capacity for around 50 businesses. This isn&apos;t
            recorded and replayed. This is live, straight-talking, and built for
            serious operators.
          </p>

          <WebinarCTA className="btn-primary inline-flex items-center gap-2 bg-accent text-white px-11 py-[18px] rounded-[10px] font-bold text-[1.1rem] no-underline transition-all duration-300 hover:-translate-y-[3px] hover:shadow-[0_10px_40px_rgba(34,114,222,0.4),0_0_60px_rgba(34,114,222,0.15)] cursor-pointer">
            Register Free
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </WebinarCTA>

          <p className="text-text-muted text-[0.78rem] mt-4">
            No spam. No selling. Just the workshop details and your Zoom link.
          </p>
        </div>
      </section>
    </main>
  );
}
