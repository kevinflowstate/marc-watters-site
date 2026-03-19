import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Time Profit Control | Free Live Workshop",
  description:
    "Free live workshop for trade and construction business owners. Fix the three areas holding your business back: time, profit, and control.",
};

export default function WebinarOptIn() {
  return (
    <main className="min-h-screen flex items-center justify-center py-16 px-6 relative overflow-hidden">
      {/* Background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 20%, rgba(34,114,222,0.08) 0%, transparent 60%)",
        }}
      />

      <div className="max-w-[580px] mx-auto w-full relative z-10">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/cbb-logo.png"
            alt="CBB"
            width={36}
            height={36}
            className="h-9 w-auto"
          />
          <span className="font-heading font-extrabold text-[0.95rem] tracking-[-0.3px]">
            <span className="text-text-primary">CONSTRUCTION</span>{" "}
            <span className="text-accent-bright">BUSINESS BLUEPRINT</span>
          </span>
        </div>

        {/* Badge */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-[rgba(34,114,222,0.08)] border border-[rgba(34,114,222,0.2)] rounded-full px-[18px] py-[7px] text-[0.72rem] font-semibold text-accent-bright tracking-[0.5px] uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_10px_var(--color-accent),0_0_20px_rgba(34,114,222,0.3)]" />
            Free Live Workshop
          </div>
        </div>

        {/* Headline */}
        <h1 className="text-center font-heading text-[2.8rem] md:text-[3.5rem] font-black leading-[1.05] tracking-[-2px] mb-4">
          Time. Profit.{" "}
          <span className="text-accent-bright relative">
            Control.
            <span className="absolute bottom-0.5 left-0 right-0 h-[3px] gradient-accent rounded-sm opacity-50" />
          </span>
        </h1>

        {/* Subhead */}
        <p className="text-center text-text-secondary text-[1.05rem] leading-[1.7] max-w-[480px] mx-auto mb-8">
          The free workshop for trade and construction business owners who are
          flat out busy but the profit doesn&apos;t match the effort.
        </p>

        {/* Event details card */}
        <div className="bg-bg-card border border-[rgba(255,255,255,0.06)] rounded-2xl p-6 mb-8">
          <div className="grid grid-cols-3 text-center divide-x divide-border-light">
            <div>
              <div className="text-text-muted text-[0.7rem] uppercase tracking-[1px] mb-1">
                Date
              </div>
              <div className="text-text-primary font-heading font-bold text-[0.95rem]">
                Tues 1st April
              </div>
            </div>
            <div>
              <div className="text-text-muted text-[0.7rem] uppercase tracking-[1px] mb-1">
                Time
              </div>
              <div className="text-text-primary font-heading font-bold text-[0.95rem]">
                7:00 PM
              </div>
            </div>
            <div>
              <div className="text-text-muted text-[0.7rem] uppercase tracking-[1px] mb-1">
                Location
              </div>
              <div className="text-text-primary font-heading font-bold text-[0.95rem]">
                Live on Zoom
              </div>
            </div>
          </div>
        </div>

        {/* What you'll learn */}
        <div className="space-y-4 mb-10">
          {[
            "Why most construction businesses hit a ceiling - and it's got nothing to do with how hard you work",
            "The three areas that hold every trade business back (and the structural fix for each one)",
            "Practical steps you can put into your business the same week",
          ].map((item, i) => (
            <div key={i} className="flex gap-3 items-start">
              <span className="mt-1.5 w-2 h-2 rounded-full bg-accent-bright shrink-0" />
              <p className="text-text-secondary text-[0.95rem] leading-[1.6]">
                {item}
              </p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <a
          href="https://events.flowsite.pro/event.html?id=time-profit-control-mmxgp1ui"
          className="btn-primary block w-full text-center gradient-accent text-white font-heading font-bold py-4 px-8 rounded-xl text-[1.05rem] tracking-[-0.2px] transition-all hover:shadow-[0_0_40px_rgba(34,114,222,0.3)] hover:scale-[1.02]"
        >
          Register Free
        </a>

        <p className="text-center text-text-muted text-[0.8rem] mt-4">
          Limited to 50 businesses. No fluff. No theory. Just straight talking.
        </p>

        {/* Separator */}
        <div className="my-10 border-t border-border-light" />

        {/* About Marc */}
        <div className="flex gap-5 items-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/marc-hero.png"
            alt="Marc Watters"
            width={72}
            height={72}
            className="w-[72px] h-[72px] rounded-full object-cover shrink-0 border-2 border-border-light"
          />
          <div>
            <div className="font-heading font-bold text-text-primary text-[0.95rem] mb-1">
              Marc Watters
            </div>
            <p className="text-text-muted text-[0.85rem] leading-[1.6]">
              20 years in construction. Apprentice to director level across
              major M&E firms. Now helps trade and construction business owners
              build companies that run with structure, profit, and control.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
