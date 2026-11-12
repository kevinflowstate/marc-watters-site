"use client";

import { useEffect, useState } from "react";
import { WsEmpty as EmptyState, WsNotice as InlineNotice } from "@/components/portal/WsState";
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

  if (loading) return <div className="ws-panel ws-pad ws-caption">Loading consultations…</div>;
  if (error) return <InlineNotice tone="error">{error}</InlineNotice>;
  return (
    <section className="ws-panel min-w-0">
      <header className="ws-panel-head">
        <div className="min-w-0 ws-ge-head-t">
        <div className="ws-caption">Your sales outcomes</div>
        <h2 className="ws-h2">Update recent consultations</h2>
        <p className="ws-caption">Tell us what happened after each appointment so your reporting reflects real sales, not just leads.</p>
        </div>
      </header>
      {appointments.length ? (
        <div>
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
    <div className="ws-ge-outcome">
      <div className="min-w-0">
        <p className="ws-row-title">{appointment.contact_name || "Calendar appointment"}</p>
        <p className="ws-row-sub">{appointment.starts_at ? new Date(appointment.starts_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "Date unavailable"}</p>
      </div>
      <label className="ws-label ws-ge-datel">Outcome<select value={outcome} onChange={(event) => setOutcome(event.target.value as GrowthSalesOutcomeStatus)} className="ws-input">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <label className="ws-label ws-ge-datel">Sale value<input inputMode="decimal" value={saleValue} disabled={outcome !== "won"} onChange={(event) => setSaleValue(event.target.value)} placeholder="£0" className="ws-input" /></label>
      <label className="ws-label ws-ge-datel">Notes<input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional context" className="ws-input" /></label>
      <button type="button" disabled={busy} onClick={() => void onSave(appointment, outcome, Number(saleValue || 0), notes)} className="ws-btn ws-focus">{busy ? "Saving…" : appointment.outcome ? "Update" : "Save"}</button>
    </div>
  );
}
