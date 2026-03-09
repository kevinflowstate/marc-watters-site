import Link from "next/link";
import Image from "next/image";
import HeroCanvas from "@/components/HeroCanvas";
import ScrollReveal from "@/components/ScrollReveal";
import StatCounter from "@/components/StatCounter";

const problems = [
  { title: "Flat out but not profitable.", desc: "Revenue coming in, but margins are thin and cash flow is unpredictable." },
  { title: "You are the bottleneck.", desc: "Nothing moves without you. The business stops when you stop." },
  { title: "Team won't step up.", desc: "You're babysitting instead of leading. Unclear roles, no accountability." },
  { title: "Feast and famine pipeline.", desc: "No system for winning work consistently. It's luck, not strategy." },
  { title: "Everything is reactive.", desc: "Firefighting all day, no time to plan, no clear direction forward." },
];

const pillars = [
  { icon: "\u00A3", title: "Clear Numbers", desc: "Know your margins, your costs, your cash position. Stop guessing. Start making decisions based on actual data." },
  { icon: "\u2630", title: "Predictable Pipeline", desc: "A system for winning work consistently. Leads, quotes, follow-ups, conversions. All tracked." },
  { icon: "\u2606", title: "Stronger Team", desc: "Hire right, set clear expectations, build accountability. Stop being the only person who cares." },
  { icon: "\u2699", title: "Tighter Systems", desc: "Operational structure so jobs run smoother, communication is clear, and nothing falls through the cracks." },
  { icon: "\u2713", title: "Real Standards", desc: "Quality control, client management, and delivery that builds a reputation - not just a roster of jobs." },
];

const testimonials = [
  {
    quote: "Since working with Marc, I've gone from running around like a headless chicken to actually knowing my numbers. My margins have improved, my team knows what's expected, and I'm not quoting jobs at midnight anymore.",
    initials: "JM", role: "Construction Business Owner", location: "Residential Builds, Northern Ireland",
    tags: ["Improved Margins", "Team Structure"],
  },
  {
    quote: "I thought I was too busy to get help. Turns out I was too busy because I didn't have the right structure. Marc cut through the noise and showed me exactly what needed to change.",
    initials: "DK", role: "Trade Business Owner", location: "Joinery, UK",
    tags: ["Predictable Pipeline", "Cash Flow"],
  },
  {
    quote: "The difference is night and day. I've got proper systems in place, I know exactly where every pound goes, and I actually have time to think about growing the business instead of just surviving it.",
    initials: "SR", role: "Construction Company Owner", location: "Commercial Fit-Outs, Ireland",
    tags: ["Systems", "Financial Control"],
  },
];

const articles = [
  {
    slug: "how-to-price-construction-jobs-for-profit",
    title: "How to Price Construction Jobs for Profit, Not Just Turnover",
    excerpt: "Most construction businesses price jobs based on what feels right or what the last guy charged. Here's how to actually build margin into every quote.",
    category: "Profit",
    readTime: "6 min read",
  },
  {
    slug: "five-systems-every-construction-business-needs",
    title: "5 Systems Every Construction Business Needs Before It Can Scale",
    excerpt: "You can't scale chaos. Before you take on more work or hire more people, these five systems need to be in place.",
    category: "Systems",
    readTime: "7 min read",
  },
  {
    slug: "construction-business-owner-working-60-hours",
    title: "Working 60 Hours a Week and Still Not Profitable? Here's Why.",
    excerpt: "Being busy isn't the same as being profitable. If your hours are going up but your margins aren't, the problem isn't effort - it's structure.",
    category: "Growth",
    readTime: "5 min read",
  },
];

