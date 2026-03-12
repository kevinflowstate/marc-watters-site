import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Join the Programme | Construction Business Blueprint",
  description:
    "Choose your plan and secure your place on the Construction Business Blueprint.",
};

const plans = [
  {
    duration: "12 Months",
    type: "Pay in Full",
    price: "£8,000",
    sub: "One-time payment",
    href: "/pay/12-month",
    highlight: true,
  },
  {
    duration: "12 Months",
    type: "Split Pay",
    price: "£4,500",
    sub: "x2 payments, 4 weeks apart",
    href: "/pay/12-month-split",
    highlight: false,
  },
  {
    duration: "6 Months",
    type: "Pay in Full",
    price: "£5,000",
    sub: "One-time payment",
    href: "/pay/6-month",
    highlight: false,
  },
  {
    duration: "6 Months",
    type: "Split Pay",
    price: "£2,700",
    sub: "x2 payments, 4 weeks apart",
    href: "/pay/6-month-split",
    highlight: false,
  },
];

export default function JoinPage() {
  return (
    <main className="min-h-screen flex items-center justify-center py-20 px-8 relative">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, rgba(34,114,222,0.06) 0%, transparent 60%)",
        }}
      />

      <div className="max-w-[900px] mx-auto w-full relative z-10">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/cbb-logo.png"
            alt="CBB"
            width={56}
            height={56}
            className="h-14 w-auto"
          />
        </div>

        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-[rgba(34,114,222,0.08)] border border-[rgba(34,114,222,0.2)] rounded-full px-[18px] py-[7px] text-[0.78rem] font-semibold text-accent-bright mb-6 tracking-[0.5px] uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_10px_var(--color-accent),0_0_20px_rgba(34,114,222,0.3)]" />
            Secure Your Place
          </div>

          <h1 className="font-heading text-[2.5rem] md:text-[3.5rem] font-black leading-[1.08] tracking-[-2px] mb-6">
            Construction Business{" "}
            <span className="text-accent-bright relative">
              Blueprint
              <span className="absolute bottom-0.5 left-0 right-0 h-[3px] gradient-accent rounded-sm opacity-50" />
            </span>
          </h1>

          <p className="text-[1.1rem] text-text-secondary leading-[1.8] max-w-[600px] mx-auto">
            Private mentorship with Marc Watters. Choose the plan that works for
            you.
          </p>
        </div>

        {/* Plans grid */}
        <div className="grid md:grid-cols-2 gap-5">
          {plans.map((plan) => (
            <a
              key={plan.href}
              href={plan.href}
              className={`group bg-bg-card border rounded-[20px] overflow-hidden relative transition-all hover:scale-[1.02] hover:shadow-[0_30px_80px_rgba(0,0,0,0.4),0_0_60px_rgba(34,114,222,0.06)] ${
                plan.highlight
                  ? "border-[rgba(34,114,222,0.3)] shadow-[0_0_40px_rgba(34,114,222,0.08)]"
                  : "border-[rgba(255,255,255,0.06)]"
              }`}
            >
              {/* Top glow line */}
              <div className="absolute -top-px left-[20%] right-[20%] h-px bg-gradient-to-r from-transparent via-[rgba(34,114,222,0.4)] to-transparent" />

              {plan.highlight && (
                <div className="bg-gradient-to-r from-[#1a5bb5] via-[#2272DE] to-[#4a92f0] text-white text-xs font-semibold text-center py-1.5 tracking-[0.5px] uppercase">
                  Most Popular
                </div>
              )}

              <div className="p-8">
                {/* Duration badge */}
                <div className="inline-flex items-center gap-2 bg-[rgba(34,114,222,0.08)] border border-[rgba(34,114,222,0.2)] rounded-full px-3 py-1 text-[0.72rem] font-semibold text-accent-bright tracking-[0.5px] uppercase mb-4">
                  {plan.duration}
                </div>

                <div className="text-text-secondary text-sm font-medium mb-3">
                  {plan.type}
                </div>

                <div className="text-[2.5rem] font-heading font-black tracking-[-1.5px] text-text-primary leading-none mb-1">
                  {plan.price}
                </div>

                <p className="text-text-muted text-sm mb-6">{plan.sub}</p>

                <div className="btn-primary block w-full text-center gradient-accent text-white font-semibold py-3.5 px-6 rounded-xl text-[0.95rem] tracking-[-0.2px] transition-all group-hover:shadow-[0_0_30px_rgba(34,114,222,0.3)]">
                  Choose This Plan
                </div>
              </div>
            </a>
          ))}
        </div>

        {/* Included */}
        <div className="mt-12 text-center">
          <p className="text-text-muted text-sm uppercase tracking-[0.5px] font-semibold mb-5">
            Every plan includes
          </p>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3">
            {[
              "Private mentorship with Marc",
              "Weekly group coaching calls",
              "Full access to the CBB portal",
              "Direct support via WhatsApp",
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-2 text-text-secondary text-sm"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-accent-bright" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
