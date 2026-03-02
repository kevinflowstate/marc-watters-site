import Link from "next/link";

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

const steps = [
  { num: "1", title: "Apply", desc: "Fill in a short application. This isn't for everyone - it's for serious operators who are ready to do the work." },
  { num: "2", title: "Discovery Call", desc: "If it looks like a fit, we'll get on a call. No pitch. Just a straight conversation about where you are and where you want to be." },
  { num: "3", title: "Start Building", desc: "You get a structured programme, a clear plan, and direct support. From day one, you'll know exactly what to focus on." },
];

export default function Home() {
  return (
    <main>
      {/* HERO */}
      <section className="min-h-screen flex items-center pt-[120px] pb-20 px-8 relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "radial-gradient(ellipse at 20% 50%, rgba(200, 162, 78, 0.06) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(200, 162, 78, 0.03) 0%, transparent 50%)"
        }} />

        <div className="max-w-[1200px] mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative z-10">
          <div className="max-w-[600px]">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 rounded-full px-4 py-1.5 text-[0.8rem] font-medium text-accent-light mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              Private Mentorship
            </div>

            <h1 className="font-heading text-[2.25rem] md:text-[3.5rem] font-extrabold leading-[1.1] tracking-[-1.5px] mb-6">
              Stop Running Your Business Like a <span className="text-accent">One-Man Fire Brigade</span>
            </h1>

            <p className="text-[1.15rem] text-text-secondary leading-[1.8] mb-8 max-w-[520px]">
              Private mentorship for trade and construction business owners who want profit, structure, and a business that doesn&apos;t depend on them doing everything.
            </p>

            <div className="flex gap-4 items-center flex-wrap">
              <Link href="/apply" className="inline-flex items-center gap-2 gradient-accent text-bg-primary px-9 py-4 rounded-lg font-bold text-base no-underline hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(200,162,78,0.25)] transition-all">
                Apply for Coaching
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </Link>
              <a href="#how-it-works" className="inline-flex items-center gap-2 bg-transparent text-text-primary px-7 py-4 rounded-lg font-semibold text-[0.95rem] no-underline border border-border hover:border-text-muted hover:bg-white/[0.03] transition-all">
                Learn More
              </a>
            </div>

            {/* Media links */}
            <div className="flex gap-6 items-center mt-10 pt-8 border-t border-border">
              <a href="#" className="flex items-center gap-2.5 text-text-secondary no-underline text-[0.85rem] font-medium hover:text-text-primary transition-colors group">
                <svg className="w-7 h-7 opacity-70 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
                Podcast
              </a>
              <a href="#" className="flex items-center gap-2.5 text-text-secondary no-underline text-[0.85rem] font-medium hover:text-text-primary transition-colors group">
                <svg className="w-7 h-7 opacity-70 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                YouTube
              </a>
            </div>
          </div>

          {/* Hero image placeholder */}
          <div className="relative hidden lg:flex justify-center items-center">
            <div className="absolute w-[300px] h-[300px] bg-[radial-gradient(circle,rgba(200,162,78,0.1)_0%,transparent_70%)] rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
            <div className="w-full max-w-[500px] aspect-[4/5] bg-bg-card border border-border rounded-2xl flex flex-col justify-center items-center gap-4 text-text-muted text-sm relative overflow-hidden">
              <div className="absolute bottom-0 left-0 right-0 h-[40%] bg-gradient-to-t from-accent/5 to-transparent" />
              <svg className="w-12 h-12 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
              Marc&apos;s photo here
            </div>
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="py-[100px] px-8 bg-bg-secondary">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-[0.8rem] font-semibold text-accent uppercase tracking-[2px] mb-4">The Reality</div>
          <div className="font-heading text-[2rem] md:text-[2.5rem] font-extrabold leading-[1.15] tracking-[-1px] mb-6">Sound Familiar?</div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mt-12">
            <div className="text-[1.1rem] text-text-secondary leading-[2]">
              <p className="mb-6">You&apos;re up at 6am, on site by 7, quoting jobs at 9pm. The phone doesn&apos;t stop. You&apos;re chasing suppliers, chasing payments, chasing your own tail.</p>
              <p className="mb-6">You&apos;ve got work on. You might even be flat out. But the profit doesn&apos;t match the effort. Cash flow is a constant headache. Your team needs babysitting. And every time you try to step back, something falls apart.</p>
              <p className="mb-6">You&apos;ve tried hiring. Tried spreadsheets. Tried working harder. None of it fixed the actual problem.</p>
              <p className="text-text-primary font-medium">The problem is the business has no structure. And without structure, growth just means more chaos.</p>
            </div>

            <div className="flex flex-col gap-4">
              {problems.map((p, i) => (
                <div key={i} className="flex items-start gap-4 bg-bg-card border border-border rounded-xl px-6 py-5 hover:border-accent/30 transition-colors">
                  <div className="w-9 h-9 min-w-[36px] bg-[rgba(220,80,80,0.1)] rounded-lg flex items-center justify-center text-[#dc5050] text-base">!</div>
                  <div className="text-[0.95rem] text-text-secondary leading-[1.6]">
                    <strong className="text-text-primary">{p.title}</strong> {p.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SOLUTION / PILLARS */}
      <section className="py-[100px] px-8">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center max-w-[700px] mx-auto mb-12">
            <div className="text-[0.8rem] font-semibold text-accent uppercase tracking-[2px] mb-4">The Programme</div>
            <div className="font-heading text-[2rem] md:text-[2.5rem] font-extrabold leading-[1.15] tracking-[-1px] mb-6">The Construction Business Blueprint</div>
            <div className="text-[1.1rem] text-text-secondary max-w-[640px] mx-auto leading-[1.8]">
              A private, one-to-one mentorship programme built specifically for trade and construction business owners. No courses. No group calls with 200 strangers. No motivational fluff.
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 mt-12">
            {pillars.map((p, i) => (
              <div key={i} className="bg-bg-card border border-border rounded-2xl px-6 py-8 text-center hover:-translate-y-1 hover:border-accent/30 transition-all relative overflow-hidden group">
                <div className="absolute top-0 left-0 right-0 h-[3px] gradient-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="w-14 h-14 bg-accent/10 rounded-xl flex items-center justify-center mx-auto mb-5 text-2xl">{p.icon}</div>
                <h3 className="font-heading text-base font-bold mb-3">{p.title}</h3>
                <p className="text-[0.85rem] text-text-secondary leading-[1.6]">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section id="results" className="py-[100px] px-8 bg-bg-secondary">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-[0.8rem] font-semibold text-accent uppercase tracking-[2px] mb-4">Results</div>
          <div className="font-heading text-[2rem] md:text-[2.5rem] font-extrabold leading-[1.15] tracking-[-1px] mb-6">What Clients Are Saying</div>
          <div className="text-[1.1rem] text-text-secondary max-w-[640px] leading-[1.8]">Real outcomes from trade and construction business owners on the programme.</div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            {testimonials.map((t, i) => (
              <div key={i} className="bg-bg-card border border-border rounded-2xl p-8 hover:-translate-y-0.5 hover:border-accent/30 transition-all">
                <div className="text-base italic text-text-secondary leading-[1.8] mb-6 pl-5 border-l-2 border-accent">
                  &ldquo;{t.quote}&rdquo;
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-accent/15 rounded-full flex items-center justify-center font-bold text-[0.85rem] text-accent">{t.initials}</div>
                  <div className="text-[0.85rem]">
                    <strong className="block text-text-primary">{t.role}</strong>
                    <span className="text-text-muted">{t.location}</span>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap mt-4">
                  {t.tags.map((tag, j) => (
                    <span key={j} className="bg-accent/[0.08] border border-accent/15 rounded-full px-3 py-1 text-[0.75rem] font-medium text-accent-light">{tag}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT PREVIEW */}
      <section id="about" className="py-[100px] px-8">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-[0.8rem] font-semibold text-accent uppercase tracking-[2px] mb-4">About</div>
          <div className="font-heading text-[2rem] md:text-[2.5rem] font-extrabold leading-[1.15] tracking-[-1px] mb-6">About Marc</div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-16 mt-12">
            <div className="aspect-[3/4] bg-bg-card border border-border rounded-2xl flex flex-col justify-center items-center gap-4 text-text-muted text-sm max-w-[400px]">
              <svg className="w-12 h-12 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
              Marc&apos;s photo here
            </div>

            <div>
              <p className="text-text-secondary mb-4 leading-[1.8]">Marc Watters has spent years in the construction industry. Not watching from the sidelines - in it. On the tools, running jobs, managing teams, dealing with the exact problems that every trade and construction business owner faces.</p>
              <p className="text-text-secondary mb-4 leading-[1.8]">The difference is he figured out what actually works. Not theory. Not motivation. Structure. Numbers. Systems. Standards.</p>
              <p className="text-text-secondary mb-4 leading-[1.8]">Today, Marc works privately with construction business owners across the UK and Ireland who want to build a business that&apos;s profitable, well-run, and doesn&apos;t rely on them doing everything themselves.</p>

              <h3 className="font-heading text-xl font-bold mt-8 mb-4 text-accent">His Approach</h3>
              <p className="text-text-secondary mb-4 leading-[1.8]">This isn&apos;t a course. There&apos;s no app full of content you&apos;ll never watch. There&apos;s no group call where you&apos;re one of 200 faces on a screen. It&apos;s private mentorship. One to one. Tailored to your business, your numbers, your situation.</p>

              <h3 className="font-heading text-xl font-bold mt-8 mb-4 text-accent">Who This Is For</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                {[
                  "Trade and construction business owners running a team",
                  "Owners still on the tools carrying the whole business",
                  "Businesses doing the work but not seeing the profit",
                  "Operators who want structure, not motivation",
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm text-text-secondary">
                    <span className="text-accent text-base mt-0.5 min-w-[18px]">-</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-[100px] px-8 bg-bg-secondary">
        <div className="max-w-[1200px] mx-auto text-center">
          <div className="text-[0.8rem] font-semibold text-accent uppercase tracking-[2px] mb-4">Process</div>
          <div className="font-heading text-[2rem] md:text-[2.5rem] font-extrabold leading-[1.15] tracking-[-1px] mb-6">How It Works</div>
          <div className="text-[1.1rem] text-text-secondary mx-auto leading-[1.8]">Three steps. No fluff. No 47-page application.</div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12 relative">
            {/* Connector line (desktop only) */}
            <div className="hidden md:block absolute top-10 left-[calc(16.66%+20px)] right-[calc(16.66%+20px)] h-0.5 bg-border" />

            {steps.map((s, i) => (
              <div key={i} className="text-center relative">
                <div className="w-20 h-20 bg-bg-card border-2 border-accent rounded-full flex items-center justify-center mx-auto mb-6 font-heading text-[1.75rem] font-extrabold text-accent relative z-10">
                  {s.num}
                </div>
                <h3 className="font-heading text-[1.15rem] font-bold mb-3">{s.title}</h3>
                <p className="text-sm text-text-secondary leading-[1.7] max-w-[300px] mx-auto">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CLIENT PORTAL PREVIEW */}
      <section id="portal-preview" className="py-[100px] px-8 bg-bg-secondary">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-[0.8rem] font-semibold text-accent uppercase tracking-[2px] mb-4">Exclusive to Members</div>
          <div className="font-heading text-[2rem] md:text-[2.5rem] font-extrabold leading-[1.15] tracking-[-1px] mb-6">Your Personal Client Portal</div>
          <div className="text-[1.1rem] text-text-secondary max-w-[640px] leading-[1.8]">Every client gets their own private dashboard with training modules, progress tracking, and weekly check-ins. Everything you need, in one place.</div>

          <div className="mt-12 bg-bg-card border border-border rounded-2xl overflow-hidden">
            {/* Browser chrome */}
            <div className="px-6 py-4 bg-accent/5 border-b border-border flex justify-between items-center">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-border" />
                <span className="w-2.5 h-2.5 rounded-full bg-border" />
                <span className="w-2.5 h-2.5 rounded-full bg-border" />
              </div>
              <span className="text-[0.85rem] font-semibold text-text-secondary">portal.marcwatters.co.uk</span>
            </div>

            <div className="p-8">
              <div className="font-heading text-xl font-bold mb-6">Welcome back, James.</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: "Modules Assigned", value: "8", sub: "5 completed" },
                  { label: "Check-Ins Submitted", value: "12", sub: "Next due Friday" },
                  { label: "Week Rating", value: "8/10", sub: "Trending up" },
                ].map((card, i) => (
                  <div key={i} className="bg-bg-primary border border-border rounded-xl p-6">
                    <div className="text-[0.75rem] font-semibold text-text-muted uppercase tracking-[1px] mb-2">{card.label}</div>
                    <div className="font-heading text-[2rem] font-extrabold text-accent">{card.value}</div>
                    <div className="text-[0.8rem] text-text-muted mt-1">{card.sub}</div>
                  </div>
                ))}
              </div>

              {/* Progress bar */}
              <div className="mt-6">
                <div className="flex justify-between text-[0.85rem] mb-2">
                  <span className="text-text-secondary">Programme Progress</span>
                  <span className="text-accent font-semibold">65%</span>
                </div>
                <div className="h-2 bg-bg-primary rounded-full overflow-hidden">
                  <div className="h-full w-[65%] gradient-accent rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="apply-section" className="py-[100px] px-8 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(200,162,78,0.06)_0%,transparent_70%)] pointer-events-none" />
        <div className="relative z-10 max-w-[700px] mx-auto">
          <div className="text-[0.8rem] font-semibold text-accent uppercase tracking-[2px] mb-4">Get Started</div>
          <div className="font-heading text-[2rem] md:text-[2.5rem] font-extrabold leading-[1.15] tracking-[-1px] mb-4">Ready to Build a Business That Actually Works?</div>
          <div className="text-[1.1rem] text-text-secondary mx-auto mb-10 leading-[1.8]">Apply for the Construction Business Blueprint. If it&apos;s a fit, you&apos;ll hear back directly from Marc.</div>
          <Link href="/apply" className="inline-flex items-center gap-2 gradient-accent text-bg-primary px-10 py-[18px] rounded-lg font-bold text-[1.1rem] no-underline hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(200,162,78,0.25)] transition-all">
            Apply for Coaching
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          </Link>
        </div>
      </section>
    </main>
  );
}
