"use client";

import { useEffect, useState } from "react";
import {
  GROWTH_ENGINE_OFFERS,
  type GrowthEnginePrice,
  type GrowthEngineRegion,
  type GrowthEngineRegionOffers,
} from "@/lib/growth-engine-offers";

type AccessState = "loading" | "locked" | "unlocked" | "error";
type ServiceKey = "lead-generation" | "websites" | "receptionist";

interface GrowthEngineExperienceProps {
  previewUnlocked?: boolean;
  previewLocked?: boolean;
}

const REGION_STORAGE_KEY = "cbb-growth-engine-region";

function ArrowIcon() {
  return (
    <svg aria-hidden="true" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M5 12h14m-5-5 5 5-5 5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" width="14" height="14" className="ws-gx-check" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m5 12 4 4L19 6" />
    </svg>
  );
}

function CheckoutButton({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="ws-btn ws-btn-primary ws-focus ws-gx-cta"
      aria-label={`${label} — secure checkout opens in a new tab`}
    >
      Get started
      <ArrowIcon />
    </a>
  );
}

function PriceValue({ value, suffix }: { value: string; suffix?: string }) {
  return (
    <div className="ws-gx-price">
      <span className="ws-gx-price-n">{value}</span>
      {suffix && <span className="ws-caption">{suffix}</span>}
    </div>
  );
}

function PriceSummary({ price, priceSuffix }: { price: GrowthEnginePrice; priceSuffix?: string }) {
  return (
    <div className="ws-gx-prices">
      <div>
        <div className="ws-field-l">
          {price.paymentType === "one-off" ? "One-off payment" : "First payment"}
        </div>
        <PriceValue value={price.firstPayment} suffix={priceSuffix} />
      </div>
      {price.thenMonthly && (
        <div className="ws-gx-then">
          <div className="ws-field-l">Then monthly</div>
          <PriceValue value={price.thenMonthly} suffix={priceSuffix} />
        </div>
      )}
    </div>
  );
}

function ProblemSolution({
  problem,
  solution,
}: {
  problem: string;
  solution: string;
}) {
  return (
    <div className="ws-gx-ps">
      <div>
        <div className="ws-field-l">The problem</div>
        <p className="ws-prose">{problem}</p>
      </div>
      <div className="ws-gx-ps-arrow">
        <ArrowIcon />
      </div>
      <div>
        <div className="ws-field-l ws-gx-sol-l">The solution</div>
        <p className="ws-prose ws-gx-sol">{solution}</p>
      </div>
    </div>
  );
}

function ServiceSection({
  number,
  title,
  tagline,
  problem,
  solution,
  price,
  priceSuffix,
  idPrefix,
}: {
  number: string;
  title: string;
  tagline: string;
  problem: string;
  solution: string;
  price: GrowthEnginePrice;
  priceSuffix?: string;
  idPrefix: string;
}) {
  const headingId = `${idPrefix}-service-${number}`;

  return (
    <section className="ws-panel ws-gx-sec" aria-labelledby={headingId}>
      <div className="ws-gx-sec-grid">
        <div className="min-w-0">
          <div className="ws-caption">{number}</div>
          <h2 id={headingId} className="ws-gx-h">
            {title}
          </h2>
          <p className="ws-meta">{tagline}</p>
          <div className="ws-gx-ps-wrap">
            <ProblemSolution problem={problem} solution={solution} />
          </div>
        </div>
        <div className="ws-gx-buy">
          <PriceSummary price={price} priceSuffix={priceSuffix} />
          <div className="ws-gx-buy-cta">
            <CheckoutButton href={price.checkoutUrl} label={title} />
          </div>
          <p className="ws-caption ws-gx-stripe">Secure checkout powered by Stripe</p>
        </div>
      </div>
    </section>
  );
}

