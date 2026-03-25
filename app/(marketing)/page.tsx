import Link from "next/link";
import Image from "next/image";
import HeroCanvas from "@/components/HeroCanvas";
import ScrollReveal from "@/components/ScrollReveal";
import StatCounter from "@/components/StatCounter";
import { articles } from "@/lib/articles";
import { getSiteUrl } from "@/lib/site-url";

const problems = [
  { title: "You're stuck on site and can't get out.", desc: "You're still doing the work yourself because nobody else does it the way you do. Every time you try to step back, something pulls you straight back in. The business runs on you. That's the problem." },
  { title: "Every day is firefighting.", desc: "You're reactive from the minute you wake up. Site issues, supplier problems, team questions - it never stops. You're busy all day and can't point to one thing that actually moved the business forward." },
  { title: "You're chasing money that's already yours.", desc: "Invoices sitting unpaid. Variations that never got priced. Jobs that finished weeks ago and you're still waiting. The money's there - it's just not in your account." },
  { title: "You can't switch off.", desc: "It follows you home. It's there on weekends, there on holidays. You're running the whole thing in your head because it doesn't exist anywhere else." },
  { title: "Nothing you've tried has stuck.", desc: "You've had a go at sorting it - read the books, tried the systems, maybe even a course. You pick things up but can't implement them because the business won't give you the space to do it." },
];

const pillars = [
  { icon: "\u00A3", title: "Profit & Financial Clarity", desc: "You'll know exactly what each job costs to deliver, what your overheads are, and what you're actually walking away with. No more guessing. No more end-of-month surprises." },
  { icon: "\u2699", title: "Systems & Operations", desc: "The stuff that runs through your head every day gets turned into a process. Briefing jobs properly. Handovers that stick. A business that can operate without you being in every detail." },
  { icon: "\u2606", title: "Team & Leadership", desc: "Hiring the right people, setting the standard, and holding the team to it. Clear roles. Real accountability. People who show up and deliver." },
  { icon: "\u2630", title: "Clients & Pipeline", desc: "Getting the right type of work from the right type of clients. Building a pipeline that keeps you consistently busy with work that's worth doing." },
  { icon: "\u2713", title: "Business Owner Mindset", desc: "The transition from tradesman to business owner. You'll stop firefighting and start leading. Stop surviving the week and start planning the quarter." },
];



const homeArticles = articles.slice(0, 3);

const steps = [
  { num: "1", title: "Deep Dive Strategy Session", desc: "As soon as you come on board, we kick off with a full 1-to-1 session. We get into your current challenges, how the business is running now, and what's actually holding it back. Not a surface-level chat - a proper dig into the numbers, the team, the operations, and what you want the business to look like." },
  { num: "2", title: "Your Bespoke Business Plan", desc: "From that session, we build a plan specific to your trade or construction business. Your margins. Your team. Your goals. Your problems. You review it, we refine it, and only once you're fully happy does your mentorship officially begin." },
  { num: "3", title: "Weekly Mentorship & Real Implementation", desc: "Weekly 1-to-1 sessions to work through the plan. Prescribed training based on what your business actually needs. Direct access to Marc between sessions. Straight-talking accountability to keep things moving." },
];

const siteUrl = getSiteUrl();

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  name: "Marc Watters - Construction Business Blueprint",
  description: "Private mentorship for trade and construction business owners who want profit, structure, and a business that doesn't depend on them doing everything.",
  url: siteUrl,
  logo: `${siteUrl}/images/cbb-logo.png`,
  image: `${siteUrl}/images/marc-hero.png`,
  founder: {
    "@type": "Person",
    name: "Marc Watters",
    jobTitle: "Construction Business Mentor",
  },
  areaServed: [
    { "@type": "Country", name: "United Kingdom" },
    { "@type": "Country", name: "Ireland" },
  ],
  serviceType: "Business Mentorship",
};

