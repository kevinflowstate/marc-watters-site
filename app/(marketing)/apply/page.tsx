import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "Apply for Coaching - Construction Business Blueprint",
  description: "Apply for private 1-to-1 mentorship with Marc Watters. For serious trade and construction business owners ready to build profit, structure, and a team that runs without them.",
  alternates: { canonical: "/apply" },
  openGraph: {
    title: "Apply for Coaching - Construction Business Blueprint",
    description: "Apply for private 1-to-1 mentorship with Marc Watters. For serious trade and construction business owners ready to build profit, structure, and a team that runs without them.",
    url: "/apply",
  },
};

export default function ApplyPage() {
  return (
    <main className="min-h-screen pt-[120px] pb-20 px-8">
      <div className="max-w-[700px] mx-auto text-center">
        <div className="text-[0.75rem] font-bold text-accent uppercase tracking-[3px] mb-4">Get Started</div>
        <h1 className="font-heading text-[2.75rem] font-black leading-[1.1] tracking-[-1.5px] mb-6">Apply for Coaching</h1>
        <div className="section-divider mx-auto" />
        <p className="text-text-secondary text-[1.05rem] leading-[1.8] mt-6 mb-12">Fill in the short application below. This isn&apos;t for everyone - it&apos;s for serious operators who are ready to do the work. If it looks like a fit, Marc will be in touch directly.</p>

        <div className="bg-bg-card border border-[rgba(255,255,255,0.06)] rounded-[20px] p-4 sm:p-8 overflow-hidden">
          <iframe
            src="https://link.constructionbusinessblueprint.co.uk/widget/booking/4SOIodvlfHYmyzKvIAmn"
            style={{ width: "100%", border: "none", minHeight: "600px", overflow: "hidden" }}
            scrolling="no"
            id="4SOIodvlfHYmyzKvIAmn_1774454401321"
            title="Book a Call"
          />
        </div>
        <p className="text-text-muted text-xs mt-4">
          Your information is kept strictly confidential and will only be used to assess your application.
        </p>
      </div>
      <Script src="https://link.constructionbusinessblueprint.co.uk/js/form_embed.js" strategy="lazyOnload" />
    </main>
  );
}
