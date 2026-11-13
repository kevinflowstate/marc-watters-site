import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import SessionRegistration from "@/components/webinar/SessionRegistration";
import { DECEMBER_WEBINAR, WEBINAR_SESSIONS, decemberRegistrationEnabled, getDecemberSession } from "@/lib/webinar-december";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "The CBB 2027 Growth Engine | Free Live Workshop",
  description: "A free live workshop for construction business owners ready to walk into 2027 with more time, profit and control. Wednesday 9 December, 1pm or 7pm.",
  alternates: { canonical: "/webinar" },
  openGraph: { title: DECEMBER_WEBINAR.title, description: "Wednesday 9 December · Choose 1pm or 7pm · Free live workshop with Marc Watters", images: [{ url: "/images/webinar/cbb-2027-growth-engine.jpg", width: 1200, height: 628 }] },
  twitter: { card: "summary_large_image", images: ["/images/webinar/cbb-2027-growth-engine.jpg"] },
};
const outcomes = [
  ["Get your time back", "How to get yourself off the tools and out of every decision, without the business falling over."],
  ["Price for profit", "How to price jobs so the profit’s actually there at the end."],
  ["Know your numbers", "How to know your numbers before the month’s over, not after."],
  ["Build a team you can trust", "How to build a team that handles problems without ringing you."],
  ["Start January with a plan", "A clear idea of what to fix first, so January starts with a plan."],
  ["Get your questions answered", "Live answers from someone who’s seen these problems in businesses of every size."],
];
const testimonials = ["obge0_bDhqg", "1FILP9frS9E", "7eRY9Wgr67c"];
export default async function WebinarPage({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const query = await searchParams;
  const selected = getDecemberSession(query.session);
  const enabled = decemberRegistrationEnabled();
  const forms = { "1pm": process.env.WEBINAR_DEC_2026_1PM_FORM_ID || WEBINAR_SESSIONS[0].formId, "7pm": process.env.WEBINAR_DEC_2026_7PM_FORM_ID || WEBINAR_SESSIONS[1].formId };
  // Dynamic server render supplies the request time; the client clock keeps session cutoffs current.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  return <main className="overflow-hidden">
    {!enabled && <div className="border-b border-accent/25 bg-accent/10 px-5 py-2 text-center text-xs font-semibold text-accent-bright">Campaign review preview · Registration is off</div>}
    <section className="relative px-5 pb-16 pt-7 sm:px-8 lg:pb-24 lg:pt-9">
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at 75% 20%, rgba(34,114,222,0.16), transparent 48%)" }} />
      <div className="relative mx-auto max-w-[1240px]">
        <Link href="/" className="inline-flex items-center gap-3"><Image src="/images/cbb-logo.png" alt="Construction Business Blueprint" width={42} height={42} className="h-10 w-auto" priority /><span className="font-heading text-xs font-extrabold leading-tight tracking-wide sm:text-sm">CONSTRUCTION<br /><span className="text-accent-bright">BUSINESS BLUEPRINT</span></span></Link>
        <div className="mt-10 grid items-start gap-10 lg:mt-14 lg:grid-cols-[minmax(0,1.12fr)_minmax(370px,.88fr)] lg:gap-14">
          <div className="lg:pt-3">
            <p className="text-xs font-bold uppercase tracking-[2px] text-accent-bright">Free live workshop · Construction business owners</p>
            <h1 className="mt-5 max-w-[720px] font-heading text-[2.8rem] font-extrabold leading-[1.04] tracking-[-1.8px] sm:text-[4.1rem] lg:text-[4.5rem]">The CBB 2027<br /><span className="gradient-text">Growth Engine</span></h1>
            <p className="mt-6 max-w-[620px] text-lg leading-8 text-text-secondary sm:text-xl sm:leading-9">A free live workshop for construction business owners ready to walk into 2027 with <strong className="font-semibold text-white">more time, profit &amp; control.</strong></p>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 border-y border-white/10 py-4 text-sm font-semibold"><span>Wednesday 9 December</span><span className="text-accent-bright">1pm or 7pm</span><span>Live on Zoom · One hour</span></div>
            <div className="mt-8 flex items-center gap-4"><div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-white/15"><Image src="/images/marc-about.png" alt="Marc Watters" fill sizes="64px" className="object-cover object-top" /></div><div><p className="font-heading text-sm font-bold">With Marc Watters</p><p className="mt-1 text-xs text-text-muted">Construction Business Blueprint</p></div></div>
            <a href="#register" className="mt-7 inline-flex font-semibold text-accent-bright underline underline-offset-4 lg:hidden">Choose my session ↓</a>
          </div>
          <div id="register" className="scroll-mt-6 overflow-hidden rounded-2xl border border-white/15 bg-bg-card shadow-[0_24px_80px_rgba(0,0,0,.35)]">
            <Image src="/images/webinar/cbb-2027-growth-engine.jpg" alt="The CBB 2027 Growth Engine, Wednesday 9 December, 1pm and 7pm" width={1200} height={628} priority className="h-auto w-full border-b border-white/10" />
            <div className="p-5 sm:p-7"><SessionRegistration initialSession={selected?.id} enabled={enabled} forms={forms} nowMs={nowMs} /></div>
          </div>
        </div>
      </div>
    </section>
    <section className="border-y border-white/[.07] bg-bg-secondary px-5 py-16 sm:px-8 sm:py-20"><div className="mx-auto max-w-[1120px]"><p className="text-xs font-bold uppercase tracking-[2.5px] text-accent-bright">What you’ll walk away with</p><h2 className="mt-4 max-w-[800px] font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">Make 2027 the year the business stops relying on you for everything.</h2><div className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">{outcomes.map(([title, text], i) => <div key={title} className="border-t border-white/10 pt-5"><span className="font-heading text-sm font-bold text-accent-bright">0{i + 1}</span><h3 className="mt-3 font-heading text-lg font-bold">{title}</h3><p className="mt-2 text-sm leading-7 text-text-secondary">{text}</p></div>)}</div></div></section>
    <section className="px-5 py-16 sm:px-8 sm:py-20"><div className="mx-auto grid max-w-[1120px] gap-10 md:grid-cols-[.65fr_1fr]"><div><p className="text-xs font-bold uppercase tracking-[2.5px] text-accent-bright">Who it’s for</p><h2 className="mt-4 font-heading text-3xl font-extrabold leading-tight tracking-tight">You’ve built a business.<br />Now make it work for you.</h2></div><div className="text-base leading-8 text-text-secondary"><p>Trade and construction business owners — builders, sparks, plumbers, joiners, roofers, contractors — who’ve got a business that works but are tired of it relying on them for everything.</p><p className="mt-4">Built for established businesses doing £250k to £10 million, or serious about getting there.</p><a href="#register" className="mt-6 inline-flex font-bold text-accent-bright underline underline-offset-4">Choose 1pm or 7pm →</a></div></div></section>
    <section className="border-y border-white/[.07] bg-bg-secondary px-5 py-16 sm:px-8 sm:py-20"><div className="mx-auto grid max-w-[1000px] items-center gap-8 sm:grid-cols-[230px_1fr] sm:gap-12"><div className="relative mx-auto h-[300px] w-[230px] overflow-hidden rounded-2xl"><Image src="/images/marc-about.png" alt="Marc Watters, Construction Business Blueprint founder" fill sizes="230px" className="object-cover object-top" /></div><div><p className="text-xs font-bold uppercase tracking-[2.5px] text-accent-bright">Your host</p><h2 className="mt-3 font-heading text-3xl font-extrabold tracking-tight">Marc Watters</h2><p className="mt-5 text-sm leading-7 text-text-secondary">Marc started on building sites at fourteen, served his time, and went out on his own with no clue how to run a business. Twenty years later, having worked from apprentice to director level across major firms, he’s seen the same problems in one-man bands and multi-million-pound companies.</p><p className="mt-4 text-sm leading-7 text-text-secondary">Through the Construction Business Blueprint he’s taken 50+ construction business owners through the shift from tradesman to business owner.</p></div></div></section>
    <section className="px-5 py-16 sm:px-8 sm:py-20"><div className="mx-auto max-w-[1120px]"><p className="text-xs font-bold uppercase tracking-[2.5px] text-accent-bright">Construction Business Blueprint</p><h2 className="mt-4 font-heading text-3xl font-extrabold tracking-tight">Hear from Marc’s clients</h2><div className="mt-8 grid gap-5 md:grid-cols-3">{testimonials.map((id, i) => <div key={id} className="aspect-[9/16] overflow-hidden rounded-xl border border-white/10 bg-black"><iframe className="h-full w-full" src={`https://www.youtube-nocookie.com/embed/${id}`} title={`Construction Business Blueprint client story ${i + 1}`} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /></div>)}</div></div></section>
    <section className="border-t border-white/10 bg-accent/[.07] px-5 py-14 text-center sm:px-8"><h2 className="mx-auto max-w-[760px] font-heading text-2xl font-extrabold leading-tight sm:text-3xl">Don’t walk into 2027 doing the same thing.</h2><p className="mt-4 text-sm text-text-secondary">Wednesday 9 December · 1pm or 7pm · Free · Live on Zoom</p><a href="#register" className="gradient-accent mt-7 inline-flex rounded-xl px-7 py-4 font-heading text-sm font-bold text-white">Pick my session &amp; save my spot</a></section>
  </main>;
}
