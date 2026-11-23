import Script from "next/script";
import { GROWTH_ENGINE_CALENDAR_ID } from "@/lib/growth-engine-pipeline";

const WIDGET_URL = `https://api.leadconnectorhq.com/widget/booking/${GROWTH_ENGINE_CALENDAR_ID}`;
const IMG = "/images/growth-engine";

const leadGen = [
  {
    tag: "Ads",
    title: "Paid ads on Facebook and Instagram",
    text: "Done-for-you campaigns aimed at the jobs you want, in the areas you work. Creative, targeting and testing all handled. The ad budget is yours and goes straight on reaching homeowners.",
  },
  {
    tag: "Setter",
    title: "AI appointment setter",
    text: "Every lead gets a reply in seconds, day or night. It asks the right questions about the job, weeds out the tyre-kickers and books the good ones into your diary.",
  },
  {
    tag: "Website",
    title: "A website built to be found",
    text: "Optimised for Google and AI search. From a sharp single page up to a full site with a live booking agent that chats to visitors and books them in on the spot.",
  },
  {
    tag: "Phone",
    title: "AI receptionist",
    text: "Missed a call on the tools? It answers, talks naturally, takes the details of the job and books a callback. Twenty-four hours a day, so no enquiry rings out.",
  },
  {
    tag: "Follow-up",
    title: "Follow-up that never drops the ball",
    text: "Leads that go quiet get followed up until they book or say no. Old quotes and past customers get worked back into live jobs.",
  },
  {
    tag: "Pipeline",
    title: "Every lead tracked to the signed job",
    text: "One pipeline from first enquiry to won work, with reporting on what it cost and which jobs it brought in.",
  },
];

const flow = [
  { n: "01", t: "The ad", s: "Shown to homeowners near you" },
  { n: "02", t: "Instant reply", s: "AI answers in seconds" },
  { n: "03", t: "Qualified", s: "Job, budget, timing, area" },
  { n: "04", t: "Booked", s: "Straight into your diary" },
  { n: "05", t: "You quote", s: "Turn up to a warm lead" },
];

const phases = [
  {
    d: "Days 1-30",
    w: "Map it",
    h: "The AI mapped around your business",
    intro: "Every construction business runs differently. So it starts with yours: how you quote, how you price, who does what, and where the hours actually go.",
    ticks: [
      ["Every job on the table.", "The work that eats your week, and what's worth handing over first."],
      ["Your business brain.", "Your rates, services and how you talk to customers, written down in one place you own."],
      ["Connected properly.", "Email, accounts, files and messages, each with only the access its job needs."],
      ["A quick win early.", "The first agent doing real work in your hands by day 14."],
    ],
  },
  {
    d: "Days 31-60",
    w: "Build it",
    h: "Your AI team, built",
    intro: "Agent by agent, from the moment a job starts to the finished output. You see each one working on your own examples before anything goes live.",
    ticks: [
      ["Built job by job.", "Quotes, invoices, the diary, messages, chasing. Each agent owns its piece."],
      ["Weekly demos.", "Every week you see what's built, on your real examples."],
      ["Tested before it's trusted.", "Every agent runs on made-up jobs before it sees a real customer."],
      ["You keep the big calls.", "Money decisions and complaints always stay with you."],
    ],
  },
  {
    d: "Days 61-90",
    w: "Run it",
    h: "Run alongside you on real jobs",
    intro: "Going live isn't the finish line. For the last 30 days it runs on real work with support beside you, so it beds in properly and you're never left in the dark.",
    ticks: [
      ["Refining.", "Real jobs go through, the weak spots get fixed and the wording tightened every week."],
      ["Optimising.", "Switch on the jobs you trust first, then move more across as confidence builds."],
      ["Embedded safely.", "Clear rules for what each agent can and can't do, and your team trained to use it."],
      ["You're in control.", "You know how to pause, correct and update every agent, with a short guide for each."],
    ],
  },
];

const agents = [
  { c: "#e9e9f1", role: "Office manager", name: "PA", what: "Takes voice notes from the van, hands each job to the right agent, keeps your reminders and sends a brief before you start." },
  { c: "#ff6b1a", role: "Quotes and invoices", name: "Estimator", what: "Turns site notes and photos into a priced quote from your rates. Builds stage invoices and prices variations before they're forgotten." },
  { c: "#2f6bf0", role: "Site records", name: "Site Diary", what: "A daily diary from your voice notes and photos: who was on, what was delivered, the weather and any delays." },
  { c: "#19b36b", role: "Enquiries and messages", name: "Inbox", what: "Sorts enquiries, subbies, suppliers and customers. Flags what needs you and drafts replies the way you'd write them." },
  { c: "#ffc21a", role: "Cash and paperwork", name: "Money", what: "Tracks who owes what, flags stage payments and retentions as they fall due, and files supplier invoices for the accountant." },
  { c: "#7a5cf5", role: "Your page", name: "Social", what: "Turns finished-job photos into posts with captions in your voice, so your page shows the work you're proud of." },
];

