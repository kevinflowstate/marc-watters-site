import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Welcome to CBB | Construction Business Blueprint",
  description: "Your payment has been received. Welcome to the Construction Business Blueprint.",
};

export default function ThankYouPage() {
  return (
    <main className="min-h-screen flex items-center justify-center py-20 px-8 relative">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, rgba(34,114,222,0.06) 0%, transparent 60%)",
        }}
      />

      <div className="max-w-[560px] mx-auto w-full relative z-10">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/cbb-logo.png" alt="CBB" width={56} height={56} className="h-14 w-auto" />
        </div>

        {/* Card */}
        <div className="bg-bg-card border border-[rgba(255,255,255,0.06)] rounded-[20px] overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.4),0_0_60px_rgba(34,114,222,0.04)] relative">
          <div className="absolute -top-px left-[20%] right-[20%] h-px bg-gradient-to-r from-transparent via-[rgba(34,114,222,0.4)] to-transparent" />

          <div className="p-10 text-center">
            {/* Success icon */}
            <div className="w-20 h-20 rounded-full bg-[rgba(16,185,129,0.1)] border border-[rgba(16,185,129,0.2)] flex items-center justify-center mx-auto mb-8">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <h1 className="font-heading text-[2rem] md:text-[2.5rem] font-black leading-[1.08] tracking-[-1.5px] mb-4">
              You&apos;re{" "}
              <span className="text-accent-bright relative">
                In
                <span className="absolute bottom-0.5 left-0 right-0 h-[3px] gradient-accent rounded-sm opacity-50" />
              </span>
            </h1>

            <p className="text-text-secondary text-[1.1rem] leading-[1.8] mb-8">
              Your payment has been received. Welcome to the Construction Business Blueprint.
            </p>

            <div className="h-px bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.06)] to-transparent mb-8" />

            <h2 className="font-heading text-lg font-bold mb-4">What happens next</h2>

            <div className="space-y-4 text-left mb-10">
              {[
                {
                  step: "1",
                  title: "Check your inbox",
                  desc: "You'll receive a confirmation email with everything you need to get started.",
                },
                {
                  step: "2",
                  title: "Join the group",
                  desc: "You'll be added to the private WhatsApp group where you can connect with Marc and the other members.",
                },
                {
                  step: "3",
                  title: "Book your first call",
                  desc: "Marc will be in touch to get your first session booked in.",
                },
              ].map((item) => (
                <div key={item.step} className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-[rgba(34,114,222,0.1)] border border-[rgba(34,114,222,0.2)] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-accent-bright text-sm font-bold">{item.step}</span>
                  </div>
                  <div>
                    <div className="font-semibold text-text-primary text-[0.95rem]">{item.title}</div>
                    <div className="text-text-secondary text-sm">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <a
              href="/"
              className="btn-primary inline-block gradient-accent text-white font-semibold py-3.5 px-10 rounded-xl text-[1rem] tracking-[-0.2px] transition-all hover:shadow-[0_0_30px_rgba(34,114,222,0.3)] hover:scale-[1.02]"
            >
              Back to Home
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
