import Link from "next/link";
import ScrollReveal from "@/components/ScrollReveal";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Client Results & Testimonials",
  description: "Real results from trade and construction business owners on the Construction Business Blueprint programme. Improved margins, stronger teams, and businesses that run without the owner.",
  alternates: { canonical: "/testimonials" },
  openGraph: {
    title: "Client Results & Testimonials | Marc Watters",
    description: "Real results from trade and construction business owners on the Construction Business Blueprint programme.",
    url: "/testimonials",
  },
};

const videoTestimonials = [
  { id: "obge0_bDhqg", title: "Client Testimonial 1" },
  { id: "1FILP9frS9E", title: "Client Testimonial 2" },
  { id: "7eRY9Wgr67c", title: "Client Testimonial 3" },
];

const podcastEpisode = {
  id: "4TSNSTe22v0",
  title: "Podcast with Client",
};

export default function TestimonialsPage() {
  return (
    <main>
      <ScrollReveal />
      <section className="pt-[160px] pb-[120px] px-8 relative">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 30% 20%, rgba(34,114,222,0.04) 0%, transparent 50%)" }} />
        <div className="max-w-[1000px] mx-auto relative">
          <div className="max-w-[700px] mb-16">
            <div className="text-[0.75rem] font-bold text-accent uppercase tracking-[3px] mb-4">Results</div>
            <h1 className="font-heading text-[2.1rem] md:text-[3rem] font-black leading-[1.1] tracking-[-2px] mb-6">
              What Clients Are Saying
            </h1>
            <div className="section-divider" />
            <p className="text-[1.05rem] text-text-secondary leading-[1.85] mt-6">
              Real results from trade and construction business owners on the programme. No scripts. No actors. Just honest feedback from people doing the work.
            </p>
          </div>

          {/* Video Testimonials */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
            {videoTestimonials.map((v, i) => (
              <div
                key={v.id}
                className={`bg-[rgba(12,12,18,0.6)] border border-[rgba(255,255,255,0.04)] rounded-[18px] overflow-hidden backdrop-blur-[10px] reveal ${i > 0 ? `reveal-delay-${i}` : ""}`}
              >
                <div className="relative w-full" style={{ paddingTop: "177.78%" }}>
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

          {/* Podcast Episode */}
          <div className="reveal">
            <div className="text-[0.75rem] font-bold text-accent uppercase tracking-[3px] mb-4">Podcast</div>
            <h2 className="font-heading text-[1.5rem] md:text-[2rem] font-black leading-[1.1] tracking-[-1px] mb-6">
              Hear It From a Client
            </h2>
            <div className="bg-[rgba(12,12,18,0.6)] border border-[rgba(255,255,255,0.04)] rounded-[18px] overflow-hidden backdrop-blur-[10px]">
              <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
                <iframe
                  className="absolute inset-0 w-full h-full"
                  src={`https://www.youtube.com/embed/${podcastEpisode.id}`}
                  title={podcastEpisode.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          </div>

          {/* Listen Elsewhere */}
          <div className="mt-12 flex flex-wrap gap-4 items-center reveal">
            <span className="text-[0.85rem] text-text-muted font-medium">Listen on:</span>
            <a href="https://www.youtube.com/@TheConstructionBusinessCoach" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-text-secondary no-underline text-[0.85rem] font-medium px-[18px] py-2.5 rounded-[10px] border border-[rgba(255,255,255,0.05)] bg-[rgba(12,12,18,0.6)] backdrop-blur-[10px] transition-all duration-300 hover:text-text-primary hover:border-[rgba(34,114,222,0.3)] hover:bg-[rgba(34,114,222,0.05)] hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(34,114,222,0.1)]">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
              YouTube
            </a>
            <a href="https://open.spotify.com/show/5zlVU4gsqmvC0quDKrQheq" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-text-secondary no-underline text-[0.85rem] font-medium px-[18px] py-2.5 rounded-[10px] border border-[rgba(255,255,255,0.05)] bg-[rgba(12,12,18,0.6)] backdrop-blur-[10px] transition-all duration-300 hover:text-text-primary hover:border-[rgba(34,114,222,0.3)] hover:bg-[rgba(34,114,222,0.05)] hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(34,114,222,0.1)]">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
              Spotify
            </a>
            <a href="https://podcasts.apple.com/us/podcast/marc-watters-construction-business-blueprint/id1842833723" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-text-secondary no-underline text-[0.85rem] font-medium px-[18px] py-2.5 rounded-[10px] border border-[rgba(255,255,255,0.05)] bg-[rgba(12,12,18,0.6)] backdrop-blur-[10px] transition-all duration-300 hover:text-text-primary hover:border-[rgba(34,114,222,0.3)] hover:bg-[rgba(34,114,222,0.05)] hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(34,114,222,0.1)]">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M5.34 0A5.328 5.328 0 000 5.34v13.32A5.328 5.328 0 005.34 24h13.32A5.328 5.328 0 0024 18.66V5.34A5.328 5.328 0 0018.66 0H5.34zm6.525 2.568c2.336 0 4.448.902 6.056 2.587 1.224 1.272 1.912 2.619 2.264 4.392.12.6-.24 1.2-.84 1.32-.6.12-1.2-.24-1.32-.84-.264-1.344-.792-2.4-1.68-3.324-1.272-1.332-2.868-1.992-4.56-1.992-1.692 0-3.336.708-4.56 1.992-.888.924-1.416 1.98-1.68 3.324-.12.6-.72.96-1.32.84-.6-.12-.96-.72-.84-1.32.352-1.773 1.04-3.12 2.264-4.392 1.656-1.685 3.72-2.587 6.216-2.587zM11.88 6.72c1.536 0 2.904.588 3.96 1.692.804.84 1.296 1.812 1.536 3.048.072.6-.312 1.152-.912 1.248-.6.072-1.152-.312-1.248-.912-.144-.804-.456-1.416-.984-1.968-.672-.708-1.464-1.044-2.376-1.044s-1.704.336-2.376 1.044c-.528.552-.84 1.164-.984 1.968-.096.6-.648.984-1.248.912-.6-.096-.984-.648-.912-1.248.24-1.236.732-2.208 1.536-3.048 1.08-1.104 2.424-1.692 4.008-1.692zm-.024 4.176c1.224 0 2.232 1.008 2.232 2.232 0 .792-.408 1.488-1.032 1.872v5.88c0 .648-.528 1.176-1.176 1.176-.648 0-1.176-.528-1.176-1.176V15c-.648-.384-1.08-1.08-1.08-1.872 0-1.224 1.008-2.232 2.232-2.232z"/></svg>
              Apple Podcasts
            </a>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-[100px] px-8 bg-bg-secondary text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(34,114,222,0.06) 0%, transparent 60%)" }} />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(34,114,222,0.3)] to-transparent" />
        <div className="relative z-[1] max-w-[600px] mx-auto">
          <div className="font-heading text-[1.5rem] md:text-[2rem] font-black leading-[1.15] tracking-[-1px] mb-4">Ready to Get Results Like These?</div>
          <p className="text-[1rem] text-text-secondary mb-8 leading-[1.8]">Apply for the programme and find out if it's a fit.</p>
          <Link href="/apply" className="btn-primary inline-flex items-center gap-2 bg-accent text-white px-9 py-4 rounded-[10px] font-bold text-base no-underline transition-all duration-300 hover:-translate-y-[3px] hover:shadow-[0_10px_40px_rgba(34,114,222,0.4),0_0_60px_rgba(34,114,222,0.15)]">
            Apply for Coaching
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          </Link>
        </div>
      </section>
    </main>
  );
}
