import type { Metadata } from "next";
import Image from "next/image";
import GhlWebinarForm from "@/components/GhlWebinarForm";
import { GHL_WEBINAR_FORM, WEBINAR, webinarRegistrationClosed } from "@/lib/webinar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "From Chaos To Control | Free Live Workshop",
  description: "A free live workshop with Marc Watters for trade and construction business owners. Thursday 15 October 2026 at 7pm UK and Ireland time.",
  alternates: { canonical: "/webinar" },
  openGraph: {
    title: "From Chaos To Control — Free Live Workshop",
    description: `${WEBINAR.dateLabel} at ${WEBINAR.timeLabel}. Live on Zoom with Marc Watters.`,
    images: ["/images/webinar/lead-form-header-15-october.jpg"],
  },
};

const outcomes = [
  "Why being good at your trade does not automatically teach you how to run a company.",
  "Where relying on the owner creates problems for the team and the business.",
  "How to identify the first thing to take off your plate and who should own it.",
  "What to look at first when jobs are busy but profit and time are under pressure.",
];

export default function WebinarOptIn() {
  const registrationClosed = webinarRegistrationClosed();

  return (
    <main className="overflow-hidden">
      <section className="relative px-5 pb-20 pt-8 sm:px-8 lg:min-h-screen lg:pb-24 lg:pt-10">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 72% 25%, rgba(34,114,222,0.15) 0%, transparent 42%), radial-gradient(ellipse at 15% 75%, rgba(34,114,222,0.07) 0%, transparent 38%)" }} />
        <div className="relative z-10 mx-auto max-w-[1240px]">
          <div className="mb-10 flex items-center gap-3">
            <Image src="/images/cbb-logo.png" alt="Construction Business Blueprint" width={42} height={42} className="h-10 w-auto" priority />
            <div className="font-heading text-[0.78rem] font-extrabold leading-tight tracking-[-0.2px] sm:text-sm">
              <span className="text-text-primary">CONSTRUCTION</span><br className="sm:hidden" />{" "}
              <span className="text-accent-bright">BUSINESS BLUEPRINT</span>
            </div>
          </div>

          <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1.12fr)_minmax(400px,0.88fr)] lg:gap-16">
            <div className="pt-2 lg:pt-10">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-4 py-2 text-xs font-bold uppercase tracking-[1.5px] text-accent-bright">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-bright shadow-[0_0_12px_rgba(96,165,250,0.8)]" />
                Free live workshop for trade &amp; construction owners
              </div>
              <h1 className="max-w-[720px] font-heading text-[3rem] font-black leading-[0.98] tracking-[-2.5px] sm:text-[4.4rem] lg:text-[5rem]">
                From Chaos<br /><span className="gradient-text">To Control</span>
              </h1>
              <p className="mt-5 font-heading text-xl font-bold text-text-primary sm:text-2xl">The shift from tradesman to business owner.</p>
              <p className="mt-6 max-w-[650px] text-base leading-8 text-text-secondary sm:text-lg">
                If every quote, site problem and decision still comes through you, there is a limit to what the business can do. In this live workshop, Marc will show you how to start changing the owner&apos;s role and build more structure into your team, your numbers and your working week.
              </p>
              <div className="mt-8 grid max-w-[680px] grid-cols-1 gap-3 sm:grid-cols-3">
                {[["Date", WEBINAR.shortDateLabel], ["Time", WEBINAR.timeLabel], ["Where", "Live on Zoom"]].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-white/[0.07] bg-white/[0.035] px-5 py-4 backdrop-blur-sm">
                    <div className="text-[0.67rem] font-bold uppercase tracking-[1.5px] text-text-muted">{label}</div>
                    <div className="mt-1 font-heading text-sm font-bold text-text-primary">{value}</div>
                  </div>
                ))}
              </div>
              <a href="#register" className="mt-8 inline-flex items-center gap-2 font-semibold text-accent-bright hover:text-white lg:hidden">Register below <span aria-hidden="true">↓</span></a>
            </div>

            <div id="register" className="relative scroll-mt-6">
              <div className="absolute -inset-8 rounded-[40px] bg-accent/10 blur-3xl" />
              <div className="relative overflow-hidden rounded-[24px] border border-white/[0.09] bg-[rgba(12,12,18,0.92)] shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                <div className="h-1 gradient-accent" />
                <Image
                  src="/images/webinar/lead-form-header-15-october.jpg"
                  alt="From Chaos To Control with Marc Watters, Thursday 15 October at 7pm UK and Ireland"
                  width={1200}
                  height={628}
                  className="h-auto w-full border-b border-white/[0.07]"
                  priority
                />
                <div className="p-6 sm:p-8">
                  <div className="mb-6">
                    <p className="text-xs font-bold uppercase tracking-[2px] text-accent-bright">Register free</p>
                    <h2 className="mt-2 font-heading text-2xl font-black tracking-[-0.7px]">Save your place</h2>
                    <p className="mt-2 text-sm leading-6 text-text-secondary">Enter your details to receive the joining instructions and workshop reminders.</p>
                  </div>
                  {registrationClosed ? (
                    <div className="rounded-xl border border-white/[0.08] bg-white/[0.035] px-5 py-8 text-center">
                      <p className="font-heading text-xl font-bold text-text-primary">Registration has closed.</p>
                      <p className="mt-3 text-sm leading-6 text-text-secondary">This live workshop has now started. You can still book a call with Marc to work through the next steps for your business.</p>
                      <a href="/book-marc" className="btn-primary gradient-accent mt-6 inline-flex rounded-xl px-6 py-3 font-bold text-white">Book a call with Marc</a>
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-xl bg-white">
                      <GhlWebinarForm
                        formId={GHL_WEBINAR_FORM.id}
                        formName={GHL_WEBINAR_FORM.name}
                        embedOrigin={GHL_WEBINAR_FORM.embedOrigin}
                        height={GHL_WEBINAR_FORM.height}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative border-y border-white/[0.05] bg-bg-secondary px-5 py-20 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-[1060px]">
          <div className="max-w-[680px]">
            <p className="text-xs font-bold uppercase tracking-[3px] text-accent-bright">What we&apos;ll cover</p>
            <h2 className="mt-4 font-heading text-[2rem] font-black leading-tight tracking-[-1.3px] sm:text-[2.8rem]">Start building a business that does not need you in every decision.</h2>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
            {outcomes.map((outcome, index) => (
              <div key={outcome} className="flex gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-5 sm:p-6">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 font-heading text-sm font-bold text-accent-bright">{index + 1}</span>
                <p className="text-[0.95rem] leading-7 text-text-secondary">{outcome}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative px-5 py-20 sm:px-8 sm:py-24">
        <div className="mx-auto grid max-w-[980px] items-center gap-10 sm:grid-cols-[220px_1fr]">
          <div className="relative mx-auto h-[260px] w-[200px] overflow-hidden rounded-[24px] border border-white/[0.08] sm:h-[290px] sm:w-[220px]">
            <Image src="/images/marc-about.png" alt="Marc Watters" fill sizes="220px" className="object-cover object-top" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[3px] text-accent-bright">Your host</p>
            <h2 className="mt-3 font-heading text-[2rem] font-black tracking-[-1px] sm:text-[2.5rem]">Marc Watters</h2>
            <p className="mt-5 text-base leading-8 text-text-secondary">Marc works with trade and construction business owners on the structure behind a well-run company: the numbers, the team, the systems and the owner&apos;s role. This session is practical, direct and built around the problems that show up in a real working business.</p>
            <a href="#register" className="btn-primary gradient-accent mt-7 inline-flex rounded-xl px-7 py-3.5 font-bold text-white transition hover:-translate-y-0.5 hover:shadow-[0_12px_35px_rgba(34,114,222,0.3)]">Save my free place</a>
          </div>
        </div>
      </section>

      <section className="border-t border-white/[0.05] bg-bg-secondary px-5 py-14 text-center sm:px-8">
        <p className="font-heading text-lg font-bold text-text-primary">{WEBINAR.dateLabel} · {WEBINAR.timeLabel}</p>
        <p className="mt-2 text-sm text-text-muted">One hour · Live on Zoom · Free to attend</p>
      </section>
    </main>
  );
}
