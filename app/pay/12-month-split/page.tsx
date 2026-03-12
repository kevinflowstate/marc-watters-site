import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "12 Month Programme - Split Pay | Construction Business Blueprint",
  description: "Secure your place on the 12 month Construction Business Blueprint programme with split payments.",
};

export default function Pay12MonthSplitPage() {
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

          <div className="p-10">
            {/* Badge */}
            <div className="flex justify-center mb-6">
              <div className="inline-flex items-center gap-2 bg-[rgba(34,114,222,0.08)] border border-[rgba(34,114,222,0.2)] rounded-full px-[18px] py-[7px] text-[0.78rem] font-semibold text-accent-bright tracking-[0.5px] uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_10px_var(--color-accent),0_0_20px_rgba(34,114,222,0.3)]" />
                12 Month Programme
              </div>
            </div>

            <h1 className="font-heading text-[2rem] md:text-[2.5rem] font-black leading-[1.08] tracking-[-1.5px] text-center mb-3">
              Construction Business{" "}
              <span className="text-accent-bright relative">
                Blueprint
                <span className="absolute bottom-0.5 left-0 right-0 h-[3px] gradient-accent rounded-sm opacity-50" />
              </span>
            </h1>

            <p className="text-text-secondary text-center mb-8">
              12 months of private mentorship - split payment
            </p>

            {/* Price */}
            <div className="text-center mb-8">
              <div className="text-[3.5rem] font-heading font-black tracking-[-2px] text-text-primary leading-none">
                £4,500
              </div>
              <p className="text-text-muted text-sm mt-2">2 payments, 4 weeks apart</p>
            </div>

            {/* Payment breakdown */}
            <div className="bg-[rgba(34,114,222,0.04)] border border-[rgba(34,114,222,0.1)] rounded-xl p-5 mb-8">
              <div className="text-xs font-semibold text-accent-bright uppercase tracking-[0.5px] mb-3">Payment Schedule</div>
              <div className="space-y-2">
                {["Payment 1 - Today", "Payment 2 - 4 weeks later"].map((label) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-text-secondary">{label}</span>
                    <span className="text-text-primary font-medium">£4,500</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.06)] to-transparent mb-8" />

            {/* What's included */}
            <ul className="space-y-3 mb-10">
              {["Bespoke business plan", "1 to 1 onboarding session with Marc", "Full access to all CBB resources", "Weekly group coaching calls", "Direct support via WhatsApp"].map((item) => (
                <li key={item} className="flex items-start gap-3 text-text-secondary text-[0.95rem]">
                  <span className="w-5 h-5 rounded-full bg-[rgba(34,114,222,0.1)] border border-[rgba(34,114,222,0.2)] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-bright" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>

            {/* CTA */}
            <a
              href="https://link.constructionbusinessblueprint.co.uk/payment-link/69b2a25e7b7a1f7aeeb2819d"
              className="btn-primary block w-full text-center gradient-accent text-white font-semibold py-4 px-8 rounded-xl text-[1.05rem] tracking-[-0.2px] transition-all hover:shadow-[0_0_30px_rgba(34,114,222,0.3)] hover:scale-[1.02]"
            >
              Secure Your Place
            </a>

            <p className="text-text-muted text-xs text-center mt-4">
              You&apos;ll be taken to our secure payment page
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
