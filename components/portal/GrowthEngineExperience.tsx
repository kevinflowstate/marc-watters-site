"use client";

import { useEffect, useState } from "react";
import {
  GROWTH_ENGINE_OFFERS,
  type GrowthEnginePrice,
  type GrowthEngineRegion,
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
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" d="M5 12h14m-5-5 5 5-5 5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-accent-bright" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
      className="btn-primary inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-center text-sm font-bold text-white no-underline transition-colors hover:bg-accent-light focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary"
      aria-label={`${label} — secure checkout opens in a new tab`}
    >
      Get Started
      <ArrowIcon />
    </a>
  );
}

function PriceValue({ value, suffix }: { value: string; suffix?: string }) {
  return (
    <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className="font-heading text-2xl font-extrabold tracking-tight text-text-primary">{value}</span>
      {suffix && <span className="text-xs font-bold uppercase tracking-[0.08em] text-text-secondary">{suffix}</span>}
    </div>
  );
}

function PriceSummary({ price, priceSuffix }: { price: GrowthEnginePrice; priceSuffix?: string }) {
  return (
    <div className="grid gap-4">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
          {price.paymentType === "one-off" ? "One-off payment" : "First payment"}
        </div>
        <PriceValue value={price.firstPayment} suffix={priceSuffix} />
      </div>
      {price.thenMonthly && (
        <div className="border-t border-border-light pt-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">Then monthly</div>
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
    <div className="grid gap-5 md:grid-cols-[1fr_auto_1fr] md:items-start">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">The problem</div>
        <p className="mt-2 text-sm leading-7 text-text-secondary">{problem}</p>
      </div>
      <div className="hidden pt-8 text-text-muted md:block">
        <ArrowIcon />
      </div>
      <div className="border-l-2 border-accent/40 pl-4 md:border-l-0 md:pl-0">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-bright">The solution</div>
        <p className="mt-2 text-sm leading-7 text-text-primary">{solution}</p>
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
}: {
  number: string;
  title: string;
  tagline: string;
  problem: string;
  solution: string;
  price: GrowthEnginePrice;
  priceSuffix?: string;
}) {
  return (
    <section className="border-t border-border-light py-10 sm:py-12" aria-labelledby={`service-${number}`}>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_310px] lg:gap-12">
        <div>
          <div className="text-xs font-bold tracking-[0.12em] text-accent-bright">{number}</div>
          <h2 id={`service-${number}`} className="mt-2 font-heading text-2xl font-extrabold tracking-tight text-text-primary sm:text-[28px]">
            {title}
          </h2>
          <p className="mt-2 text-base text-text-secondary">{tagline}</p>
          <div className="mt-7">
            <ProblemSolution problem={problem} solution={solution} />
          </div>
        </div>
        <div className="flex flex-col justify-center border-t border-border-light pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <PriceSummary price={price} priceSuffix={priceSuffix} />
          <div className="mt-5">
            <CheckoutButton href={price.checkoutUrl} label={title} />
          </div>
          <p className="mt-3 text-center text-xs text-text-muted">Secure checkout powered by Stripe</p>
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
      className={`flex h-full flex-col rounded-2xl border p-5 sm:p-6 ${
        featured
          ? "border-accent/70 bg-accent/[0.07] shadow-[0_0_0_1px_rgba(34,114,222,0.1)]"
          : "border-border-light bg-bg-card"
      }`}
    >
      <div>
        <h3 className="font-heading text-lg font-extrabold text-text-primary">{name}</h3>
        <p className="mt-1 text-sm text-text-secondary">{description}</p>
      </div>
      <ul className="mt-5 space-y-2.5 text-sm text-text-secondary">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <CheckIcon />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-7">
        <PriceSummary price={price} priceSuffix={priceSuffix} />
        <div className="mt-5">
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
  onToggle,
}: {
  serviceKey: ServiceKey;
  title: string;
  tagline: string;
  active: boolean;
  onToggle: (service: ServiceKey) => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={active}
      aria-controls="growth-engine-service-details"
      onClick={() => onToggle(serviceKey)}
      className={`group flex min-h-36 flex-col justify-between rounded-2xl border p-5 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright sm:p-6 ${
        active
          ? "border-accent/70 bg-accent/[0.08] shadow-[0_0_24px_rgba(34,114,222,0.1)]"
          : "border-border-light bg-bg-card hover:border-accent/40 hover:bg-bg-card-hover"
      }`}
    >
      <span>
        <span className="block font-heading text-lg font-extrabold text-text-primary">{title}</span>
        <span className="mt-2 block text-sm leading-6 text-text-secondary">{tagline}</span>
      </span>
      <span className={`mt-5 flex items-center justify-between text-xs font-bold uppercase tracking-[0.12em] ${active ? "text-accent-bright" : "text-text-muted group-hover:text-accent-bright"}`}>
        {active ? "Hide details" : "Explore service"}
        <svg
          aria-hidden="true"
          className={`h-5 w-5 transition-transform duration-200 ${active ? "rotate-180" : ""}`}
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

function LockedState() {
  return (
    <div className="mx-auto flex min-h-[62vh] max-w-2xl items-center justify-center py-10">
      <div className="w-full rounded-2xl border border-border-light bg-bg-card p-7 text-center sm:p-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-accent/20 bg-accent/[0.07] text-accent-bright">
          <svg aria-hidden="true" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M16 10V7a4 4 0 0 0-8 0v3m-1 0h10a2 2 0 0 1 2 2v7H5v-7a2 2 0 0 1 2-2Z" />
          </svg>
        </div>
        <div className="v2-eyebrow mt-6">CBB Growth Engine</div>
        <h1 className="mt-3 font-heading text-3xl font-extrabold tracking-tight text-text-primary sm:text-4xl">
          Your Growth Engine is currently locked
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-text-secondary sm:text-base">
          This member-only section is not active on your account yet. Marc and the team will let you know when access is available.
        </p>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="py-8" aria-label="Loading Growth Engine">
      <div className="skeleton h-4 w-36 rounded-md" />
      <div className="skeleton mt-4 h-11 w-full max-w-xl rounded-lg" />
      <div className="skeleton mt-4 h-5 w-full max-w-2xl rounded-md" />
      <div className="skeleton mt-10 h-32 w-full rounded-2xl" />
    </div>
  );
}

function RegionEntry({
  onChoose,
}: {
  onChoose: (region: GrowthEngineRegion) => void;
}) {
  return (
    <div className="mx-auto flex min-h-[72vh] max-w-3xl items-center justify-center py-8 sm:py-12">
      <section className="w-full text-center" aria-labelledby="region-entry-heading">
        <div className="v2-eyebrow">CBB Growth Engine</div>
        <h1
          id="region-entry-heading"
          className="mx-auto mt-4 max-w-2xl font-heading text-[34px] font-extrabold leading-[1.1] tracking-[-0.035em] text-text-primary sm:text-[44px]"
        >
          Where is your business based?
        </h1>
        <div className="mx-auto mt-10 grid max-w-2xl gap-4 sm:grid-cols-2" role="radiogroup" aria-label="Business location">
          {(["uk", "ireland"] as const).map((regionKey) => {
            const option = GROWTH_ENGINE_OFFERS[regionKey];
            return (
              <button
                key={regionKey}
                type="button"
                role="radio"
                aria-checked="false"
                onClick={() => onChoose(regionKey)}
                className="group flex min-h-24 items-center justify-between gap-5 rounded-2xl border border-border-light bg-bg-card px-5 py-5 text-left transition-colors hover:border-accent/60 hover:bg-accent/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright"
              >
                <span>
                  <span className="block font-heading text-base font-extrabold text-text-primary">{option.label}</span>
                  <span className="mt-1 block text-sm text-text-muted">{option.taxNote}</span>
                </span>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border-light text-text-muted transition-colors group-hover:border-accent/40 group-hover:text-accent-bright">
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

  function chooseRegion(nextRegion: GrowthEngineRegion) {
    window.sessionStorage.setItem(REGION_STORAGE_KEY, nextRegion);
    setRegion(nextRegion);
    setOpenService(null);
  }

  if (access === "loading") return <LoadingState />;
  if (access === "locked") return <LockedState />;
  if (access === "error") {
    return (
      <div className="mx-auto max-w-xl py-20 text-center">
        <h1 className="font-heading text-2xl font-extrabold text-text-primary">We could not load Growth Engine</h1>
        <p className="mt-3 text-sm text-text-secondary">Please refresh the page. If the problem continues, contact the CBB team.</p>
      </div>
    );
  }

  const offers = region ? GROWTH_ENGINE_OFFERS[region] : null;
  if (!offers) return <RegionEntry onChoose={chooseRegion} />;

  return (
    <div className="mx-auto max-w-[1180px] pb-16">
      <header className="pb-8 pt-1 sm:pb-10">
        <div className="v2-eyebrow">CBB Growth Engine</div>
        <h1 className="mt-3 max-w-4xl font-heading text-[34px] font-extrabold leading-[1.08] tracking-[-0.035em] text-text-primary sm:text-[44px] lg:text-[50px]">
          Done For You Systems
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-text-secondary sm:text-lg">
          Choose the system you want to explore. You will only see the details and pricing for the service you select.
        </p>
      </header>

      <div className="flex flex-col justify-between gap-3 rounded-xl border border-border-light bg-bg-card px-4 py-3 sm:flex-row sm:items-center">
        <div className="flex items-start gap-2 text-sm text-text-secondary">
          <svg aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-accent-bright" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" d="M12 21s7-5.2 7-12A7 7 0 1 0 5 9c0 6.8 7 12 7 12Zm0-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
          </svg>
          <span>
            Prices for <strong className="font-semibold text-text-primary">{offers.label}</strong>. {offers.taxNote}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            window.sessionStorage.removeItem(REGION_STORAGE_KEY);
            setRegion(null);
            setOpenService(null);
          }}
          className="self-start text-xs font-semibold text-accent-bright hover:text-accent-light sm:self-auto"
        >
          Change location
        </button>
      </div>

      <section className="mt-8" aria-labelledby="services-heading">
        <div className="mb-5">
          <h2 id="services-heading" className="font-heading text-xl font-extrabold text-text-primary sm:text-2xl">
            Choose a service
          </h2>
          <p className="mt-1 text-sm text-text-secondary">Select an option to see how it works and what it costs.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <ServiceSelector
            serviceKey="lead-generation"
            title="AI Lead Generation"
            tagline="Create demand and turn new enquiries into booked appointments."
            active={openService === "lead-generation"}
            onToggle={(service) => setOpenService((current) => current === service ? null : service)}
          />
          <ServiceSelector
            serviceKey="websites"
            title="Custom Websites"
            tagline="A clear, fast website built for customers and the way people search today."
            active={openService === "websites"}
            onToggle={(service) => setOpenService((current) => current === service ? null : service)}
          />
          <ServiceSelector
            serviceKey="receptionist"
            title="AI Receptionist"
            tagline="Answer every call and book the right callback or appointment."
            active={openService === "receptionist"}
            onToggle={(service) => setOpenService((current) => current === service ? null : service)}
          />
        </div>
      </section>

      {openService && (
        <div id="growth-engine-service-details" className="mt-8" aria-live="polite">
        {openService === "lead-generation" && (
          <>
          <ServiceSection
            number="01"
            title="AI Lead Generation"
            tagline="Create demand for your business."
            problem="Most agencies hand over a spreadsheet of names and numbers, then leave you to follow up when you find the time. By then, interest has cooled, another company may have replied, and the lead you paid for can disappear."
            solution="We generate the leads and build a custom AI agent that replies to every new enquiry in real time, asks the right qualifying questions, and books suitable prospects directly into your calendar."
            price={offers.leadGeneration}
            priceSuffix={offers.priceSuffix}
          />

          <aside
            className="rounded-2xl border border-accent/60 bg-accent/[0.07] p-5 shadow-[0_0_28px_rgba(34,114,222,0.16),0_0_70px_rgba(34,114,222,0.08)] sm:p-7"
            aria-labelledby="introductory-offer-heading"
          >
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px_220px] lg:items-center">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-accent-bright">Save £1,919</div>
                <h2 id="introductory-offer-heading" className="mt-2 font-heading text-xl font-extrabold text-text-primary sm:text-2xl">
                  6 Month Introductory Offer
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
                  Six months of the full AI Lead Generation service with a discounted setup fee,{" "}
                  <strong className="font-bold text-text-primary">plus AI Receptionist completely free</strong> for six months.
                </p>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">One-off payment</div>
                <PriceValue value={offers.webinar.firstPayment} suffix={offers.priceSuffix} />
              </div>
              <CheckoutButton href={offers.webinar.checkoutUrl} label="6 Month Introductory Offer" />
            </div>
          </aside>
          </>
        )}

        {openService === "websites" && (
          <section className="border-t border-border-light py-10 sm:py-12" aria-labelledby="service-02">
            <div className="text-xs font-bold tracking-[0.12em] text-accent-bright">02</div>
            <h2 id="service-02" className="mt-2 font-heading text-2xl font-extrabold tracking-tight text-text-primary sm:text-[28px]">
              Custom Websites
            </h2>
            <p className="mt-2 text-base text-text-secondary">Clear, fast websites built for customers and the way people search today.</p>
            <div className="mt-7">
              <ProblemSolution
                problem="More people now ask AI assistants such as ChatGPT to help them find and compare local businesses. Many conventional websites are vague, slow, or unclear about what the company does, where it works and why a customer should choose it."
                solution="We build a modern website for real customers and the new way people search: clear services and locations, useful answers, strong business signals, fast pages, and content that is easy for search and AI systems to understand."
              />
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-3">
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
            <p className="mt-4 text-xs leading-6 text-text-muted">
              Website visibility depends on many factors. We build a clear, search-ready foundation but do not guarantee rankings or inclusion in AI answers.
            </p>
          </section>
        )}

        {openService === "receptionist" && (
          <ServiceSection
            number="03"
            title="AI Receptionist"
            tagline="Never miss an enquiry again."
            problem="The phone rings while you are on a job, driving, or speaking to a customer. By the time you call back, the prospect has often moved to the next business on Google that answered."
            solution="The AI Receptionist answers calls, captures the caller’s details and needs, handles the initial conversation, and books an appropriate callback or appointment into your diary."
            price={offers.receptionist}
            priceSuffix={offers.priceSuffix}
          />
        )}
        </div>
      )}
    </div>
  );
}
