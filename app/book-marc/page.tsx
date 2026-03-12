"use client";

import { useEffect, useRef } from "react";

export default function BookMarcPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Inject the raw GHL embed HTML
    containerRef.current.innerHTML = `
      <iframe
        src="https://link.constructionbusinessblueprint.co.uk/widget/booking/4SOIodvlfHYmyzKvIAmn"
        style="width: 100%; border: none; overflow: hidden; min-height: 800px;"
        scrolling="no"
        id="4SOIodvlfHYmyzKvIAmn_1773313772148"
      ></iframe>
    `;

    // Load the GHL form embed script
    const script = document.createElement("script");
    script.src =
      "https://link.constructionbusinessblueprint.co.uk/js/form_embed.js";
    script.type = "text/javascript";
    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center py-20 px-8 relative">
      {/* Background gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, rgba(34,114,222,0.06) 0%, transparent 60%)",
        }}
      />

      <div className="max-w-[900px] mx-auto w-full relative z-10">
        {/* Hero section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-[rgba(34,114,222,0.08)] border border-[rgba(34,114,222,0.2)] rounded-full px-[18px] py-[7px] text-[0.78rem] font-semibold text-accent-bright mb-6 tracking-[0.5px] uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_10px_var(--color-accent),0_0_20px_rgba(34,114,222,0.3)]" />
            Book Your Call
          </div>

          <h1 className="font-heading text-[2.5rem] md:text-[3.5rem] font-black leading-[1.08] tracking-[-2px] mb-6">
            Book Your{" "}
            <span className="text-accent-bright relative">
              Slot
              <span className="absolute bottom-0.5 left-0 right-0 h-[3px] gradient-accent rounded-sm opacity-50" />
            </span>
          </h1>

          <p className="text-[1.1rem] text-text-secondary leading-[1.8] max-w-[600px] mx-auto">
            Pick the time that works for you, fill in your details and
            we&apos;ll see you soon.
          </p>
        </div>

        {/* Calendar embed container */}
        <div className="bg-bg-card border border-[rgba(255,255,255,0.06)] rounded-[20px] overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.4),0_0_60px_rgba(34,114,222,0.04)] relative">
          <div className="absolute -top-px left-[20%] right-[20%] h-px bg-gradient-to-r from-transparent via-[rgba(34,114,222,0.4)] to-transparent" />

          <div className="p-8" id="calendar-container" ref={containerRef}>
            {/* GHL calendar injected via useEffect */}
            <div className="min-h-[800px] flex items-center justify-center">
              <div className="text-text-muted text-sm">Loading calendar...</div>
            </div>
          </div>
        </div>

        {/* Footer note */}
        <div className="text-center mt-8">
          <p className="text-sm text-text-muted">
            Can&apos;t find a suitable time?{" "}
            <a
              href="mailto:mrwmanagement@outlook.com"
              className="text-accent hover:text-accent-bright transition-colors"
            >
              Get in touch
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
