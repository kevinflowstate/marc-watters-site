import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Marc Watters - Construction Business Mentor",
  description: "Marc Watters has spent years in the construction industry. He works privately with trade and construction business owners across the UK and Ireland to build profit, structure, and real systems.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About Marc Watters - Construction Business Mentor",
    description: "Marc Watters has spent years in the construction industry. He works privately with trade and construction business owners across the UK and Ireland to build profit, structure, and real systems.",
    url: "/about",
    images: [{ url: "/images/marc-about.png", alt: "Marc Watters" }],
  },
};

export default function AboutPage() {
  return (
    <main className="min-h-screen pt-[120px] pb-20 px-8">
      <div className="max-w-[800px] mx-auto">
        <div className="text-[0.75rem] font-bold text-accent uppercase tracking-[3px] mb-4">About</div>
        <h1 className="font-heading text-[2.75rem] font-black leading-[1.1] tracking-[-1.5px] mb-6">About Marc Watters</h1>
        <div className="section-divider" />
        <p className="text-text-secondary text-[1.05rem] leading-[1.8] mt-6">Full about page coming soon. Marc&apos;s story, background, and approach to construction business mentorship.</p>
      </div>
    </main>
  );
}
