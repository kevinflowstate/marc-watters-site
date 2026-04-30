import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your Playbook - From Tradesman to Business Owner",
  description:
    "Watch this short message from Marc, then download the 10-Step Playbook.",
};

// TODO: replace with the final hosted PDF URL once Marc finalises the v3 deliverable.
const PLAYBOOK_PDF_URL = "/downloads/marc-10-step-framework.pdf";

const VSL_EMBED_URL = "https://www.youtube.com/embed/4TSNSTe22v0";

export default function PlaybookThankYou() {
  return (
    <main className="min-h-screen flex items-center justify-center py-16 px-6 relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 20%, rgba(34,114,222,0.08) 0%, transparent 60%)",
        }}
      />

      <div className="max-w-[680px] mx-auto w-full relative z-10">
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

        {/* Confirmed */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-[rgba(34,222,100,0.08)] border border-[rgba(34,222,100,0.2)] rounded-full px-[18px] py-[7px] text-[0.72rem] font-semibold text-[#34de64] tracking-[0.5px] uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-[#34de64] shadow-[0_0_10px_rgba(34,222,100,0.5)]" />
            Playbook Ready
          </div>
        </div>

        {/* Headline */}
        <h1 className="text-center font-heading text-[2.2rem] md:text-[2.8rem] font-black leading-[1.08] tracking-[-1.5px] mb-3">
          Watch this first.{" "}
          <span className="text-accent-bright">Then grab it.</span>
        </h1>

        <p className="text-center text-text-secondary text-[1rem] leading-[1.7] max-w-[520px] mx-auto mb-8">
          Two minutes from me before you download. It&apos;ll change how you
          read what&apos;s in the PDF. Then hit the button below for the
          playbook.
        </p>

        {/* VSL */}
        <div className="bg-bg-card border border-[rgba(255,255,255,0.06)] rounded-2xl overflow-hidden mb-8">
          <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
            <iframe
              src={VSL_EMBED_URL}
              className="absolute inset-0 w-full h-full"
              title="Marc Watters - Playbook intro"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>

        {/* Download */}
        <a
          href={PLAYBOOK_PDF_URL}
          download="Marc-Watters-10-Step-Framework.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary group flex items-center justify-center gap-3 w-full text-center gradient-accent text-white font-heading font-bold py-5 px-8 rounded-xl text-[1.1rem] tracking-[-0.2px] transition-all hover:shadow-[0_0_40px_rgba(34,114,222,0.3)] hover:scale-[1.02]"
        >
          <svg
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            className="transition-transform group-hover:translate-y-0.5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.2}
              d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"
            />
          </svg>
          Click to Download the Guide
        </a>

        <p className="text-center text-text-muted text-[0.8rem] mt-4">
          We&apos;ve also emailed you a copy. Check your inbox.
        </p>

        {/* Separator */}
        <div className="my-12 border-t border-border-light" />

        {/* What's inside */}
        <div className="mb-10">
          <h2 className="font-heading font-bold text-text-primary text-[1.1rem] mb-5 text-center">
            What you&apos;ll get out of it
          </h2>

          <div className="space-y-4 max-w-[540px] mx-auto">
            {[
              "The 10 steps Dan used to go from £90k per year to £140k per month and triple his margins",
              "Why the order matters - and what breaks if you skip ahead",
              "The signs each stage is broken in your business right now",
              "What most trade and construction owners get wrong at every stage",
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

        {/* Book a call */}
        <div className="bg-bg-card border border-[rgba(34,114,222,0.15)] rounded-2xl p-6">
          <div className="text-center mb-5">
            <div className="text-[0.7rem] font-bold text-accent uppercase tracking-[2px] mb-2">
              Want To Talk It Through?
            </div>
            <div className="font-heading text-[1.3rem] font-black tracking-[-0.5px] mb-2">
              Book a call with me directly
            </div>
            <p className="text-text-secondary text-[0.92rem] leading-[1.7] max-w-[480px] mx-auto">
              No sales pitch. Just a proper deep dive on where your business
              is right now and which step you&apos;re actually stuck on. You
              leave with clarity either way.
            </p>
          </div>
          <iframe
            src="https://link.constructionbusinessblueprint.co.uk/widget/booking/4SOIodvlfHYmyzKvIAmn"
            style={{ width: "100%", border: "none", minHeight: "900px" }}
            id="4SOIodvlfHYmyzKvIAmn_playbook_thankyou"
          />
        </div>

        {/* Testimonials */}
        <div className="mt-16">
          <div className="text-center mb-8">
            <div className="text-[0.7rem] font-bold text-accent uppercase tracking-[2px] mb-2">
              Results
            </div>
            <div className="font-heading text-[1.5rem] sm:text-[1.85rem] font-black tracking-[-0.8px] mb-2">
              What clients say
            </div>
            <p className="text-text-secondary text-[0.92rem] leading-[1.7] max-w-[520px] mx-auto">
              Real outcomes from trade and construction business owners on the
              programme.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { id: "obge0_bDhqg", title: "Client Testimonial 1" },
              { id: "1FILP9frS9E", title: "Client Testimonial 2" },
              { id: "7eRY9Wgr67c", title: "Client Testimonial 3" },
            ].map((v) => (
              <div
                key={v.id}
                className="bg-[rgba(12,12,18,0.6)] border border-[rgba(255,255,255,0.04)] rounded-2xl overflow-hidden backdrop-blur-[10px]"
              >
                <div
                  className="relative w-full"
                  style={{ paddingTop: "177.78%" }}
                >
                  <iframe
                    className="absolute inset-0 w-full h-full"
                    src={`https://www.youtube.com/embed/${v.id}`}
                    title={v.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
