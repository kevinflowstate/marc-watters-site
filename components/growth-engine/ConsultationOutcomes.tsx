"use client";

import { useEffect, useState } from "react";
import { EmptyState, InlineNotice } from "@/components/ui/PortalState";
import { useToast } from "@/components/ui/Toast";
import type { GrowthAppointment, GrowthSalesOutcomeStatus } from "@/lib/growth-engine";

const options: Array<{ value: GrowthSalesOutcomeStatus; label: string }> = [
  { value: "won", label: "Sale won" },
  { value: "lost", label: "Not won" },
  { value: "follow_up", label: "Follow-up needed" },
  { value: "no_show", label: "No-show" },
];

export default function ConsultationOutcomes() {
  const { toast } = useToast();
  const [appointments, setAppointments] = useState<GrowthAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  async function load() {
    const response = await fetch("/api/portal/growth-engine/sales", { cache: "no-store" });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || "Consultations could not be loaded.");
    setAppointments(data.appointments || []);
  }

  useEffect(() => {
    void load().catch((loadError) => setError((loadError as Error).message)).finally(() => setLoading(false));
  }, []);

  async function save(appointment: GrowthAppointment, outcome: GrowthSalesOutcomeStatus, saleValue: number, notes: string) {
    setBusyId(appointment.id);
    try {
      const response = await fetch("/api/portal/growth-engine/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: appointment.id, outcome, saleValue, notes }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Outcome could not be saved.");
      await load();
      toast("Consultation outcome saved");
    } catch (saveError) {
      toast((saveError as Error).message, "error");
    } finally {
      setBusyId("");
    }
  }

  if (loading) return <div className="v2-surface p-5 text-sm text-text-muted">Loading consultations…</div>;
  if (error) return <InlineNotice tone="error">{error}</InlineNotice>;
  return (
    <section className="v2-surface overflow-hidden">
      <header className="border-b border-white/[0.07] px-5 py-5 sm:px-7">
        <div className="v2-eyebrow">Your sales outcomes</div>
        <h2 className="mt-2 v2-section-title">Update recent consultations</h2>
        <p className="mt-1 text-xs leading-5 text-text-muted">Tell us what happened after each appointment so your reporting reflects real sales, not just leads.</p>
      </header>
      {appointments.length ? (
        <div className="divide-y divide-white/[0.06]">
          {appointments.map((appointment) => (
            <OutcomeRow key={appointment.id} appointment={appointment} busy={busyId === appointment.id} onSave={save} />
          ))}
        </div>
      ) : <EmptyState compact title="No consultations to update" description="Appointments from your connected calendar will appear here." />}
    </section>
  );
}

function OutcomeRow({
  appointment,
  busy,
  onSave,
}: {
  appointment: GrowthAppointment;
  busy: boolean;
  onSave: (appointment: GrowthAppointment, outcome: GrowthSalesOutcomeStatus, saleValue: number, notes: string) => Promise<void>;
}) {
  const [outcome, setOutcome] = useState<GrowthSalesOutcomeStatus>(appointment.outcome?.outcome || "follow_up");
  const [saleValue, setSaleValue] = useState(String(appointment.outcome?.sale_value || ""));
  const [notes, setNotes] = useState(appointment.outcome?.notes || "");
  return (
    <div className="grid gap-4 px-5 py-5 sm:px-7 lg:grid-cols-[minmax(180px,1fr)_180px_150px_minmax(180px,1fr)_auto] lg:items-end">
      <div>
        <p className="text-sm font-bold text-text-primary">{appointment.contact_name || "Calendar appointment"}</p>
        <p className="mt-1 text-xs text-text-muted">{appointment.starts_at ? new Date(appointment.starts_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "Date unavailable"}</p>
      </div>
      <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted">Outcome<select value={outcome} onChange={(event) => setOutcome(event.target.value as GrowthSalesOutcomeStatus)} className="mt-2 min-h-10 w-full rounded-lg border border-white/[0.08] bg-[var(--cbb-surface-1)] px-3 text-sm normal-case tracking-normal text-text-primary">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted">Sale value<input inputMode="decimal" value={saleValue} disabled={outcome !== "won"} onChange={(event) => setSaleValue(event.target.value)} placeholder="£0" className="mt-2 min-h-10 w-full rounded-lg border border-white/[0.08] bg-black/10 px-3 text-sm normal-case tracking-normal text-text-primary disabled:opacity-40" /></label>
      <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted">Notes<input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional context" className="mt-2 min-h-10 w-full rounded-lg border border-white/[0.08] bg-black/10 px-3 text-sm normal-case tracking-normal text-text-primary" /></label>
      <button type="button" disabled={busy} onClick={() => void onSave(appointment, outcome, Number(saleValue || 0), notes)} className="v2-button-secondary">{busy ? "Saving…" : appointment.outcome ? "Update" : "Save"}</button>
    </div>
  );
}
