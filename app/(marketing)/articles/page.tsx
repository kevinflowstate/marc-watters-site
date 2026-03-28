import Link from "next/link";
import { articles } from "@/lib/articles";
import ScrollReveal from "@/components/ScrollReveal";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Articles - Practical Advice for Construction Business Owners",
  description: "Practical advice on profit, systems, team building, and growth for trade and construction business owners. Written by Marc Watters.",
  alternates: { canonical: "/articles" },
  openGraph: {
    title: "Articles - Practical Advice for Construction Business Owners",
    description: "Practical advice on profit, systems, team building, and growth for trade and construction business owners. Written by Marc Watters.",
    url: "/articles",
  },
};

export default function ArticlesPage() {
  return (
    <main>
      <ScrollReveal />
      <section className="pt-[160px] pb-[120px] px-8 relative">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 30% 20%, rgba(34,114,222,0.04) 0%, transparent 50%)" }} />
        <div className="max-w-[1200px] mx-auto relative">
          <div className="max-w-[700px] mb-16">
            <div className="text-[0.75rem] font-bold text-accent uppercase tracking-[3px] mb-4">Articles</div>
            <h1 className="font-heading text-[2.1rem] md:text-[3rem] font-black leading-[1.1] tracking-[-2px] mb-6">
              Straight Talk for Construction Business Owners
            </h1>
            <div className="section-divider" />
            <p className="text-[1.05rem] text-text-secondary leading-[1.85] mt-6">
              No theory. No fluff. Practical articles on the real challenges of running a trade or construction business - from pricing and cash flow to team building and scaling.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map((a, i) => (
              <Link
                key={a.slug}
                href={`/articles/${a.slug}`}
                className={`group bg-[rgba(12,12,18,0.6)] border border-[rgba(255,255,255,0.04)] rounded-[18px] overflow-hidden backdrop-blur-[10px] transition-all duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] no-underline relative hover:-translate-y-1.5 hover:border-[rgba(34,114,222,0.3)] hover:shadow-[0_15px_40px_rgba(34,114,222,0.1),0_0_0_1px_rgba(34,114,222,0.1)] reveal ${i > 0 ? `reveal-delay-${Math.min(i, 4)}` : ""}`}
              >
                <div className="absolute top-0 left-0 right-0 h-0.5 gradient-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="h-[3px] gradient-accent" />
                <div className="p-7">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="bg-[rgba(34,114,222,0.08)] border border-[rgba(34,114,222,0.15)] rounded-full px-3 py-1 text-[0.7rem] font-semibold text-accent-light tracking-[0.3px]">{a.category}</span>
                    <span className="text-[0.72rem] text-text-muted">{a.readTime}</span>
                  </div>
                  <h2 className="font-heading text-[1.05rem] font-bold leading-[1.35] mb-3 text-text-primary group-hover:text-accent-bright transition-colors duration-300">{a.title}</h2>
                  <p className="text-[0.85rem] text-text-secondary leading-[1.7] mb-4">{a.excerpt}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[0.78rem] text-text-muted">{a.date}</span>
                    <span className="text-[0.82rem] font-semibold text-accent inline-flex items-center gap-1.5 group-hover:gap-2.5 transition-all duration-300">
                      Read
                      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-[100px] px-8 bg-bg-secondary text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(34,114,222,0.06) 0%, transparent 60%)" }} />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(34,114,222,0.3)] to-transparent" />
        <div className="relative z-[1] max-w-[600px] mx-auto">
          <div className="font-heading text-[1.5rem] md:text-[2rem] font-black leading-[1.15] tracking-[-1px] mb-4">Want to Fix These Problems in Your Business?</div>
          <p className="text-[1rem] text-text-secondary mb-8 leading-[1.8]">Reading about it is a start. Working with someone who&apos;s done it is how things actually change.</p>
          <Link href="/apply" className="btn-primary inline-flex items-center gap-2 bg-accent text-white px-9 py-4 rounded-[10px] font-bold text-base no-underline transition-all duration-300 hover:-translate-y-[3px] hover:shadow-[0_10px_40px_rgba(34,114,222,0.4),0_0_60px_rgba(34,114,222,0.15)]">
            Apply for Coaching
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          </Link>
        </div>
      </section>
    </main>
  );
}
