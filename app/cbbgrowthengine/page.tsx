import Script from "next/script";
import { GROWTH_ENGINE_CALENDAR_ID } from "@/lib/growth-engine-pipeline";

const WIDGET_URL = `https://api.leadconnectorhq.com/widget/booking/${GROWTH_ENGINE_CALENDAR_ID}`;

const points = [
  { n: "01", title: "Where your work comes from", text: "How enquiries reach you today, and where good jobs are slipping past." },
  { n: "02", title: "Where your week goes", text: "The admin, quoting and chasing that keeps you off the tools and off the business." },
  { n: "03", title: "What we'd build", text: "A clear plan for the Growth Engine in your business, and whether it's the right fit. No pressure either way." },
];

export default function GrowthEngineBookingPage() {
  return (
    <main className="geb">
      <div className="geb-glow" aria-hidden />
      <div className="geb-grid" aria-hidden />

      <div className="geb-wrap">
        <header className="geb-top">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/cbb-logo.png" alt="Construction Business Blueprint" width={48} height={48} className="geb-logo" />
          <span className="geb-chip">
            <span className="geb-chip-dot" aria-hidden />
            CBB Growth Engine
          </span>
        </header>

        <section className="geb-hero">
          <h1 className="geb-h1">
            Book your <span className="geb-hl">Growth Engine</span> call
          </h1>
          <p className="geb-lede">
            A private 30-minute call with Kevin Harkin. We&apos;ll look at how work comes into your business, where time
            is being lost, and what the Growth Engine would take off your plate.
          </p>
          <ul className="geb-facts" aria-label="Call details">
            <li>30 minutes</li>
            <li>Zoom</li>
            <li>For Blueprint clients</li>
          </ul>
        </section>

        <div className="geb-layout">
          <section className="geb-glass geb-cal" aria-label="Choose a time">
            <div className="geb-sheen" aria-hidden />
            <iframe
              src={WIDGET_URL}
              title="Book your Growth Engine call"
              className="geb-iframe"
              scrolling="no"
              id={`${GROWTH_ENGINE_CALENDAR_ID}_cbbgrowthengine`}
            />
          </section>

          <aside className="geb-side">
            <div className="geb-glass geb-cover">
              <p className="geb-side-k">What we&apos;ll cover</p>
              <ol className="geb-points">
                {points.map((p) => (
                  <li key={p.n}>
                    <span className="geb-n">{p.n}</span>
                    <span>
                      <strong>{p.title}</strong>
                      <span>{p.text}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="geb-glass geb-note">
              <p>
                Pick a time that suits you. Your confirmation and Zoom link land in your inbox straight away, and you can
                reschedule from that email if anything changes.
              </p>
            </div>
          </aside>
        </div>

        <footer className="geb-foot">Construction Business Blueprint</footer>
      </div>

      <Script src="https://link.msgsndr.com/js/form_embed.js" strategy="afterInteractive" />
    </main>
  );
}