function WebsitePackage({
  name,
  description,
  features,
  price,
  priceSuffix,
  featured,
}: {
  name: string;
  description: string;
  features: string[];
  price: GrowthEnginePrice;
  priceSuffix?: string;
  featured?: boolean;
}) {
  return (
    <article
      className={`ws-panel ws-gx-pkg ${
        featured
          ? "is-featured"
          : ""
      }`}
    >
      <div>
        <h3 className="ws-cd-h">{name}</h3>
        <p className="ws-meta">{description}</p>
      </div>
      <ul className="ws-gx-feats">
        {features.map((feature) => (
          <li key={feature} className="ws-gx-feat">
            <CheckIcon />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <div className="ws-gx-pkg-foot">
        <PriceSummary price={price} priceSuffix={priceSuffix} />
        <div className="ws-gx-buy-cta">
          <CheckoutButton href={price.checkoutUrl} label={name} />
        </div>
      </div>
    </article>
  );
}

function ServiceSelector({
  serviceKey,
  title,
  tagline,
  active,
  detailsId,
  onToggle,
}: {
  serviceKey: ServiceKey;
  title: string;
  tagline: string;
  active: boolean;
  detailsId: string;
  onToggle: (service: ServiceKey) => void;
}) {
  return (
    <button
      id={`${detailsId}-trigger`}
      type="button"
      aria-expanded={active}
      aria-controls={detailsId}
      onClick={() => onToggle(serviceKey)}
      className={`ws-gx-pick ws-focus ${
        active
          ? "is-on"
          : ""
      }`}
    >
      <span>
        <span className="ws-cd-h ws-gx-pick-t">{title}</span>
        <span className="ws-meta ws-gx-pick-s">{tagline}</span>
      </span>
      <span className="ws-gx-pick-foot">
        {active ? "Hide details" : "Explore service"}
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          className={`ws-gx-pick-chev ${active ? "is-open" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" d="m6 9 6 6 6-6" />
        </svg>
      </span>
    </button>
  );
}

function ServiceDetails({
  service,
  offers,
  idPrefix,
  className = "",
}: {
  service: ServiceKey;
  offers: GrowthEngineRegionOffers;
  idPrefix: string;
  className?: string;
}) {
  const detailsId = `${idPrefix}-${service}-details`;

  return (
    <div id={detailsId} className={className} aria-live="polite">
      {service === "lead-generation" && (
        <>
          <ServiceSection
            number="01"
            title="AI Lead Generation"
            tagline="Create demand for your business."
            problem="Most agencies hand over a spreadsheet of names and numbers, then leave you to follow up when you find the time. By then, interest has cooled, another company may have replied, and the lead you paid for can disappear."
            solution="We generate the leads and build a custom AI agent that replies to every new enquiry in real time, asks the right qualifying questions, and books suitable prospects directly into your calendar."
            price={offers.leadGeneration}
            priceSuffix={offers.priceSuffix}
            idPrefix={idPrefix}
          />

          <aside
            className="ws-panel ws-gx-offer"
            aria-labelledby={`${idPrefix}-introductory-offer-heading`}
          >
            <div className="ws-gx-offer-grid">
              <div className="min-w-0">
                <span className="ws-chip is-decide">Save £1,919</span>
                <h2
                  id={`${idPrefix}-introductory-offer-heading`}
                  className="ws-gx-h"
                >
                  6 month introductory offer
                </h2>
                <p className="ws-meta">
                  Six months of the full AI Lead Generation service with a discounted setup fee,{" "}
                  <strong className="ws-gx-strong">plus AI Receptionist completely free</strong> for six months.
                </p>
              </div>
              <div>
                <div className="ws-field-l">One-off payment</div>
                <PriceValue value={offers.webinar.firstPayment} suffix={offers.priceSuffix} />
              </div>
              <CheckoutButton href={offers.webinar.checkoutUrl} label="6 Month Introductory Offer" />
            </div>
          </aside>
        </>
      )}

      {service === "websites" && (
        <section
          className="ws-panel ws-gx-sec"
          aria-labelledby={`${idPrefix}-service-02`}
        >
          <div className="ws-caption">02</div>
          <h2
            id={`${idPrefix}-service-02`}
            className="ws-gx-h"
          >
            Custom Websites
          </h2>
          <p className="ws-meta">Clear, fast websites built for customers and the way people search today.</p>
          <div className="ws-gx-ps-wrap">
            <ProblemSolution
              problem="More people now ask AI assistants such as ChatGPT to help them find and compare local businesses. Many conventional websites are vague, slow, or unclear about what the company does, where it works and why a customer should choose it."
              solution="We build a modern website for real customers and the new way people search: clear services and locations, useful answers, strong business signals, fast pages, and content that is easy for search and AI systems to understand."
            />
          </div>

          <div className="ws-gx-pkgs">
            <WebsitePackage
              name="Website A"
              description="One-page website"
              features={["A focused one-page website", "Clear services and service areas", "Built to work smoothly on mobile"]}
              price={offers.websites.a}
              priceSuffix={offers.priceSuffix}
            />
            <WebsitePackage
              name="Website B"
              description="Five-page website"
              features={["Five tailored website pages", "More room for services and locations", "Helpful content for customers and search"]}
              price={offers.websites.b}
              priceSuffix={offers.priceSuffix}
              featured
            />
            <WebsitePackage
              name="Website C + AI Booking Agent"
              description="Five-page website"
              features={["Everything in Website B", "AI agent handles initial website enquiries", "Suitable prospects can book into your diary"]}
              price={offers.websites.c}
              priceSuffix={offers.priceSuffix}
            />
          </div>
          <p className="ws-caption ws-gx-fine">
            Website visibility depends on many factors. We build a clear, search-ready foundation but do not guarantee rankings or inclusion in AI answers.
          </p>
        </section>
      )}

      {service === "receptionist" && (
        <ServiceSection
          number="03"
          title="AI Receptionist"
          tagline="Never miss an enquiry again."
          problem="The phone rings while you are on a job, driving, or speaking to a customer. By the time you call back, the prospect has often moved to the next business on Google that answered."
          solution="The AI Receptionist answers calls, captures the caller’s details and needs, handles the initial conversation, and books an appropriate callback or appointment into your diary."
          price={offers.receptionist}
          priceSuffix={offers.priceSuffix}
          idPrefix={idPrefix}
        />
      )}
    </div>
  );
}

function LockedState() {
  return (
    <div className="ws ws-gx-center">
      <div className="ws-panel ws-gx-lock">
        <div className="ws-ge-lock-ic">
          <svg aria-hidden="true" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M16 10V7a4 4 0 0 0-8 0v3m-1 0h10a2 2 0 0 1 2 2v7H5v-7a2 2 0 0 1 2-2Z" />
          </svg>
        </div>
        <div className="ws-caption ws-gx-k">CBB Growth Engine</div>
        <h1 className="ws-title">
          Your Growth Engine is currently locked
        </h1>
        <p className="ws-meta ws-gx-lock-p">
          This member-only section is not active on your account yet. Marc and the team will let you know when access is available.
        </p>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="ws ws-page" aria-label="Loading Growth Engine">
      <span className="ws-skel" style={{ width: 144, height: 12 }} />
      <span className="ws-skel" style={{ width: "100%", maxWidth: 576, height: 22 }} />
      <span className="ws-skel" style={{ width: "100%", maxWidth: 672, height: 12 }} />
      <span className="ws-skel" style={{ width: "100%", height: 128, borderRadius: 10 }} />
    </div>
  );
}

function RegionEntry({
  onChoose,
}: {
  onChoose: (region: GrowthEngineRegion) => void;
}) {
  return (
    <div className="ws ws-gx-center is-tall">
      <section className="ws-gx-region" aria-labelledby="region-entry-heading">
        <div className="ws-caption ws-gx-k">CBB Growth Engine</div>
        <h1
          id="region-entry-heading"
          className="ws-title"
        >
          Where is your business based?
        </h1>
        <div className="ws-gx-regions" role="radiogroup" aria-label="Business location">
          {(["uk", "ireland"] as const).map((regionKey) => {
            const option = GROWTH_ENGINE_OFFERS[regionKey];
            return (
              <button
                key={regionKey}
                type="button"
                role="radio"
                aria-checked="false"
                onClick={() => onChoose(regionKey)}
                className="ws-gx-reg ws-focus"
              >
                <span className="min-w-0">
                  <span className="ws-cd-h ws-gx-reg-t">{option.label}</span>
                  <span className="ws-caption ws-gx-reg-s">{option.taxNote}</span>
                </span>
                <span className="ws-gx-reg-go">
                  <ArrowIcon />
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default function GrowthEngineExperience({
  previewUnlocked = false,
  previewLocked = false,
}: GrowthEngineExperienceProps) {
  const [access, setAccess] = useState<AccessState>(
    previewUnlocked ? "unlocked" : previewLocked ? "locked" : "loading",
  );
  const [region, setRegion] = useState<GrowthEngineRegion | null>(null);
  const [openService, setOpenService] = useState<ServiceKey | null>(null);

  useEffect(() => {
    const savedRegion = window.sessionStorage.getItem(REGION_STORAGE_KEY);
    if (savedRegion !== "uk" && savedRegion !== "ireland") return;
    const timer = window.setTimeout(() => setRegion(savedRegion), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (previewUnlocked || previewLocked) return;

    let cancelled = false;
    async function loadAccess() {
      try {
        const response = await fetch("/api/portal/growth-engine", { cache: "no-store" });
        if (!response.ok) {
          if (!cancelled) setAccess("error");
          return;
        }
        const data = (await response.json()) as { entitled?: boolean };
        if (!cancelled) setAccess(data.entitled ? "unlocked" : "locked");
      } catch {
        if (!cancelled) setAccess("error");
      }
    }

    void loadAccess();
    return () => {
      cancelled = true;
    };
  }, [previewLocked, previewUnlocked]);

  useEffect(() => {
    if (!openService || !region || window.matchMedia("(min-width: 1024px)").matches) return;

    const frame = window.requestAnimationFrame(() => {
      const trigger = document.getElementById(`mobile-${openService}-details-trigger`);
      trigger?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [openService, region]);

  function chooseRegion(nextRegion: GrowthEngineRegion) {
    window.sessionStorage.setItem(REGION_STORAGE_KEY, nextRegion);
    setRegion(nextRegion);
    setOpenService(null);
  }

  if (access === "loading") return <LoadingState />;
  if (access === "locked") return <LockedState />;
  if (access === "error") {
    return (
      <div className="ws ws-gx-center">
        <div className="ws-panel ws-gx-lock">
        <h1 className="ws-title">We could not load Growth Engine</h1>
        <p className="ws-meta ws-gx-lock-p">Please refresh the page. If the problem continues, contact the CBB team.</p>
        </div>
      </div>
    );
  }

  const offers = region ? GROWTH_ENGINE_OFFERS[region] : null;
  if (!offers) return <RegionEntry onChoose={chooseRegion} />;

  return (
    <div className="ws ws-page ws-gx">
      <header className="ws-ph">
        <div className="min-w-0">
        <div className="ws-caption">CBB Growth Engine</div>
        <h1 className="ws-title mt-1">
          Done-for-you systems
        </h1>
        <p className="ws-meta mt-1 max-w-3xl">
          Choose the system you want to explore. You will only see the details and pricing for the service you select.
        </p>
        </div>
      </header>

      <div className="ws-note ws-gx-loc">
        <div className="ws-gx-loc-t">
          <svg aria-hidden="true" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" d="M12 21s7-5.2 7-12A7 7 0 1 0 5 9c0 6.8 7 12 7 12Zm0-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
          </svg>
          <span>
            Prices for <strong className="ws-gx-strong">{offers.label}</strong>. {offers.taxNote}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            window.sessionStorage.removeItem(REGION_STORAGE_KEY);
            setRegion(null);
            setOpenService(null);
          }}
          className="ws-btn ws-btn-sm ws-focus"
        >
          Change location
        </button>
      </div>

      <section className="ws-gx-services" aria-labelledby="services-heading">
        <div className="ws-gx-services-head">
          <h2 id="services-heading" className="ws-cd-h">
            Choose a service
          </h2>
          <p className="ws-caption">Select an option to see how it works and what it costs.</p>
        </div>
        <div className="ws-gx-mobile lg:hidden">
          <ServiceSelector
            serviceKey="lead-generation"
            title="AI Lead Generation"
            tagline="Create demand and turn new enquiries into booked appointments."
            active={openService === "lead-generation"}
            detailsId="mobile-lead-generation-details"
            onToggle={(service) => setOpenService((current) => current === service ? null : service)}
          />
          {openService === "lead-generation" && (
            <ServiceDetails
              service="lead-generation"
              offers={offers}
              idPrefix="mobile"
              className="ws-gx-details"
            />
          )}
          <ServiceSelector
            serviceKey="websites"
            title="Custom Websites"
            tagline="A clear, fast website built for customers and the way people search today."
            active={openService === "websites"}
            detailsId="mobile-websites-details"
            onToggle={(service) => setOpenService((current) => current === service ? null : service)}
          />
          {openService === "websites" && (
            <ServiceDetails service="websites" offers={offers} idPrefix="mobile" className="ws-gx-details" />
          )}
          <ServiceSelector
            serviceKey="receptionist"
            title="AI Receptionist"
            tagline="Answer every call and book the right callback or appointment."
            active={openService === "receptionist"}
            detailsId="mobile-receptionist-details"
            onToggle={(service) => setOpenService((current) => current === service ? null : service)}
          />
          {openService === "receptionist" && (
            <ServiceDetails service="receptionist" offers={offers} idPrefix="mobile" className="ws-gx-details" />
          )}
        </div>

        <div className="ws-gx-desktop hidden lg:grid">
          <ServiceSelector
            serviceKey="lead-generation"
            title="AI Lead Generation"
            tagline="Create demand and turn new enquiries into booked appointments."
            active={openService === "lead-generation"}
            detailsId="desktop-lead-generation-details"
            onToggle={(service) => setOpenService((current) => current === service ? null : service)}
          />
          <ServiceSelector
            serviceKey="websites"
            title="Custom Websites"
            tagline="A clear, fast website built for customers and the way people search today."
            active={openService === "websites"}
            detailsId="desktop-websites-details"
            onToggle={(service) => setOpenService((current) => current === service ? null : service)}
          />
          <ServiceSelector
            serviceKey="receptionist"
            title="AI Receptionist"
            tagline="Answer every call and book the right callback or appointment."
            active={openService === "receptionist"}
            detailsId="desktop-receptionist-details"
            onToggle={(service) => setOpenService((current) => current === service ? null : service)}
          />
          {openService && (
            <ServiceDetails
              service={openService}
              offers={offers}
              idPrefix="desktop"
              className="ws-gx-details is-wide"
            />
          )}
        </div>
      </section>
    </div>
  );
}
