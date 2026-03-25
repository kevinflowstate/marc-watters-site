import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "Book A Call | Construction Business Blueprint",
  description:
    "Book a call with Marc Watters to discuss how the Construction Business Blueprint can help you grow your construction business.",
};

export default function BookPage() {
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
                Book A Call
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
              Answer the questions honestly &amp; accurately and choose your slot
            </p>

            {/* Divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.06)] to-transparent mb-8" />

            {/* Calendar Embed */}
            <div className="w-full">
              <iframe
                src="https://link.constructionbusinessblueprint.co.uk/widget/booking/9SVdnjIjQsmtxsafPfBP"
                style={{ width: "100%", border: "none", overflow: "hidden" }}
                scrolling="no"
                id="9SVdnjIjQsmtxsafPfBP_1773832093345"
                className="min-h-[700px]"
              />
              <Script
                src="https://link.constructionbusinessblueprint.co.uk/js/form_embed.js"
                strategy="lazyOnload"
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
