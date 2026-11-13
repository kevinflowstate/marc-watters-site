"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import GhlWebinarForm from "@/components/GhlWebinarForm";
import { WEBINAR_SESSIONS, decemberRegistrationState, decemberSessionClosed, type WebinarSessionId } from "@/lib/webinar-december";

type Props = { initialSession?: WebinarSessionId; enabled: boolean; forms: Record<WebinarSessionId, string>; nowMs: number };
export default function SessionRegistration({ initialSession, enabled, forms, nowMs }: Props) {
  const [selected, setSelected] = useState<WebinarSessionId | undefined>(initialSession);
  const [now, setNow] = useState(nowMs);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const closed = { "1pm": decemberSessionClosed("1pm", now), "7pm": decemberSessionClosed("7pm", now) };
  const session = WEBINAR_SESSIONS.find(item => item.id === selected);
  const state = session ? decemberRegistrationState(enabled, forms[session.id], session.id, now) : null;
  return <div>
    <fieldset>
      <legend className="font-heading text-xl font-extrabold tracking-tight">Pick the session that suits your day</legend>
      <p className="mt-2 text-sm leading-6 text-text-secondary">Same workshop, run twice. Choose the one you&apos;ll actually make.</p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {WEBINAR_SESSIONS.map(item => <label key={item.id} className={`relative cursor-pointer rounded-xl border p-4 transition ${selected === item.id ? "border-accent-bright bg-accent/15" : "border-white/15 bg-white/[0.025] hover:border-accent/70"} ${closed[item.id] ? "opacity-50" : ""}`}>
          <input className="peer sr-only" type="radio" name="webinar-session" value={item.id} checked={selected === item.id} onChange={() => setSelected(item.id)} disabled={closed[item.id]} />
          <span className="absolute inset-0 rounded-xl peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-accent-bright" />
          <span className="flex items-center justify-between gap-2 font-heading text-2xl font-extrabold">{item.time}<span aria-hidden="true" className={`h-4 w-4 shrink-0 rounded-full border ${selected === item.id ? "border-accent-bright bg-accent-bright shadow-[inset_0_0_0_3px_#10213e]" : "border-white/40"}`} /></span>
          <span className="mt-2 block text-xs leading-5 text-text-secondary">{closed[item.id] ? "Registration closed" : item.description}</span>
        </label>)}
      </div>
      <p className="mt-3 text-xs text-text-muted">Wednesday 9 December · UK &amp; Ireland time (GMT)</p>
    </fieldset>
    {session ? <div className="mt-6" aria-live="polite">
      {state === "open" ? <div className="overflow-hidden rounded-xl bg-white"><GhlWebinarForm key={session.id} formId={forms[session.id]} formName={`CBB 2027 Growth Engine — 9 December ${session.time}`} height={440} /></div> : state === "closed" ? <div className="rounded-xl border border-white/15 p-5 text-center"><p className="font-heading font-bold">Registration for {session.time} has closed.</p><p className="mt-3 text-sm leading-7 text-text-secondary">{WEBINAR_SESSIONS.some(item => !closed[item.id]) ? "Choose an available session above to join the workshop." : "Both live sessions have now started. You can book a call with Marc to discuss your business."}</p>{WEBINAR_SESSIONS.every(item => closed[item.id]) && <Link href="/book-marc" className="mt-4 inline-block font-bold text-accent-bright underline underline-offset-4">Book a call with Marc</Link>}</div> : state === "unavailable" ? <p className="rounded-xl border border-white/15 px-4 py-5 text-center text-sm leading-7 text-text-secondary">Registration for this session is temporarily unavailable. Please try again shortly.</p> : <>
        <div className="grid gap-3 sm:grid-cols-2">
          {["First name", "Last name", "Email address", "Mobile number"].map(label => <label key={label} className={`block text-xs font-semibold text-text-secondary ${label === "Email address" || label === "Mobile number" ? "sm:col-span-2" : ""}`}>{label}<input disabled placeholder={label} className="mt-1.5 block w-full rounded-lg border border-white/15 bg-white/[0.04] px-3 py-3 text-sm font-normal opacity-65" /></label>)}
        </div>
        <button disabled className="mt-5 w-full rounded-xl bg-accent px-5 py-4 font-heading font-extrabold text-white opacity-60">Save my {session.id} spot</button>
        <p className="mt-3 text-center text-xs leading-5 text-text-muted">Review preview · Registration opens after campaign approval.</p>
        <Link className="mt-4 block text-center text-sm font-semibold text-accent-bright underline underline-offset-4" href={`/webinar/thank-you?session=${session.id}`}>Preview the {session.id} thank-you page →</Link>
      </>}
    </div> : enabled && WEBINAR_SESSIONS.every(item => closed[item.id]) ? <div className="mt-6 rounded-xl border border-white/15 p-5 text-center" aria-live="polite"><p className="font-heading font-bold">Registration has closed.</p><p className="mt-3 text-sm leading-7 text-text-secondary">Both live sessions have now started. You can book a call with Marc to discuss your business.</p><Link href="/book-marc" className="mt-4 inline-block font-bold text-accent-bright underline underline-offset-4">Book a call with Marc</Link></div> : <p className="mt-6 rounded-xl border border-dashed border-white/15 px-4 py-5 text-center text-sm text-text-secondary">Choose 1pm or 7pm above to save your place.</p>}
    <a href="/privacy" className="mt-5 block text-center text-xs text-text-muted underline underline-offset-4">Privacy policy</a>
  </div>;
}
