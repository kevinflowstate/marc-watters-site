import Link from "next/link";
import Image from "next/image";
import { articles, getArticleBySlug } from "@/lib/articles";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export function generateStaticParams() {
  return articles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) return {};
  return {
    title: `${article.title} - Marc Watters`,
    description: article.excerpt,
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) notFound();

  const currentIndex = articles.findIndex((a) => a.slug === slug);
  const related = articles.filter((_, i) => i !== currentIndex).slice(0, 2);

  return (
    <main>
      <article className="pt-[160px] pb-[100px] px-8 relative">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 10%, rgba(34,114,222,0.03) 0%, transparent 50%)" }} />
        <div className="max-w-[760px] mx-auto relative">
          <Link href="/articles" className="inline-flex items-center gap-2 text-text-muted text-[0.85rem] no-underline hover:text-accent-light transition-colors duration-300 mb-10">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 16l-4-4m0 0l4-4m-4 4h18" /></svg>
            All articles
          </Link>

          <div className="flex items-center gap-3 mb-6">
            <span className="bg-[rgba(34,114,222,0.08)] border border-[rgba(34,114,222,0.15)] rounded-full px-3 py-1 text-[0.72rem] font-semibold text-accent-light tracking-[0.3px]">{article.category}</span>
            <span className="text-[0.78rem] text-text-muted">{article.readTime}</span>
            <span className="text-[0.78rem] text-text-muted">-</span>
            <span className="text-[0.78rem] text-text-muted">{article.date}</span>
          </div>

          <h1 className="font-heading text-[1.85rem] md:text-[2.75rem] font-black leading-[1.1] tracking-[-1.5px] mb-4">{article.title}</h1>
          <p className="text-[1.1rem] text-text-secondary leading-[1.8] mb-10 border-l-2 border-accent pl-5">{article.excerpt}</p>

          <div className="flex items-center gap-4 mb-12 pb-10 border-b border-[rgba(255,255,255,0.06)]">
            <div className="w-11 h-11 bg-[rgba(34,114,222,0.1)] border border-[rgba(34,114,222,0.2)] rounded-full flex items-center justify-center">
              <Image src="/images/cbb-logo.png" alt="Marc Watters" width={24} height={24} className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[0.9rem] font-semibold text-text-primary">Marc Watters</div>
              <div className="text-[0.78rem] text-text-muted">Construction Business Mentor</div>
            </div>
          </div>

          <div className="space-y-6">
            {article.content.map((para, i) => (
              <p key={i} className="text-[1.02rem] text-text-secondary leading-[1.95]">{para}</p>
            ))}
          </div>

          {/* CTA box */}
          <div className="mt-16 bg-[rgba(12,12,18,0.6)] border border-[rgba(34,114,222,0.15)] rounded-[18px] p-10 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[3px] gradient-accent" />
            <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(34,114,222,0.06) 0%, transparent 60%)" }} />
            <div className="relative z-[1]">
              <div className="font-heading text-[1.3rem] font-bold mb-3">Ready to Put This Into Practice?</div>
              <p className="text-[0.95rem] text-text-secondary mb-6 max-w-[500px] mx-auto leading-[1.7]">Marc works privately with construction business owners who want real structure, real profit, and a business that doesn't depend on them doing everything.</p>
              <Link href="/apply" className="btn-primary inline-flex items-center gap-2 bg-accent text-white px-8 py-3.5 rounded-[10px] font-bold text-[0.95rem] no-underline transition-all duration-300 hover:-translate-y-[3px] hover:shadow-[0_10px_40px_rgba(34,114,222,0.4),0_0_60px_rgba(34,114,222,0.15)]">
                Apply for Coaching
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </Link>
            </div>
          </div>
        </div>
      </article>

      {/* Related articles */}
      {related.length > 0 && (
        <section className="py-[80px] px-8 bg-bg-secondary relative">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(34,114,222,0.15)] to-transparent" />
          <div className="max-w-[760px] mx-auto">
            <div className="font-heading text-[1.15rem] font-bold mb-8">More Articles</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {related.map((a) => (
                <Link
                  key={a.slug}
                  href={`/articles/${a.slug}`}
                  className="group bg-[rgba(12,12,18,0.6)] border border-[rgba(255,255,255,0.04)] rounded-[14px] p-6 no-underline transition-all duration-300 hover:border-[rgba(34,114,222,0.2)] hover:shadow-[0_10px_30px_rgba(34,114,222,0.08)]"
                >
                  <span className="bg-[rgba(34,114,222,0.08)] border border-[rgba(34,114,222,0.15)] rounded-full px-2.5 py-0.5 text-[0.68rem] font-semibold text-accent-light tracking-[0.3px]">{a.category}</span>
                  <h3 className="font-heading text-[0.95rem] font-bold leading-[1.35] mt-3 mb-2 text-text-primary group-hover:text-accent-bright transition-colors duration-300">{a.title}</h3>
                  <p className="text-[0.82rem] text-text-secondary leading-[1.6]">{a.excerpt}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
