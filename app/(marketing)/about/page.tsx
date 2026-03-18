import Link from "next/link";
import Image from "next/image";
import ScrollReveal from "@/components/ScrollReveal";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Marc Watters - Construction Business Mentor",
  description: "Marc Watters has spent years in the construction industry. He works privately with trade and construction business owners across the UK and Ireland to build profit, structure, and real systems.",
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
    <main>
      <ScrollReveal />
      <section className="pt-[160px] pb-[120px] px-8 relative">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 30% 20%, rgba(34,114,222,0.04) 0%, transparent 50%)" }} />
        <div className="max-w-[1000px] mx-auto relative">
          <div className="max-w-[700px] mb-16">
            <div className="text-[0.75rem] font-bold text-accent uppercase tracking-[3px] mb-4">About</div>
            <h1 className="font-heading text-[2.1rem] md:text-[3rem] font-black leading-[1.1] tracking-[-2px] mb-6">
              Marc Watters
            </h1>
            <div className="section-divider" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[0.85fr_1.15fr] gap-16">
            <div className="rounded-[20px] overflow-hidden border border-[rgba(255,255,255,0.06)] relative shadow-[0_30px_80px_rgba(0,0,0,0.4)] reveal">
              <Image src="/images/marc-about.png" alt="Marc Watters" width={500} height={667} className="w-full block object-cover" />
              <div className="absolute bottom-0 left-0 right-0 h-1/4 bg-gradient-to-t from-bg-primary to-transparent pointer-events-none" />
            </div>

            <div>
              <p className="text-text-secondary mb-5 leading-[1.85] text-[1rem] reveal">Marc Watters has spent years in the construction industry. Not watching from the sidelines - in it. Managing large-scale commercial projects, running teams, dealing with contractors, cashflow gaps, clients who moved goalposts, and weeks that never seemed to end. He&apos;s seen what a construction business looks like when it&apos;s working well and what it looks like when the owner is holding the whole thing together with his own two hands.</p>
              <p className="text-text-secondary mb-5 leading-[1.85] text-[1rem] reveal">When he left the corporate side of the industry, he wasn&apos;t done with construction. He started working directly with trade and construction business owners to help them fix the things holding them back. Pricing that didn&apos;t protect their margin. Teams that needed constant managing. Owners who couldn&apos;t take a day off without the phone going. He&apos;d seen all of it from the inside and knew exactly what the fixes looked like.</p>
              <p className="text-text-secondary mb-5 leading-[1.85] text-[1rem] reveal">Construction Business Blueprint is the result of everything he built and everything he learned along the way. It&apos;s not based on generic business theory. It&apos;s based on what actually works in this industry - with these clients, these timelines, these kinds of teams. Every plan he builds with a client is different because every business is different. That&apos;s the point.</p>
              <p className="text-text-secondary mb-5 leading-[1.85] text-[1rem] reveal">He&apos;s direct, practical, and doesn&apos;t waste your time. If something&apos;s not working in your business, he&apos;ll tell you. If you need to have a hard conversation with a team member, he&apos;ll help you prepare for it. This is 1-to-1 mentorship, not a course you work through on your own. He&apos;s involved from day one.</p>
            </div>
          </div>

          {/* His Approach */}
          <div className="mt-20 max-w-[760px]">
            <h2 className="font-heading text-[1.5rem] md:text-[2rem] font-black leading-[1.1] tracking-[-1px] mb-6 reveal">His Approach</h2>
            <p className="text-text-secondary leading-[1.85] text-[1rem] reveal">Marc works the way construction works. No corporate nonsense, no recycled frameworks, no 47-page templates you&apos;ll never look at again. He comes in, understands the business properly, builds a plan specific to it, and works through it with you week by week. Every session moves something forward. Every conversation is honest. He asks the questions that get to the real problem, not the surface one.</p>
          </div>

          {/* Who This Is For */}
          <div className="mt-20">
            <h2 className="font-heading text-[1.5rem] md:text-[2rem] font-black leading-[1.1] tracking-[-1px] mb-4 reveal">Who This Is For</h2>
            <p className="text-text-secondary leading-[1.85] text-[1rem] mb-8 reveal">This mentorship is for trade and construction business owners who are serious about changing how their business runs. If you&apos;re looking for a course to work through at your own pace, this isn&apos;t it.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                "Builders, electricians, plumbers, joiners, landscapers, groundworkers - any trade or construction discipline",
                "Business owners turning over 200k or more, or serious about getting there",
                "Owners who feel like the business still owns them - and want to change that",
                "People ready to lead properly, not just keep the wheels turning",
                "Anyone who wants more time, better margin, and a business that can run without them in every detail",
                "Sole traders scaling up, small teams growing, and established businesses that need restructuring",
              ].map((item, i) => (
                <div key={i} className={`flex items-start gap-3 text-[0.92rem] text-text-secondary p-4 bg-[rgba(12,12,18,0.6)] border border-[rgba(255,255,255,0.04)] rounded-xl backdrop-blur-[10px] transition-all duration-300 hover:border-[rgba(34,114,222,0.2)] hover:bg-[rgba(34,114,222,0.03)] reveal ${i > 0 ? `reveal-delay-${Math.min(i, 4)}` : ""}`}>
                  <span className="text-accent font-bold min-w-[16px]">-</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-[100px] px-8 bg-bg-secondary text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(34,114,222,0.06) 0%, transparent 60%)" }} />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(34,114,222,0.3)] to-transparent" />
        <div className="relative z-[1] max-w-[600px] mx-auto">
          <div className="font-heading text-[1.5rem] md:text-[2rem] font-black leading-[1.15] tracking-[-1px] mb-4">Ready to Build a Business That Actually Works?</div>
          <p className="text-[1rem] text-text-secondary mb-8 leading-[1.8]">If you&apos;re serious about taking back control of your time, your profit, and your business - this is where it starts.</p>
          <Link href="/apply" className="btn-primary inline-flex items-center gap-2 bg-accent text-white px-9 py-4 rounded-[10px] font-bold text-base no-underline transition-all duration-300 hover:-translate-y-[3px] hover:shadow-[0_10px_40px_rgba(34,114,222,0.4),0_0_60px_rgba(34,114,222,0.15)]">
            Apply for Mentorship
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          </Link>
        </div>
      </section>
    </main>
  );
}
