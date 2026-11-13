import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DECEMBER_WEBINAR, WEBINAR_SESSIONS, getDecemberSession, getDecemberZoomUrl } from "@/lib/webinar-december";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Join The CBB 2027 Growth Engine", robots: { index: false, follow: false } };
export default async function WebinarJoinPage({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const session = getDecemberSession((await searchParams).session);
  const zoom = session ? getDecemberZoomUrl(session.id) : null;
  if (zoom) redirect(zoom);
  return <main className="flex min-h-screen items-center justify-center px-5 py-16"><div className="mx-auto max-w-[620px] text-center"><Image src="/images/cbb-logo.png" alt="Construction Business Blueprint" width={56} height={56} className="mx-auto h-14 w-auto" priority /><p className="mt-8 text-xs font-bold uppercase tracking-[2px] text-accent-bright">The CBB 2027 Growth Engine</p><h1 className="mt-4 font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">{session ? "Your Zoom room is being prepared." : "Choose your registered session."}</h1><p className="mt-5 text-base leading-8 text-text-secondary">{session ? "Your calendar link will keep pointing here. We’ll add your Zoom room before the workshop and send joining instructions by email." : "Open the joining page for the time you picked when registering."}</p><div className="mt-7 rounded-xl border border-white/15 bg-white/[.025] px-5 py-5"><p className="font-heading font-bold">{DECEMBER_WEBINAR.dateLabel}</p><p className="mt-2 text-sm text-text-secondary">{session ? `${session.time} · UK & Ireland time (GMT)` : "1pm or 7pm · UK & Ireland time (GMT)"}</p></div>{!session && <div className="mt-5 flex justify-center gap-3">{WEBINAR_SESSIONS.map(item => <Link key={item.id} className="rounded-lg border border-accent/50 px-6 py-3 font-bold text-accent-bright" href={`/webinar/join?session=${item.id}`}>{item.time}</Link>)}</div>}<Link href={`/webinar/thank-you${session ? `?session=${session.id}` : ""}`} className="mt-7 inline-block text-sm font-semibold text-accent-bright underline underline-offset-4">Back to workshop details</Link></div></main>;
}