export default function Home() {
  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
      <ScrollReveal />
      <StatCounter />

      {/* HERO */}
      <section className="min-h-screen flex items-center pt-[120px] pb-20 px-8 relative overflow-hidden">
        <HeroCanvas />
        {/* Gradient overlay */}
        <div
          className="absolute inset-0 z-[1] pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at 70% 40%, rgba(34,114,222,0.07) 0%, transparent 55%), radial-gradient(ellipse at 20% 80%, rgba(34,114,222,0.04) 0%, transparent 40%), radial-gradient(ellipse at 50% 100%, rgba(5,5,7,1) 0%, transparent 50%)",
          }}
        />

        {/* Mobile hero image (absolute behind text) */}
        <div className="absolute inset-0 lg:hidden z-0 pointer-events-none animate-[fadeIn_1.5s_cubic-bezier(0.16,1,0.3,1)_0.3s_both]">
          <Image
            src="/images/marc-hero.png"
            alt="Marc Watters"
            width={800}
            height={900}
            className="w-full h-full object-cover object-[center_top] brightness-[0.35] contrast-[1.1]"
            priority
          />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, #050507 5%, rgba(5,5,7,0.6) 50%, transparent 100%)" }} />
        </div>

        <div className="max-w-[1400px] mx-auto w-full grid grid-cols-1 lg:grid-cols-2 items-center relative z-[3]">
          <div className="max-w-[600px] lg:pl-8">
            <div className="inline-flex items-center gap-2 bg-[rgba(34,114,222,0.08)] border border-[rgba(34,114,222,0.2)] rounded-full px-[18px] py-[7px] text-[0.78rem] font-semibold text-accent-bright mb-6 tracking-[0.5px] uppercase animate-[fadeInUp_0.8s_cubic-bezier(0.16,1,0.3,1)_0.2s_both]">
              <span className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_10px_var(--color-accent),0_0_20px_rgba(34,114,222,0.3)] animate-[pulse-dot_2s_ease-in-out_infinite]" />
              Private 1-to-1 Mentorship - UK &amp; Ireland
            </div>

            <h1 className="font-heading text-[2.1rem] md:text-[3.5rem] font-black leading-[1.08] tracking-[-2px] mb-6 animate-[fadeInUp_0.8s_cubic-bezier(0.16,1,0.3,1)_0.35s_both]">
              Take Control of Your Trade and{" "}
              <span className="text-accent-bright relative">
                Construction Business
                <span className="absolute bottom-0.5 left-0 right-0 h-[3px] gradient-accent rounded-sm opacity-50" />
              </span>
            </h1>

            <p className="text-[1.1rem] text-text-secondary leading-[1.8] mb-4 max-w-[500px] animate-[fadeInUp_0.8s_cubic-bezier(0.16,1,0.3,1)_0.5s_both]">
              Private 1-to-1 mentorship for trade and construction business owners who are done winging it and ready to build something that actually works.
            </p>
            <p className="text-[0.9rem] text-text-muted leading-[1.7] mb-10 max-w-[500px] animate-[fadeInUp_0.8s_cubic-bezier(0.16,1,0.3,1)_0.55s_both]">
              This is for serious trade and construction business owners only. Not a course. Not group coaching.
            </p>

            <div className="flex gap-4 items-center flex-wrap animate-[fadeInUp_0.8s_cubic-bezier(0.16,1,0.3,1)_0.65s_both]">
              <Link href="/apply" className="btn-primary inline-flex items-center gap-2 bg-accent text-white px-9 py-4 rounded-[10px] font-bold text-base no-underline transition-all duration-300 hover:-translate-y-[3px] hover:shadow-[0_10px_40px_rgba(34,114,222,0.4),0_0_60px_rgba(34,114,222,0.15)]">
                Apply for Mentorship
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </Link>
              <a href="#how-it-works" className="inline-flex items-center gap-2 bg-transparent text-text-primary px-7 py-4 rounded-[10px] font-semibold text-[0.95rem] no-underline border border-border-light transition-all duration-300 hover:border-accent hover:bg-[rgba(34,114,222,0.05)] hover:shadow-[0_0_30px_rgba(34,114,222,0.08)]">
                Learn More
              </a>
            </div>
            <p className="text-[0.82rem] text-text-muted mt-4 animate-[fadeInUp_0.8s_cubic-bezier(0.16,1,0.3,1)_0.7s_both]">Places are limited. If it&apos;s a fit, we&apos;ll get on a call and go from there.</p>

            {/* Media links */}
            <div className="flex gap-4 items-center mt-10 pt-8 border-t border-[rgba(255,255,255,0.05)] animate-[fadeInUp_0.8s_cubic-bezier(0.16,1,0.3,1)_0.8s_both]">
              <a href="https://open.spotify.com/show/5zlVU4gsqmvC0quDKrQheq" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-text-secondary no-underline text-[0.85rem] font-medium px-[18px] py-2.5 rounded-[10px] border border-[rgba(255,255,255,0.05)] bg-[rgba(12,12,18,0.6)] backdrop-blur-[10px] transition-all duration-300 hover:text-text-primary hover:border-[rgba(34,114,222,0.3)] hover:bg-[rgba(34,114,222,0.05)] hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(34,114,222,0.1)] group">
                <svg className="w-[22px] h-[22px] opacity-70 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
                Podcast
              </a>
              <a href="https://www.youtube.com/@TheConstructionBusinessCoach" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-text-secondary no-underline text-[0.85rem] font-medium px-[18px] py-2.5 rounded-[10px] border border-[rgba(255,255,255,0.05)] bg-[rgba(12,12,18,0.6)] backdrop-blur-[10px] transition-all duration-300 hover:text-text-primary hover:border-[rgba(34,114,222,0.3)] hover:bg-[rgba(34,114,222,0.05)] hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(34,114,222,0.1)] group">
                <svg className="w-[22px] h-[22px] opacity-70 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                YouTube
              </a>
              <a href="https://podcasts.apple.com/us/podcast/marc-watters-construction-business-blueprint/id1842833723" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-text-secondary no-underline text-[0.85rem] font-medium px-[18px] py-2.5 rounded-[10px] border border-[rgba(255,255,255,0.05)] bg-[rgba(12,12,18,0.6)] backdrop-blur-[10px] transition-all duration-300 hover:text-text-primary hover:border-[rgba(34,114,222,0.3)] hover:bg-[rgba(34,114,222,0.05)] hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(34,114,222,0.1)] group">
                <svg className="w-[22px] h-[22px] opacity-70 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="currentColor"><path d="M5.34 0A5.328 5.328 0 000 5.34v13.32A5.328 5.328 0 005.34 24h13.32A5.328 5.328 0 0024 18.66V5.34A5.328 5.328 0 0018.66 0H5.34zm6.525 2.568c2.336 0 4.448.902 6.056 2.587 1.224 1.272 1.912 2.619 2.264 4.392.12.6-.24 1.2-.84 1.32-.6.12-1.2-.24-1.32-.84-.264-1.344-.792-2.4-1.68-3.324-1.272-1.332-2.868-1.992-4.56-1.992-1.692 0-3.336.708-4.56 1.992-.888.924-1.416 1.98-1.68 3.324-.12.6-.72.96-1.32.84-.6-.12-.96-.72-.84-1.32.352-1.773 1.04-3.12 2.264-4.392 1.656-1.685 3.72-2.587 6.216-2.587zM11.88 6.72c1.536 0 2.904.588 3.96 1.692.804.84 1.296 1.812 1.536 3.048.072.6-.312 1.152-.912 1.248-.6.072-1.152-.312-1.248-.912-.144-.804-.456-1.416-.984-1.968-.672-.708-1.464-1.044-2.376-1.044s-1.704.336-2.376 1.044c-.528.552-.84 1.164-.984 1.968-.096.6-.648.984-1.248.912-.6-.096-.984-.648-.912-1.248.24-1.236.732-2.208 1.536-3.048 1.08-1.104 2.424-1.692 4.008-1.692zm-.024 4.176c1.224 0 2.232 1.008 2.232 2.232 0 .792-.408 1.488-1.032 1.872v5.88c0 .648-.528 1.176-1.176 1.176-.648 0-1.176-.528-1.176-1.176V15c-.648-.384-1.08-1.08-1.08-1.872 0-1.224 1.008-2.232 2.232-2.232z"/></svg>
                Apple Podcasts
              </a>
            </div>
          </div>

          {/* Desktop hero image (side by side) */}
          <div className="relative hidden lg:flex justify-end items-center -mr-8 animate-[fadeIn_1.5s_cubic-bezier(0.16,1,0.3,1)_0.3s_both]">
            <div className="absolute w-[500px] h-[500px] bg-[radial-gradient(circle,rgba(34,114,222,0.1)_0%,transparent_70%)] rounded-full top-[40%] right-[15%] -translate-y-1/2 pointer-events-none animate-[breathe_5s_ease-in-out_infinite] z-0" />
            <Image
              src="/images/marc-hero.png"
              alt="Marc Watters"
              width={800}
              height={900}
              className="w-[115%] max-w-none h-[90vh] min-h-[600px] object-cover object-[center_top] relative z-[1] brightness-[0.85] contrast-[1.1]"
              style={{
                WebkitMaskImage: "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.4) 15%, rgba(0,0,0,0.8) 40%, rgba(0,0,0,1) 60%, rgba(0,0,0,0.6) 90%, transparent 100%), linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,1) 20%, rgba(0,0,0,1) 70%, transparent 100%)",
                WebkitMaskComposite: "source-in",
                maskImage: "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.4) 15%, rgba(0,0,0,0.8) 40%, rgba(0,0,0,1) 60%, rgba(0,0,0,0.6) 90%, transparent 100%), linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,1) 20%, rgba(0,0,0,1) 70%, transparent 100%)",
                maskComposite: "intersect",
              }}
              priority
            />
          </div>
        </div>
      </section>

      {/* STAT BAR */}
      <div className="border-t border-[rgba(255,255,255,0.03)] border-b border-b-[rgba(255,255,255,0.03)] bg-bg-secondary py-12 px-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(34,114,222,0.3)] to-transparent" />
        <div className="max-w-[1200px] mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: "0+", count: "20", label: "Years in Construction", suffix: "+" },
            { value: "0-to-0", count: "1", label: "Private Mentorship", suffix: "-to-1" },
            { value: "0%", count: "100", label: "Tailored to Your Business", suffix: "%" },
            { value: "UK & IE", label: "Trade & Construction Owners" },
          ].map((stat, i) => (
            <div key={i} className={`relative reveal ${i > 0 ? `reveal-delay-${i}` : ""}`}>
              {i < 3 && (
                <div className="hidden md:block absolute right-0 top-[10%] h-[80%] w-px bg-gradient-to-b from-transparent via-[rgba(255,255,255,0.06)] to-transparent" />
              )}
              <div
                className="font-heading text-[2.5rem] font-black gradient-text mb-1"
                {...(stat.count ? { "data-count": stat.count } : {})}
              >
                {stat.value}
              </div>
              <div className="text-[0.82rem] text-text-muted font-medium tracking-[0.5px]">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* VIDEO */}
      <section className="py-[100px] px-8 relative">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(34,114,222,0.04) 0%, transparent 60%)" }} />
        <div className="max-w-[900px] mx-auto text-center relative">
          <div className="reveal">
            <div className="text-[0.75rem] font-bold text-accent uppercase tracking-[3px] mb-4">See What This Looks Like</div>
            <div className="font-heading text-[1.85rem] md:text-[2.75rem] font-black leading-[1.1] tracking-[-1.5px] mb-6">How Marc Helps Construction Business Owners Build Real Structure</div>
            <div className="section-divider mx-auto" />
          </div>

          <div className="mt-10 rounded-[18px] overflow-hidden border border-[rgba(255,255,255,0.06)] shadow-[0_30px_80px_rgba(0,0,0,0.5),0_0_60px_rgba(34,114,222,0.06)] relative reveal reveal-delay-1">
            <div className="absolute -top-px left-[20%] right-[20%] h-px bg-gradient-to-r from-transparent via-[rgba(34,114,222,0.4)] to-transparent" />
            <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
              <iframe
                src="https://player.vimeo.com/video/1121582501?h=ad5f727774&color=2272DE&title=0&byline=0&portrait=0"
                className="absolute top-0 left-0 w-full h-full"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                title="Marc Watters - Construction Business Blueprint"
              />
            </div>
          </div>

          <div className="mt-10 max-w-[650px] mx-auto reveal reveal-delay-2">
            <p className="text-[1.05rem] text-text-secondary leading-[1.85]">
              No motivational speeches. No generic advice. Marc works one-to-one with trade and construction business owners to fix the things that actually hold them back - margins, team, systems, pipeline. Watch how it works.
            </p>
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="py-[120px] px-8 bg-bg-secondary relative">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 80% 20%, rgba(220,80,80,0.03) 0%, transparent 50%), radial-gradient(ellipse at 20% 80%, rgba(34,114,222,0.03) 0%, transparent 50%)" }} />
        <div className="max-w-[1200px] mx-auto relative">
          <div className="reveal">
            <div className="text-[0.75rem] font-bold text-accent uppercase tracking-[3px] mb-4">The Reality</div>
            <div className="font-heading text-[1.85rem] md:text-[2.75rem] font-black leading-[1.1] tracking-[-1.5px] mb-6">Do Any of These Sound Familiar?</div>
            <div className="section-divider" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mt-12">
            <div className="text-[1.05rem] text-text-secondary leading-[2] reveal">
              <p className="mb-6">You&apos;ve been in this industry for years. You work hard. You care about the job. You&apos;ve tried to grow. But something keeps getting in the way - and you already know what it is.</p>
              <p className="text-text-primary font-semibold">You&apos;ve seen lads in this industry hit their 50s and 60s still flat out, stressed, with nothing to show for it. You don&apos;t want that. Something has to change.</p>
            </div>

            <div className="flex flex-col gap-3">
              {problems.map((p, i) => (
                <div key={i} className={`flex items-start gap-4 bg-[rgba(12,12,18,0.8)] border border-[rgba(255,255,255,0.04)] rounded-[14px] px-6 py-5 backdrop-blur-[10px] transition-all duration-300 hover:border-[rgba(220,80,80,0.2)] hover:translate-x-1 hover:shadow-[-4px_0_20px_rgba(220,80,80,0.05)] reveal ${i > 0 ? `reveal-delay-${i}` : ""}`}>
                  <div className="w-9 h-9 min-w-[36px] bg-[rgba(220,80,80,0.08)] border border-[rgba(220,80,80,0.12)] rounded-[10px] flex items-center justify-center text-[#e05555] text-[0.85rem] font-bold">!</div>
                  <div className="text-[0.9rem] text-text-secondary leading-[1.6]">
                    <strong className="text-text-primary font-semibold">{p.title}</strong> {p.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SOLUTION / PILLARS */}
      <section className="py-[120px] px-8 relative">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(34,114,222,0.04) 0%, transparent 60%)" }} />
        <div className="max-w-[1200px] mx-auto relative">
          <div className="text-center max-w-[700px] mx-auto mb-12 reveal">
            <div className="text-[0.75rem] font-bold text-accent uppercase tracking-[3px] mb-4">The Programme</div>
            <div className="font-heading text-[1.85rem] md:text-[2.75rem] font-black leading-[1.1] tracking-[-1.5px] mb-6">What We Build Together</div>
            <div className="section-divider mx-auto" />
            <div className="text-[1.05rem] text-text-secondary max-w-[600px] mx-auto leading-[1.8]">
              This isn&apos;t a generic business course. It&apos;s built around your business, your numbers, and what&apos;s actually holding you back. These are the five areas we work through.
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5 mt-12">
            {pillars.map((p, i) => (
              <div key={i} className={`bg-[rgba(12,12,18,0.6)] border border-[rgba(255,255,255,0.04)] rounded-[18px] px-5 py-8 text-center backdrop-blur-[10px] transition-all duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] relative overflow-hidden group hover:-translate-y-1.5 hover:border-[rgba(34,114,222,0.3)] hover:shadow-[0_15px_40px_rgba(34,114,222,0.1),0_0_0_1px_rgba(34,114,222,0.1)] reveal ${i > 0 ? `reveal-delay-${i}` : ""}`}>
                <div className="absolute top-0 left-0 right-0 h-0.5 gradient-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(34,114,222,0.06)_0%,transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="w-14 h-14 bg-[rgba(34,114,222,0.08)] border border-[rgba(34,114,222,0.12)] rounded-[14px] flex items-center justify-center mx-auto mb-5 text-[1.4rem] text-accent-bright relative z-[1] transition-all duration-300 group-hover:bg-[rgba(34,114,222,0.15)] group-hover:shadow-[0_0_20px_rgba(34,114,222,0.2)]">{p.icon}</div>
                <h3 className="font-heading text-[0.95rem] font-bold mb-3 relative z-[1]">{p.title}</h3>
                <p className="text-[0.82rem] text-text-secondary leading-[1.6] relative z-[1]">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section id="results" className="py-[120px] px-8 bg-bg-secondary relative">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(34,114,222,0.2)] to-transparent" />
        <div className="max-w-[1200px] mx-auto">
          <div className="reveal">
            <div className="text-[0.75rem] font-bold text-accent uppercase tracking-[3px] mb-4">Results</div>
            <div className="font-heading text-[1.85rem] md:text-[2.75rem] font-black leading-[1.1] tracking-[-1.5px] mb-6">What Clients Say</div>
            <div className="section-divider" />
            <div className="text-[1.05rem] text-text-secondary max-w-[600px] leading-[1.8]">Real outcomes from trade and construction business owners on the programme.</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            {[
              { id: "obge0_bDhqg", title: "Client Testimonial 1" },
              { id: "1FILP9frS9E", title: "Client Testimonial 2" },
              { id: "7eRY9Wgr67c", title: "Client Testimonial 3" },
            ].map((v, i) => (
              <div key={v.id} className={`bg-[rgba(12,12,18,0.6)] border border-[rgba(255,255,255,0.04)] rounded-[18px] overflow-hidden backdrop-blur-[10px] transition-all duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:border-[rgba(34,114,222,0.2)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.3),0_0_40px_rgba(34,114,222,0.06)] reveal ${i > 0 ? `reveal-delay-${i}` : ""}`}>
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
        </div>
      </section>

      {/* ABOUT PREVIEW */}
      <section id="about" className="py-[120px] px-8">
        <div className="max-w-[1200px] mx-auto">
          <div className="reveal">
            <div className="text-[0.75rem] font-bold text-accent uppercase tracking-[3px] mb-4">About</div>
            <div className="font-heading text-[1.85rem] md:text-[2.75rem] font-black leading-[1.1] tracking-[-1.5px] mb-6">Marc Watters</div>
            <div className="section-divider" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[0.85fr_1.15fr] gap-16 mt-12">
            <div className="rounded-[20px] overflow-hidden border border-[rgba(255,255,255,0.06)] relative shadow-[0_30px_80px_rgba(0,0,0,0.4)] reveal">
              <Image src="/images/marc-about.png" alt="Marc Watters" width={500} height={667} className="w-full block object-cover" />
              <div className="absolute bottom-0 left-0 right-0 h-1/4 bg-gradient-to-t from-bg-primary to-transparent pointer-events-none" />
            </div>

            <div>
              <p className="text-text-secondary mb-4 leading-[1.85] text-[0.95rem] reveal">Marc Watters has spent years in the construction industry. Not watching from the sidelines - in it. Managing large-scale commercial projects, running teams, dealing with contractors, cashflow gaps, clients who moved goalposts, and weeks that never seemed to end. He&apos;s seen what a construction business looks like when it&apos;s working well and what it looks like when the owner is holding the whole thing together with his own two hands.</p>
              <p className="text-text-secondary mb-4 leading-[1.85] text-[0.95rem] reveal">When he left the corporate side of the industry, he wasn&apos;t done with construction. He started working directly with trade and construction business owners to help them fix the things holding them back. Pricing that didn&apos;t protect their margin. Teams that needed constant managing. Owners who couldn&apos;t take a day off without the phone going. He&apos;d seen all of it from the inside and knew exactly what the fixes looked like.</p>
              <p className="text-text-secondary mb-4 leading-[1.85] text-[0.95rem] reveal">Construction Business Blueprint is the result of everything he built and everything he learned along the way. It&apos;s not based on generic business theory. It&apos;s based on what actually works in this industry - with these clients, these timelines, these kinds of teams. Every plan he builds with a client is different because every business is different. That&apos;s the point.</p>
              <p className="text-text-secondary mb-4 leading-[1.85] text-[0.95rem] reveal">He&apos;s direct, practical, and doesn&apos;t waste your time. If something&apos;s not working in your business, he&apos;ll tell you. If you need to have a hard conversation with a team member, he&apos;ll help you prepare for it. This is 1-to-1 mentorship, not a course you work through on your own. He&apos;s involved from day one.</p>

              <h3 className="font-heading text-[1.15rem] font-bold mt-8 mb-4 text-accent-bright reveal">His Approach</h3>
              <p className="text-text-secondary mb-4 leading-[1.85] text-[0.95rem] reveal">Marc works the way construction works. No corporate nonsense, no recycled frameworks, no 47-page templates you&apos;ll never look at again. He comes in, understands the business properly, builds a plan specific to it, and works through it with you week by week. Every session moves something forward. Every conversation is honest. He asks the questions that get to the real problem, not the surface one.</p>

              <h3 className="font-heading text-[1.15rem] font-bold mt-8 mb-4 text-accent-bright reveal">Who This Is For</h3>
              <p className="text-text-secondary mb-4 leading-[1.85] text-[0.95rem] reveal">This mentorship is for trade and construction business owners who are serious about changing how their business runs. If you&apos;re looking for a course to work through at your own pace, this isn&apos;t it.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
                {[
                  "Builders, electricians, plumbers, joiners, landscapers, groundworkers - any trade or construction discipline",
                  "Business owners turning over 200k or more, or serious about getting there",
                  "Owners who feel like the business still owns them - and want to change that",
                  "People ready to lead properly, not just keep the wheels turning",
                  "Anyone who wants more time, better margin, and a business that can run without them in every detail",
                  "Sole traders scaling up, small teams growing, and established businesses that need restructuring",
                ].map((item, i) => (
                  <div key={i} className={`flex items-start gap-3 text-[0.88rem] text-text-secondary p-4 bg-[rgba(12,12,18,0.6)] border border-[rgba(255,255,255,0.04)] rounded-xl backdrop-blur-[10px] transition-all duration-300 hover:border-[rgba(34,114,222,0.2)] hover:bg-[rgba(34,114,222,0.03)] reveal ${i > 0 ? `reveal-delay-${Math.min(i, 4)}` : ""}`}>
                    <span className="text-accent font-bold min-w-[16px]">-</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-[120px] px-8 bg-bg-secondary relative">
        <div className="max-w-[1200px] mx-auto text-center">
          <div className="reveal">
            <div className="text-[0.75rem] font-bold text-accent uppercase tracking-[3px] mb-4">Process</div>
            <div className="font-heading text-[1.85rem] md:text-[2.75rem] font-black leading-[1.1] tracking-[-1.5px] mb-6">Three Steps. No Waiting Around.</div>
            <div className="section-divider mx-auto" />
            <div className="text-[1.05rem] text-text-secondary mx-auto leading-[1.8]">From your first conversation to a live mentorship plan, everything moves quickly. You don&apos;t spend weeks onboarding before anything happens.</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16 relative">
            <div className="hidden md:block absolute top-12 left-[calc(16.66%+24px)] right-[calc(16.66%+24px)] h-0.5 bg-gradient-to-r from-accent via-[rgba(34,114,222,0.2)] to-accent" />
            {steps.map((s, i) => (
              <div key={i} className={`text-center relative reveal ${i > 0 ? `reveal-delay-${i}` : ""}`}>
                <div className="w-24 h-24 bg-bg-primary border-2 border-accent rounded-full flex items-center justify-center mx-auto mb-7 font-heading text-[2rem] font-black text-accent-bright relative z-[1] shadow-[0_0_30px_rgba(34,114,222,0.15),inset_0_0_20px_rgba(34,114,222,0.05)] transition-all duration-300 hover:shadow-[0_0_50px_rgba(34,114,222,0.25),inset_0_0_30px_rgba(34,114,222,0.1)] hover:scale-105">
                  {s.num}
                </div>
                <h3 className="font-heading text-[1.15rem] font-bold mb-3">{s.title}</h3>
                <p className="text-sm text-text-secondary leading-[1.7] max-w-[280px] mx-auto">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ARTICLES */}
      <section id="articles" className="py-[120px] px-8 relative">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 30% 50%, rgba(34,114,222,0.03) 0%, transparent 50%)" }} />
        <div className="max-w-[1200px] mx-auto relative">
          <div className="reveal">
            <div className="text-[0.75rem] font-bold text-accent uppercase tracking-[3px] mb-4">Articles</div>
            <div className="font-heading text-[1.85rem] md:text-[2.75rem] font-black leading-[1.1] tracking-[-1.5px] mb-6">Practical Advice for Construction Business Owners</div>
            <div className="section-divider" />
            <div className="text-[1.05rem] text-text-secondary max-w-[600px] leading-[1.8]">Straight-talking articles on profit, systems, team, and growth - written for people who actually run construction businesses.</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            {homeArticles.map((a, i) => (
              <Link
                key={i}
                href={`/articles/${a.slug}`}
                className={`group bg-[rgba(12,12,18,0.6)] border border-[rgba(255,255,255,0.04)] rounded-[18px] overflow-hidden backdrop-blur-[10px] transition-all duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] no-underline relative hover:-translate-y-1.5 hover:border-[rgba(34,114,222,0.3)] hover:shadow-[0_15px_40px_rgba(34,114,222,0.1),0_0_0_1px_rgba(34,114,222,0.1)] reveal ${i > 0 ? `reveal-delay-${i}` : ""}`}
              >
                <div className="absolute top-0 left-0 right-0 h-0.5 gradient-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="h-[3px] gradient-accent" />
                <div className="p-7">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="bg-[rgba(34,114,222,0.08)] border border-[rgba(34,114,222,0.15)] rounded-full px-3 py-1 text-[0.7rem] font-semibold text-accent-light tracking-[0.3px]">{a.category}</span>
                    <span className="text-[0.72rem] text-text-muted">{a.readTime}</span>
                  </div>
                  <h3 className="font-heading text-[1.05rem] font-bold leading-[1.35] mb-3 text-text-primary group-hover:text-accent-bright transition-colors duration-300">{a.title}</h3>
                  <p className="text-[0.85rem] text-text-secondary leading-[1.7] mb-4">{a.excerpt}</p>
                  <span className="text-[0.82rem] font-semibold text-accent inline-flex items-center gap-1.5 group-hover:gap-2.5 transition-all duration-300">
                    Read article
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                  </span>
                </div>
              </Link>
            ))}
          </div>

          <div className="text-center mt-12 reveal">
            <Link href="/articles" className="inline-flex items-center gap-2 bg-transparent text-text-primary px-8 py-4 rounded-[10px] font-semibold text-[0.95rem] no-underline border border-border-light transition-all duration-300 hover:border-accent hover:bg-[rgba(34,114,222,0.05)] hover:shadow-[0_0_30px_rgba(34,114,222,0.08)]">
              View All Articles
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </Link>
          </div>
        </div>
      </section>

      {/* CLIENT PORTAL PREVIEW */}
      <section id="portal-preview" className="py-[120px] px-8 bg-bg-secondary relative">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(34,114,222,0.2)] to-transparent" />
        <div className="max-w-[1200px] mx-auto">
          <div className="reveal">
            <div className="text-[0.75rem] font-bold text-accent uppercase tracking-[3px] mb-4">Exclusive to Members</div>
            <div className="font-heading text-[1.85rem] md:text-[2.75rem] font-black leading-[1.1] tracking-[-1.5px] mb-6">Your Personal Client Portal</div>
            <div className="section-divider" />
            <div className="text-[1.05rem] text-text-secondary max-w-[600px] leading-[1.8]">Every client gets their own private dashboard with training modules, progress tracking, and weekly check-ins. Everything you need, in one place.</div>
          </div>

          <div className="mt-12 bg-bg-card border border-[rgba(255,255,255,0.06)] rounded-[20px] overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.4),0_0_60px_rgba(34,114,222,0.04)] relative reveal">
            <div className="absolute -top-px left-[20%] right-[20%] h-px bg-gradient-to-r from-transparent via-[rgba(34,114,222,0.4)] to-transparent" />
            {/* Browser chrome */}
            <div className="px-6 py-4 bg-[rgba(34,114,222,0.03)] border-b border-[rgba(255,255,255,0.04)] flex justify-between items-center">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#e05555]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#e0a030]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#30b050]" />
              </div>
              <span className="text-[0.82rem] font-semibold text-text-muted font-mono">portal.marcwatters.co.uk</span>
            </div>

            <div className="p-6 md:p-10">
              {/* Welcome */}
              <div className="mb-6">
                <div className="font-heading text-xl md:text-2xl font-bold">Welcome back, James.</div>
                <div className="text-[0.85rem] text-text-muted mt-1">Here&apos;s your progress overview.</div>
              </div>

              {/* Next Event Banner */}
              <div className="bg-bg-primary border border-[rgba(34,114,222,0.12)] rounded-2xl p-4 md:p-5 mb-6 flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-[rgba(34,114,222,0.1)] border border-[rgba(34,114,222,0.2)] flex items-center justify-center">
                    <svg className="w-5 h-5 text-accent-bright" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </div>
                  <div>
                    <div className="text-[0.7rem] text-text-muted uppercase tracking-wider">Next Event</div>
                    <div className="text-[0.95rem] font-heading font-bold">Weekly Check-In Call</div>
                    <div className="text-[0.8rem] text-text-muted">Thursday, 10:00 AM - Every week</div>
                  </div>
                </div>
                <div className="px-4 py-2 gradient-accent text-white rounded-xl text-[0.8rem] font-semibold flex items-center gap-2">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  Join Call
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
                {[
                  { label: "Plan Progress", value: "62%", sub: "8/13 actions done" },
                  { label: "Current Week", value: "Week 6" },
                  { label: "Trainings", value: "5/8", sub: "63% complete" },
                  { label: "Status", value: "On Track", isStatus: true },
                ].map((stat, i) => (
                  <div key={i} className="bg-bg-primary border border-[rgba(255,255,255,0.04)] rounded-2xl p-4 md:p-5">
                    <div className="text-[0.65rem] text-text-muted uppercase tracking-wider mb-1.5">{stat.label}</div>
                    <div className={`font-heading text-lg md:text-xl font-bold ${stat.isStatus ? "text-emerald-400" : "text-text-primary"}`}>{stat.value}</div>
                    {stat.sub && <div className="text-[0.72rem] text-text-muted mt-0.5">{stat.sub}</div>}
                  </div>
                ))}
              </div>

              {/* Two Column: Business Plan + Check-Ins */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                {/* Business Plan */}
                <div className="bg-bg-primary border border-[rgba(255,255,255,0.04)] rounded-2xl p-5 md:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="font-heading text-base font-bold">Business Plan</div>
                    <div className="px-3 py-1.5 gradient-accent text-white rounded-xl text-[0.72rem] font-semibold">Go To Plan</div>
                  </div>
                  {/* Overall progress bar */}
                  <div className="w-full bg-[rgba(255,255,255,0.04)] rounded-full h-2 mb-1">
                    <div className="h-2 rounded-full gradient-accent" style={{ width: "62%" }} />
                  </div>
                  <div className="flex justify-between text-[0.72rem] text-text-muted mb-5">
                    <span>8 completed</span>
                    <span>5 remaining</span>
                  </div>

                  {/* Phase breakdown */}
                  <div className="space-y-3">
                    {[
                      { name: "Financial Foundations", completed: 4, total: 4, color: "bg-blue-500", pct: 100 },
                      { name: "Pipeline & Sales", completed: 3, total: 4, color: "bg-emerald-500", pct: 75 },
                      { name: "Team & Hiring", completed: 1, total: 3, color: "bg-purple-500", pct: 33 },
                      { name: "Operational Systems", completed: 0, total: 2, color: "bg-amber-500", pct: 0 },
                    ].map((phase, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[0.82rem] text-text-primary truncate">{phase.name}</span>
                            <span className="text-[0.65rem] text-text-muted ml-2">{phase.completed}/{phase.total}</span>
                          </div>
                          <div className="w-full bg-[rgba(255,255,255,0.04)] rounded-full h-1.5">
                            <div className={`h-1.5 rounded-full ${phase.pct === 100 ? "bg-emerald-500" : "gradient-accent"}`} style={{ width: `${phase.pct}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Check-Ins */}
                <div className="bg-bg-primary border border-[rgba(255,255,255,0.04)] rounded-2xl p-5 md:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="font-heading text-base font-bold">Check-Ins</div>
                    <span className="text-[0.72rem] text-text-muted">Next: Mon 17 Mar</span>
                  </div>

                  <div className="space-y-2">
                    {[
                      { week: 6, date: "10 Mar", mood: "great", moodColor: "bg-emerald-500/10 text-emerald-400", replied: true },
                      { week: 5, date: "3 Mar", mood: "good", moodColor: "bg-blue-500/10 text-blue-400", replied: true },
                      { week: 4, date: "24 Feb", mood: "okay", moodColor: "bg-amber-500/10 text-amber-400", replied: true },
                      { week: 3, date: "17 Feb", mood: "good", moodColor: "bg-blue-500/10 text-blue-400", replied: true },
                    ].map((c, i) => (
                      <div key={i} className="border border-[rgba(255,255,255,0.04)] rounded-xl py-3 px-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-[0.82rem] text-text-primary font-medium">Week {c.week}</span>
                          <span className="text-[0.72rem] text-text-muted">{c.date}</span>
                          <span className={`text-[0.68rem] px-2 py-0.5 rounded-full ${c.moodColor}`}>{c.mood}</span>
                        </div>
                        <span className="text-[0.72rem] text-accent-bright">Replied</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="apply-section" className="py-[120px] px-8 bg-bg-secondary text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(34,114,222,0.08) 0%, transparent 60%), radial-gradient(ellipse at 30% 100%, rgba(34,114,222,0.04) 0%, transparent 40%)" }} />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(34,114,222,0.3)] to-transparent" />
        <div className="relative z-[1] max-w-[700px] mx-auto reveal">
          <div className="text-[0.75rem] font-bold text-accent uppercase tracking-[3px] mb-4">Get Started</div>
          <div className="font-heading text-[1.85rem] md:text-[2.75rem] font-black leading-[1.1] tracking-[-1.5px] mb-4">Ready to Build a Business That Actually Works?</div>
          <div className="section-divider mx-auto" />
          <div className="text-[1.05rem] text-text-secondary mx-auto mb-4 leading-[1.8]">If you&apos;re serious about taking back control of your time, your profit, and your business - this is where it starts. Apply below and we&apos;ll get on a call to see if it&apos;s a fit.</div>
          <div className="text-[0.88rem] text-text-muted mx-auto mb-10 leading-[1.7]">Places are limited. This is private 1-to-1 mentorship - not a course, not a group programme.</div>
          <Link href="/apply" className="btn-primary inline-flex items-center gap-2 bg-accent text-white px-11 py-[18px] rounded-[10px] font-bold text-[1.1rem] no-underline transition-all duration-300 hover:-translate-y-[3px] hover:shadow-[0_10px_40px_rgba(34,114,222,0.4),0_0_60px_rgba(34,114,222,0.15)]">
            Apply Now
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          </Link>
          <p className="text-[0.82rem] text-text-muted mt-4">No hard sell. If it&apos;s not the right fit, we&apos;ll tell you.</p>
        </div>
      </section>
    </main>
  );
}
