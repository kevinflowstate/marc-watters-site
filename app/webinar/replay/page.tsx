import type { Metadata } from "next";
import BookCallPopup from "@/components/BookCallPopup";

export const metadata: Metadata = {
  title: "Webinar Replay - Time Profit Control",
  description:
    "Watch the Time Profit Control replay. Available for 48 hours only.",
};

export default function WebinarReplay() {
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

      <div className="max-w-[800px] mx-auto w-full relative z-10">
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

        {/* Replay badge */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-[rgba(222,160,34,0.08)] border border-[rgba(222,160,34,0.2)] rounded-full px-[18px] py-[7px] text-[0.72rem] font-semibold text-[#dea022] tracking-[0.5px] uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-[#dea022] shadow-[0_0_10px_rgba(222,160,34,0.5)] animate-[pulse-dot_2s_ease-in-out_infinite]" />
            Replay - Available for 48 Hours
          </div>
        </div>

        {/* Headline */}
        <h1 className="text-center font-heading text-[2.2rem] md:text-[2.8rem] font-black leading-[1.08] tracking-[-1.5px] mb-3">
          Didn&apos;t catch it live?
        </h1>

        <p className="text-center text-text-secondary text-[1.05rem] leading-[1.7] max-w-[520px] mx-auto mb-8">
          <span className="text-accent-bright font-heading font-bold">
            Time Profit Control
          </span>{" "}
          - Replay live for 48 hours.
        </p>

        {/* Fathom Video embed */}
        <div className="bg-bg-card border border-[rgba(255,255,255,0.06)] rounded-2xl overflow-hidden mb-8 shadow-[0_20px_60px_rgba(0,0,0,0.4),0_0_40px_rgba(34,114,222,0.06)]">
          <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
            <iframe
              src="https://fathom.video/embed/TVWZ_gsNNKVWzc-dUmGQBsMLqT_R77RE"
              className="absolute inset-0 w-full h-full"
              allow="autoplay; fullscreen"
              allowFullScreen
              frameBorder="0"
            />
          </div>
        </div>

        {/* Book a call CTA */}
        <div className="text-center mb-6">
          <BookCallPopup className="btn-primary inline-flex items-center gap-3 gradient-accent text-white font-heading font-bold py-4 px-10 rounded-xl text-[1.1rem] tracking-[-0.2px] transition-all hover:shadow-[0_0_40px_rgba(34,114,222,0.3)] hover:scale-[1.02] cursor-pointer">
            Book a Strategy Call with Marc
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
          </BookCallPopup>
        </div>

        <p className="text-center text-text-muted text-[0.85rem] leading-[1.7] max-w-[480px] mx-auto mb-10">
          If you watched the workshop and want to have a conversation about what
          this looks like with proper support behind you - book a call with Marc
          directly. No sales pitch. Just a business deep dive.
        </p>

        {/* Separator */}
        <div className="border-t border-border-light mb-10" />

        {/* What was covered */}
        <div className="mb-8">
          <h2 className="font-heading font-bold text-text-primary text-[1.1rem] mb-5 text-center">
            What was covered
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                icon: "\u23F1",
                title: "Time",
                desc: "Where your time actually goes and the structural fix to get it back.",
              },
              {
                icon: "\u00A3",
                title: "Profit",
                desc: "Why the profit doesn't match the effort - and what to change.",
              },
              {
                icon: "\u2699",
                title: "Control",
                desc: "How to build a business that runs without you doing everything.",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="bg-[rgba(12,12,18,0.6)] border border-[rgba(255,255,255,0.04)] rounded-[14px] px-5 py-6 backdrop-blur-[10px] text-center"
              >
                <div className="text-[1.4rem] mb-3">{item.icon}</div>
                <h3 className="font-heading text-[0.95rem] font-bold mb-2">
                  {item.title}
                </h3>
                <p className="text-[0.82rem] text-text-secondary leading-[1.6]">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="bg-bg-card border border-[rgba(34,114,222,0.15)] rounded-2xl p-8 text-center">
          <div className="font-heading text-[1.2rem] font-black tracking-[-0.5px] mb-2">
            Ready to take action?
          </div>
          <p className="text-text-secondary text-[0.88rem] leading-[1.7] mb-6 max-w-[440px] mx-auto">
            Marc works privately with a small number of trade and construction
            business owners. If you&apos;re serious, this is the next step.
          </p>
          <BookCallPopup className="btn-primary inline-flex items-center gap-2 bg-accent text-white px-9 py-[14px] rounded-[10px] font-bold text-base transition-all duration-300 hover:-translate-y-[2px] hover:shadow-[0_10px_40px_rgba(34,114,222,0.4)] cursor-pointer">
            Book Your Call
            <svg
              width="14"
              height="14"
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
          </BookCallPopup>
        </div>
      </div>
    </main>
  );
}