const chips = ["Material orders", "Chasing subbies", "RAMS and method statements", "Snag lists", "Job start packs", "Timesheets", "Certs and handover packs", "Job costing", "Review requests"];

const rules = [
  ["Nothing goes out without you", "Every quote, invoice, text and post comes to you as a draft first. Your thumb is the last step."],
  ["It never touches money", "It tells you who owes you and drafts the chaser. It can't take, move or refund a penny."],
  ["It asks instead of guessing", "A rate it doesn't have, a name it can't place, a job that might clash. It asks before it fills a gap."],
  ["You own it", "Your accounts, your data, your business brain. Everything is built inside what you already use."],
];

function Book({ className = "" }: { className?: string }) {
  return (
    <a className={`geb-btn ${className}`} href="#book">
      Discuss your growth
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square" /></svg>
    </a>
  );
}

export default function GrowthEnginePage() {
  return (
    <main className="geb" id="top">
      <header className="geb-top">
        <div className="geb-wrap geb-top-in">
          <a className="geb-eyebrow" href="#top" aria-label="CBB Growth Engine">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${IMG}/cbb-b.png`} alt="" width={34} height={40} />
            <span>CBB Growth Engine</span>
          </a>
          <Book className="is-sm" />
        </div>
      </header>

      <section className="geb-hero">
        <div className="geb-hero-bg" role="img" aria-label="A builder in his van at night on his phone" />
        <div className="geb-wrap geb-hero-in">
          <p className="geb-lbl">For trade &amp; construction businesses</p>
          <h1 className="geb-h1">
            More work in. <span className="geb-brush">Less graft</span> running it.
          </h1>
          <p className="geb-sub">
            Growth Engine is two systems built around your business. AI lead generation that keeps the diary full, and AI
            integration that takes the office work off your plate.
          </p>
          <div className="geb-ctas">
            <Book />
            <span className="geb-note">30 minutes. Bring the jobs you want more of.</span>
          </div>
          <div className="geb-strip">
            <a href="#leads"><b>01</b>AI Lead Generation</a>
            <a href="#integration"><b>02</b>Construction AI Integration</a>
          </div>
        </div>
      </section>

      <section className="geb-sec">
        <div className="geb-wrap">
          <div className="geb-head">
            <p className="geb-lbl">What it is</p>
            <h2 className="geb-h2">Two engines. <span className="geb-brush">One business.</span></h2>
            <p className="geb-lede">Run one, or run both. Each is built around how your business actually works, not a template.</p>
          </div>
          <div className="geb-engines">
            <a className="geb-engine" href="#leads">
              <span className="geb-engine-n">01</span>
              <h3>AI Lead Generation</h3>
              <p>Ads, instant AI replies, a website built to be found and a receptionist that never misses a call. The front end of your business, working around the clock.</p>
              <span className="geb-engine-out"><b>The result</b>A fuller diary of qualified jobs</span>
            </a>
            <a className="geb-engine" href="#integration">
              <span className="geb-engine-n">02</span>
              <h3>Construction AI Integration</h3>
              <p>An AI team mapped, built and run inside your business in 90 days. Quotes, invoices, the site diary, messages and chasing money, handled from your phone.</p>
              <span className="geb-engine-out"><b>The result</b>Your evenings back</span>
            </a>
          </div>
        </div>
      </section>

      <section className="geb-sec geb-slab" id="leads">
        <div className="geb-wrap">
          <div className="geb-split">
            <div>
              <p className="geb-lbl">Engine 01</p>
              <h2 className="geb-h2">AI Lead <span className="geb-brush">Generation.</span></h2>
              <p className="geb-lede">
                The enquiry lands while you&apos;re up a ladder, and by the time you call back they&apos;ve booked someone
                else. This fixes both ends: more of the right enquiries coming in, and every one of them answered in
                seconds.
              </p>
            </div>
            <figure className="geb-photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${IMG}/hands-phone.jpg`} alt="A tradesman's hands holding a phone" />
              <figcaption>New enquiry. Answered.</figcaption>
            </figure>
          </div>

          <ol className="geb-flow" aria-label="How a lead becomes a booked job">
            {flow.map((f) => (
              <li key={f.n}>
                <span className="geb-flow-n">{f.n}</span>
                <b>{f.t}</b>
                <span>{f.s}</span>
              </li>
            ))}
          </ol>

          <div className="geb-cards">
            {leadGen.map((item) => (
              <article key={item.tag} className="geb-card">
                <span className="geb-tag">{item.tag}</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="geb-sec" id="integration">
        <div className="geb-wrap">
          <div className="geb-head">
            <p className="geb-lbl">Engine 02</p>
            <h2 className="geb-h2">Construction AI <span className="geb-brush">Integration.</span></h2>
            <p className="geb-lede">
              The office work that follows you home, handed to an AI team that knows your rates, your jobs and how you talk to
              customers. Mapped, built and run over 90 days.
            </p>
          </div>

          <div className="geb-phases">
            {phases.map((p, i) => (
              <div key={p.w} className={`geb-phase${i === 2 ? " is-run" : ""}`}>
                <div className="geb-phase-tag">
                  <span className="d">{p.d}</span>
                  <span className="w">{p.w}</span>
                </div>
                <div>
                  <h3>{p.h}</h3>
                  <p className="geb-phase-intro">{p.intro}</p>
                  <ul className="geb-ticks">
                    {p.ticks.map(([b, t]) => (
                      <li key={b}><b>{b}</b> {t}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
            <p className="geb-after"><b>After day 90</b>Support is agreed before the start. Keep it improving with ongoing support, or run it yourselves with everything handed over.</p>
          </div>

          <div className="geb-head geb-head-sub">
            <p className="geb-lbl">Where most businesses start</p>
            <h2 className="geb-h2 is-md">Six agents. <span className="geb-brush">Built for site.</span></h2>
          </div>
          <div className="geb-agents">
            {agents.map((a) => (
              <article key={a.name} className="geb-agent" style={{ "--c": a.c } as React.CSSProperties}>
                <div className="geb-agent-band">
                  <span className="role">{a.role}</span>
                  <h3>{a.name}</h3>
                </div>
                <p>{a.what}</p>
              </article>
            ))}
          </div>
          <div className="geb-own">
            <h3>Got a job you hate? <span className="geb-brush">Make it an agent.</span></h3>
            <p>If it comes round every week and follows the same steps, it can usually be handed over.</p>
            <div className="geb-chips">{chips.map((c) => <span key={c}>{c}</span>)}</div>
          </div>
        </div>
      </section>

      <section className="geb-sec geb-rules-sec">
        <div className="geb-wrap">
          <div className="geb-head">
            <p className="geb-lbl">You stay in charge</p>
            <h2 className="geb-h2">It does the graft. You make the calls.</h2>
          </div>
          <div className="geb-rules">
            {rules.map(([h, t]) => (
              <div key={h} className="geb-rule"><h3>{h}</h3><p>{t}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section className="geb-sec geb-book" id="book">
        <div className="geb-book-bg" aria-hidden />
        <div className="geb-wrap geb-book-in">
          <div className="geb-book-copy">
            <p className="geb-lbl">Discuss your growth</p>
            <h2 className="geb-h2">Pick a time. <span className="geb-brush">Let&apos;s talk.</span></h2>
            <p className="geb-lede">
              A straight 30-minute call about your business. Where your work comes from, where your week goes, and which
              engine would make the biggest difference first.
            </p>
            <ul className="geb-ticks is-single">
              <li><b>30 minutes on Zoom.</b> Link sent straight to your inbox.</li>
              <li><b>No obligation.</b> Walk away with a clear plan either way.</li>
              <li><b>Easy to move.</b> Reschedule from your confirmation email.</li>
            </ul>
          </div>
          <div className="geb-cal">
            <iframe
              src={WIDGET_URL}
              title="Book your Growth Engine call"
              className="geb-iframe"
              scrolling="no"
              id={`${GROWTH_ENGINE_CALENDAR_ID}_cbbgrowthengine`}
            />
          </div>
        </div>
      </section>

      <footer className="geb-foot">
        <div className="geb-wrap">CBB Growth Engine. Construction Business Blueprint.</div>
      </footer>

      <Script src="https://link.msgsndr.com/js/form_embed.js" strategy="afterInteractive" />
    </main>
  );
}
