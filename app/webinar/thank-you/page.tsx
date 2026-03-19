import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "You're In - Time Profit Control",
  description: "You're registered for Time Profit Control. Watch this short video from Marc.",
};

export default function WebinarThankYou() {
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

      <div className="max-w-[640px] mx-auto w-full relative z-10">
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

        {/* Confirmed badge */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-[rgba(34,222,100,0.08)] border border-[rgba(34,222,100,0.2)] rounded-full px-[18px] py-[7px] text-[0.72rem] font-semibold text-[#34de64] tracking-[0.5px] uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-[#34de64] shadow-[0_0_10px_rgba(34,222,100,0.5)]" />
            You&apos;re Registered
          </div>
        </div>

        {/* Headline */}
        <h1 className="text-center font-heading text-[2.2rem] md:text-[2.8rem] font-black leading-[1.08] tracking-[-1.5px] mb-3">
          You&apos;re in.{" "}
          <span className="text-accent-bright">Watch this.</span>
        </h1>

        <p className="text-center text-text-secondary text-[1rem] leading-[1.7] max-w-[480px] mx-auto mb-8">
          Before you go - Marc has a quick message for you. Two minutes.
          Worth every second.
        </p>

        {/* VSL Video embed */}
        <div className="bg-bg-card border border-[rgba(255,255,255,0.06)] rounded-2xl overflow-hidden mb-8">
          <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
            <iframe
              src="https://drive.google.com/file/d/11IKrOna44VlMnk644ej3S2lg5uyHRow9/preview"
              className="absolute inset-0 w-full h-full"
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
          </div>
        </div>

        {/* Event details */}
        <div className="bg-bg-card border border-[rgba(255,255,255,0.06)] rounded-2xl p-6 mb-6">
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

        {/* Add to Calendar CTA */}
        <a
          href="https://events.flowsite.pro/event.html?id=time-profit-control-mmxgp1ui"
          className="btn-primary block w-full text-center gradient-accent text-white font-heading font-bold py-4 px-8 rounded-xl text-[1.05rem] tracking-[-0.2px] transition-all hover:shadow-[0_0_40px_rgba(34,114,222,0.3)] hover:scale-[1.02]"
        >
          Add to Calendar
        </a>

        <p className="text-center text-text-muted text-[0.8rem] mt-4">
          Check your email and WhatsApp - we&apos;ve sent your confirmation and
          Zoom link.
        </p>

        {/* Separator */}
        <div className="my-10 border-t border-border-light" />

        {/* What to expect */}
        <div className="mb-8">
          <h2 className="font-heading font-bold text-text-primary text-[1.1rem] mb-5">
            What to expect on the night
          </h2>

          <div className="space-y-4">
            {[
              "Why the profit doesn't match the effort - and the structural fix",
              "The three areas that hold every construction business back",
              "Practical steps you can implement in your business the same week",
              "Live Q&A with Marc at the end",
            ].map((item, i) => (
              <div key={i} className="flex gap-3 items-start">
                <span className="mt-1.5 w-2 h-2 rounded-full bg-accent-bright shrink-0" />
                <p className="text-text-secondary text-[0.92rem] leading-[1.6]">
                  {item}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Book a call section */}
        <div className="bg-bg-card border border-[rgba(34,114,222,0.15)] rounded-2xl p-6">
          <p className="text-center text-text-secondary text-[0.92rem] leading-[1.7] mb-6">
            If you&apos;re serious about making changes in your business, and you
            want to have a conversation about what that looks like with proper
            support behind you - book a call with Marc directly. No sales pitch.
            Just a business deep dive. You leave with clarity either way.
          </p>
          <iframe
            src="https://link.constructionbusinessblueprint.co.uk/widget/booking/4SOIodvlfHYmyzKvIAmn"
            style={{ width: "100%", border: "none", minHeight: "900px" }}
            id="4SOIodvlfHYmyzKvIAmn_1773929092861"
          />
        </div>
      </div>
    </main>
  );
}