const steps = [
  { num: "1", title: "Apply", desc: "Fill in a short application. This isn't for everyone - it's for serious operators who are ready to do the work." },
  { num: "2", title: "Discovery Call", desc: "If it looks like a fit, we'll get on a call. No pitch. Just a straight conversation about where you are and where you want to be." },
  { num: "3", title: "Start Building", desc: "You get a structured programme, a clear plan, and direct support. From day one, you'll know exactly what to focus on." },
];

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  name: "Marc Watters - Construction Business Blueprint",
  description: "Private mentorship for trade and construction business owners who want profit, structure, and a business that doesn't depend on them doing everything.",
  url: "https://marc-watters-site.vercel.app",
  logo: "https://marc-watters-site.vercel.app/images/cbb-logo.png",
  image: "https://marc-watters-site.vercel.app/images/marc-hero.png",
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

        <div className="max-w-[1400px] mx-auto w-full grid grid-cols-1 lg:grid-cols-2 items-center relative z-[2]">
          <div className="max-w-[600px] lg:pl-8">
            <div className="inline-flex items-center gap-2 bg-[rgba(34,114,222,0.08)] border border-[rgba(34,114,222,0.2)] rounded-full px-[18px] py-[7px] text-[0.78rem] font-semibold text-accent-bright mb-6 tracking-[0.5px] uppercase animate-[fadeInUp_0.8s_cubic-bezier(0.16,1,0.3,1)_0.2s_both]">
              <span className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_10px_var(--color-accent),0_0_20px_rgba(34,114,222,0.3)] animate-[pulse-dot_2s_ease-in-out_infinite]" />
              Private 1-to-1 Mentorship
            </div>

            <h1 className="font-heading text-[2.1rem] md:text-[3.5rem] font-black leading-[1.08] tracking-[-2px] mb-6 animate-[fadeInUp_0.8s_cubic-bezier(0.16,1,0.3,1)_0.35s_both]">
              Stop Running Your Business Like a{" "}
              <span className="text-accent-bright relative">
                One-Man Fire Brigade
                <span className="absolute bottom-0.5 left-0 right-0 h-[3px] gradient-accent rounded-sm opacity-50" />
              </span>
            </h1>

            <p className="text-[1.1rem] text-text-secondary leading-[1.8] mb-10 max-w-[500px] animate-[fadeInUp_0.8s_cubic-bezier(0.16,1,0.3,1)_0.5s_both]">
              Private mentorship for trade and construction business owners who want profit, structure, and a business that doesn&apos;t depend on them doing everything.
            </p>

            <div className="flex gap-4 items-center flex-wrap animate-[fadeInUp_0.8s_cubic-bezier(0.16,1,0.3,1)_0.65s_both]">
              <Link href="/apply" className="btn-primary inline-flex items-center gap-2 bg-accent text-white px-9 py-4 rounded-[10px] font-bold text-base no-underline transition-all duration-300 hover:-translate-y-[3px] hover:shadow-[0_10px_40px_rgba(34,114,222,0.4),0_0_60px_rgba(34,114,222,0.15)]">
                Apply for Coaching
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </Link>
              <a href="#how-it-works" className="inline-flex items-center gap-2 bg-transparent text-text-primary px-7 py-4 rounded-[10px] font-semibold text-[0.95rem] no-underline border border-border-light transition-all duration-300 hover:border-accent hover:bg-[rgba(34,114,222,0.05)] hover:shadow-[0_0_30px_rgba(34,114,222,0.08)]">
                Learn More
              </a>
            </div>

            {/* Media links */}
            <div className="flex gap-4 items-center mt-10 pt-8 border-t border-[rgba(255,255,255,0.05)] animate-[fadeInUp_0.8s_cubic-bezier(0.16,1,0.3,1)_0.8s_both]">
              <a href="#" className="flex items-center gap-2.5 text-text-secondary no-underline text-[0.85rem] font-medium px-[18px] py-2.5 rounded-[10px] border border-[rgba(255,255,255,0.05)] bg-[rgba(12,12,18,0.6)] backdrop-blur-[10px] transition-all duration-300 hover:text-text-primary hover:border-[rgba(34,114,222,0.3)] hover:bg-[rgba(34,114,222,0.05)] hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(34,114,222,0.1)] group">
                <svg className="w-[22px] h-[22px] opacity-70 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
                Podcast
              </a>
              <a href="#" className="flex items-center gap-2.5 text-text-secondary no-underline text-[0.85rem] font-medium px-[18px] py-2.5 rounded-[10px] border border-[rgba(255,255,255,0.05)] bg-[rgba(12,12,18,0.6)] backdrop-blur-[10px] transition-all duration-300 hover:text-text-primary hover:border-[rgba(34,114,222,0.3)] hover:bg-[rgba(34,114,222,0.05)] hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(34,114,222,0.1)] group">
                <svg className="w-[22px] h-[22px] opacity-70 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                YouTube
              </a>
            </div>
          </div>

          {/* Hero image - mobile: behind text as background, desktop: side by side */}
          {/* Mobile hero image (absolute behind text) */}
          <div className="absolute inset-0 lg:hidden z-[1] animate-[fadeIn_1.5s_cubic-bezier(0.16,1,0.3,1)_0.3s_both]">
            <Image
              src="/images/marc-hero.png"
              alt="Marc Watters"
              width={800}
              height={900}
              className="w-full h-full object-cover object-[center_top] brightness-[0.4] contrast-[1.1]"
              priority
            />
            <div className="absolute inset-0" style={{ background: "linear-gradient(to top, #050507 0%, rgba(5,5,7,0.7) 40%, transparent 100%)" }} />
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
            <div className="font-heading text-[1.85rem] md:text-[2.75rem] font-black leading-[1.1] tracking-[-1.5px] mb-6">Sound Familiar?</div>
            <div className="section-divider" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mt-12">
            <div className="text-[1.05rem] text-text-secondary leading-[2] reveal">
              <p className="mb-6">You&apos;re up at 6am, on site by 7, quoting jobs at 9pm. The phone doesn&apos;t stop. You&apos;re chasing suppliers, chasing payments, chasing your own tail.</p>
              <p className="mb-6">You&apos;ve got work on. You might even be flat out. But the profit doesn&apos;t match the effort. Cash flow is a constant headache. Your team needs babysitting. And every time you try to step back, something falls apart.</p>
              <p className="mb-6">You&apos;ve tried hiring. Tried spreadsheets. Tried working harder. None of it fixed the actual problem.</p>
              <p className="text-text-primary font-semibold">The problem is the business has no structure. And without structure, growth just means more chaos.</p>
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
            <div className="font-heading text-[1.85rem] md:text-[2.75rem] font-black leading-[1.1] tracking-[-1.5px] mb-6">The Construction Business Blueprint</div>
            <div className="section-divider mx-auto" />
            <div className="text-[1.05rem] text-text-secondary max-w-[600px] mx-auto leading-[1.8]">
              A private, one-to-one mentorship programme built specifically for trade and construction business owners. No courses. No group calls with 200 strangers. No motivational fluff.
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
            <div className="font-heading text-[1.85rem] md:text-[2.75rem] font-black leading-[1.1] tracking-[-1.5px] mb-6">What Clients Are Saying</div>
            <div className="section-divider" />
            <div className="text-[1.05rem] text-text-secondary max-w-[600px] leading-[1.8]">Real outcomes from trade and construction business owners on the programme.</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            {testimonials.map((t, i) => (
              <div key={i} className={`bg-[rgba(12,12,18,0.6)] border border-[rgba(255,255,255,0.04)] rounded-[18px] p-8 backdrop-blur-[10px] transition-all duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] relative overflow-hidden hover:-translate-y-1 hover:border-[rgba(34,114,222,0.2)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.3),0_0_40px_rgba(34,114,222,0.06)] reveal ${i > 0 ? `reveal-delay-${i}` : ""}`}>
                <div className="absolute top-[10px] left-5 font-heading text-[6rem] font-black text-[rgba(34,114,222,0.06)] leading-none">&ldquo;</div>
                <div className="text-[0.93rem] italic text-text-secondary leading-[1.8] mb-6 pl-5 border-l-2 border-accent relative z-[1]">
                  &ldquo;{t.quote}&rdquo;
                </div>
                <div className="flex items-center gap-3 relative z-[1]">
                  <div className="w-[42px] h-[42px] bg-[rgba(34,114,222,0.1)] border border-[rgba(34,114,222,0.2)] rounded-full flex items-center justify-center font-bold text-[0.85rem] text-accent-bright">{t.initials}</div>
                  <div className="text-[0.85rem]">
                    <strong className="block text-text-primary">{t.role}</strong>
                    <span className="text-text-muted">{t.location}</span>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap mt-4 relative z-[1]">
                  {t.tags.map((tag, j) => (
                    <span key={j} className="bg-[rgba(34,114,222,0.06)] border border-[rgba(34,114,222,0.12)] rounded-full px-3 py-1 text-[0.72rem] font-semibold text-accent-light tracking-[0.3px]">{tag}</span>
                  ))}
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
            <div className="font-heading text-[1.85rem] md:text-[2.75rem] font-black leading-[1.1] tracking-[-1.5px] mb-6">About Marc</div>
            <div className="section-divider" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[0.85fr_1.15fr] gap-16 mt-12">
            <div className="rounded-[20px] overflow-hidden border border-[rgba(255,255,255,0.06)] relative shadow-[0_30px_80px_rgba(0,0,0,0.4)] reveal">
              <Image src="/images/marc-about.png" alt="Marc Watters" width={500} height={667} className="w-full block object-cover" />
              <div className="absolute bottom-0 left-0 right-0 h-1/4 bg-gradient-to-t from-bg-primary to-transparent pointer-events-none" />
            </div>

            <div>
              <p className="text-text-secondary mb-4 leading-[1.85] text-[0.95rem] reveal">Marc Watters has spent years in the construction industry. Not watching from the sidelines - in it. On the tools, running jobs, managing teams, dealing with the exact problems that every trade and construction business owner faces.</p>
              <p className="text-text-secondary mb-4 leading-[1.85] text-[0.95rem] reveal">The difference is he figured out what actually works. Not theory. Not motivation. Structure. Numbers. Systems. Standards.</p>
              <p className="text-text-secondary mb-4 leading-[1.85] text-[0.95rem] reveal">Today, Marc works privately with construction business owners across the UK and Ireland who want to build a business that&apos;s profitable, well-run, and doesn&apos;t rely on them doing everything themselves.</p>

              <h3 className="font-heading text-[1.15rem] font-bold mt-8 mb-4 text-accent-bright reveal">His Approach</h3>
              <p className="text-text-secondary mb-4 leading-[1.85] text-[0.95rem] reveal">This isn&apos;t a course. There&apos;s no app full of content you&apos;ll never watch. There&apos;s no group call where you&apos;re one of 200 faces on a screen. It&apos;s private mentorship. One to one. Tailored to your business, your numbers, your situation.</p>

              <h3 className="font-heading text-[1.15rem] font-bold mt-8 mb-4 text-accent-bright reveal">Who This Is For</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
                {[
                  "Trade and construction business owners running a team",
                  "Owners still on the tools carrying the whole business",
                  "Businesses doing the work but not seeing the profit",
                  "Operators who want structure, not motivation",
                ].map((item, i) => (
                  <div key={i} className={`flex items-start gap-3 text-[0.88rem] text-text-secondary p-4 bg-[rgba(12,12,18,0.6)] border border-[rgba(255,255,255,0.04)] rounded-xl backdrop-blur-[10px] transition-all duration-300 hover:border-[rgba(34,114,222,0.2)] hover:bg-[rgba(34,114,222,0.03)] reveal ${i > 0 ? `reveal-delay-${i}` : ""}`}>
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
            <div className="font-heading text-[1.85rem] md:text-[2.75rem] font-black leading-[1.1] tracking-[-1.5px] mb-6">How It Works</div>
            <div className="section-divider mx-auto" />
            <div className="text-[1.05rem] text-text-secondary mx-auto leading-[1.8]">Three steps. No fluff. No 47-page application.</div>
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
            {articles.map((a, i) => (
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
            <div className="px-6 py-4 bg-[rgba(34,114,222,0.03)] border-b border-[rgba(255,255,255,0.04)] flex justify-between items-center">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#e05555]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#e0a030]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#30b050]" />
              </div>
              <span className="text-[0.82rem] font-semibold text-text-muted font-mono">portal.marcwatters.co.uk</span>
            </div>

            <div className="p-10">
              <div className="font-heading text-xl font-bold mb-6">Welcome back, James.</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: "Modules Assigned", value: "8", sub: "5 completed" },
                  { label: "Check-Ins Submitted", value: "12", sub: "Next due Friday" },
                  { label: "Week Rating", value: "8/10", sub: "Trending up" },
                ].map((card, i) => (
                  <div key={i} className="bg-bg-primary border border-[rgba(255,255,255,0.04)] rounded-[14px] p-6 transition-all duration-300 hover:border-[rgba(34,114,222,0.2)] hover:shadow-[0_0_20px_rgba(34,114,222,0.05)]">
                    <div className="text-[0.72rem] font-semibold text-text-muted uppercase tracking-[1.5px] mb-2">{card.label}</div>
                    <div className="font-heading text-[2.25rem] font-black gradient-text">{card.value}</div>
                    <div className="text-[0.78rem] text-text-muted mt-1">{card.sub}</div>
                  </div>
                ))}
              </div>

              <div className="mt-6">
                <div className="flex justify-between text-[0.85rem] mb-2">
                  <span className="text-text-secondary">Programme Progress</span>
                  <span className="text-accent-bright font-bold">65%</span>
                </div>
                <div className="h-2.5 bg-[rgba(255,255,255,0.03)] rounded-full overflow-hidden border border-[rgba(255,255,255,0.04)]">
                  <div className="h-full w-[65%] gradient-accent rounded-full animate-[progressGlow_2s_ease-in-out_infinite]" />
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
          <div className="text-[1.05rem] text-text-secondary mx-auto mb-10 leading-[1.8]">Apply for the Construction Business Blueprint. If it&apos;s a fit, you&apos;ll hear back directly from Marc.</div>
          <Link href="/apply" className="btn-primary inline-flex items-center gap-2 bg-accent text-white px-11 py-[18px] rounded-[10px] font-bold text-[1.1rem] no-underline transition-all duration-300 hover:-translate-y-[3px] hover:shadow-[0_10px_40px_rgba(34,114,222,0.4),0_0_60px_rgba(34,114,222,0.15)]">
            Apply for Coaching
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          </Link>
          <p className="mt-6 text-[0.82rem] text-text-muted">GHL application form embeds here</p>
        </div>
      </section>
    </main>
  );
}
