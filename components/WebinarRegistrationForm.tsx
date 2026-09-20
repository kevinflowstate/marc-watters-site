"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { WEBINAR, WEBINAR_THANK_YOU_PATH } from "@/lib/webinar";

type FieldErrors = Partial<Record<"firstName" | "email" | "phone" | "emailConsent", string>>;

function InputError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} className="mt-1.5 text-sm text-[#ff8d8d]">{message}</p>;
}

export default function WebinarRegistrationForm() {
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [attribution, setAttribution] = useState({
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
    utm_content: "",
    utm_term: "",
    landingPage: "",
    referrer: "",
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setAttribution({
      utm_source: params.get("utm_source") || "",
      utm_medium: params.get("utm_medium") || "",
      utm_campaign: params.get("utm_campaign") || "",
      utm_content: params.get("utm_content") || "",
      utm_term: params.get("utm_term") || "",
      landingPage: window.location.href,
      referrer: document.referrer,
    });
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const formElement = event.currentTarget;
    setSubmitting(true);
    setFormError("");
    setFieldErrors({});

    const form = new FormData(event.currentTarget);
    const payload = {
      eventId: WEBINAR.id,
      firstName: form.get("firstName"),
      lastName: form.get("lastName"),
      email: form.get("email"),
      phone: form.get("phone"),
      businessName: form.get("businessName"),
      companyWebsite: form.get("companyWebsite"),
      emailConsent: form.get("emailConsent") === "on",
      whatsappConsent: form.get("whatsappConsent") === "on",
      source: WEBINAR.source,
      consentVersion: WEBINAR.consentVersion,
      utm: {
        source: attribution.utm_source,
        medium: attribution.utm_medium,
        campaign: attribution.utm_campaign,
        content: attribution.utm_content,
        term: attribution.utm_term,
      },
      landingPage: attribution.landingPage,
      referrer: attribution.referrer,
    };

    try {
      const response = await fetch("/api/webinar/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        if (result?.fieldErrors) {
          setFieldErrors(result.fieldErrors);
          const firstInvalidField = Object.keys(result.fieldErrors)[0];
          requestAnimationFrame(() => {
            formElement.querySelector<HTMLElement>(`[name="${firstInvalidField}"]`)?.focus();
          });
        }
        setFormError(result?.message || "We couldn't complete your registration. Please check your details and try again.");
        return;
      }
      window.location.assign(result.redirect || WEBINAR_THANK_YOU_PATH);
    } catch {
      setFormError("We couldn't reach the registration service. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = "mt-2 w-full rounded-xl border border-white/10 bg-white/[0.045] px-4 py-3.5 text-[16px] text-white outline-none transition placeholder:text-white/35 focus:border-accent-bright focus:ring-2 focus:ring-accent/25";

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4" aria-busy={submitting}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-text-primary">
          First name <span className="text-accent-bright">*</span>
          <input className={inputClass} name="firstName" autoComplete="given-name" required aria-invalid={Boolean(fieldErrors.firstName)} aria-describedby={fieldErrors.firstName ? "firstName-error" : undefined} />
          <InputError id="firstName-error" message={fieldErrors.firstName} />
        </label>
        <label className="text-sm font-semibold text-text-primary">
          Last name
          <input className={inputClass} name="lastName" autoComplete="family-name" />
        </label>
      </div>
      <label className="block text-sm font-semibold text-text-primary">
        Email address <span className="text-accent-bright">*</span>
        <input className={inputClass} name="email" type="email" inputMode="email" autoComplete="email" required aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? "email-error" : undefined} />
        <InputError id="email-error" message={fieldErrors.email} />
      </label>
      <label className="block text-sm font-semibold text-text-primary">
        Mobile number with country code <span className="font-normal text-text-muted">(required for WhatsApp)</span>
        <input className={inputClass} name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="e.g. +44 7700 900000" aria-invalid={Boolean(fieldErrors.phone)} aria-describedby={fieldErrors.phone ? "phone-error" : undefined} />
        <InputError id="phone-error" message={fieldErrors.phone} />
      </label>
      <label className="block text-sm font-semibold text-text-primary">
        Business name <span className="font-normal text-text-muted">(optional)</span>
        <input className={inputClass} name="businessName" autoComplete="organization" />
      </label>
      <label className="absolute -left-[9999px]" aria-hidden="true">
        Company website
        <input name="companyWebsite" tabIndex={-1} autoComplete="off" />
      </label>
      <fieldset className="space-y-3 pt-2">
        <legend className="sr-only">Communication preferences</legend>
        <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-text-secondary">
          <input type="checkbox" name="emailConsent" required className="mt-1 h-4 w-4 shrink-0 accent-[#2272de]" aria-invalid={Boolean(fieldErrors.emailConsent)} aria-describedby={fieldErrors.emailConsent ? "emailConsent-error" : undefined} />
          <span>{WEBINAR.emailConsentText} <span className="text-accent-bright">*</span></span>
        </label>
        <InputError id="emailConsent-error" message={fieldErrors.emailConsent} />
        <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-text-secondary">
          <input type="checkbox" name="whatsappConsent" className="mt-1 h-4 w-4 shrink-0 accent-[#2272de]" />
          <span>{WEBINAR.whatsappConsentText}</span>
        </label>
      </fieldset>
      {formError && <div role="alert" className="rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm leading-6 text-[#ffb1b1]">{formError}</div>}
      <button type="submit" disabled={submitting} className="btn-primary gradient-accent flex w-full items-center justify-center rounded-xl px-6 py-4 font-heading text-base font-bold text-white transition hover:-translate-y-0.5 hover:shadow-[0_14px_45px_rgba(34,114,222,0.35)] disabled:cursor-wait disabled:opacity-65 disabled:hover:translate-y-0">
        {submitting ? "Registering…" : "Save my free place"}
      </button>
      <p className="text-center text-xs leading-5 text-text-muted">
        Your details are used to manage this registration. See our{" "}
        <Link href="/privacy" target="_blank" className="text-text-secondary underline underline-offset-2">privacy policy</Link>.
      </p>
    </form>
  );
}
