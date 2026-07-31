"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import type { GrowthConnection } from "@/lib/growth-engine";
import type { GrowthAutomationCapabilities } from "@/lib/growth-engine-admin";

const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function GrowthEngineDataSetup({
  clientId,
  connection,
  capabilities,
  onChanged,
}: {
  clientId: string;
  connection: GrowthConnection | null;
  capabilities: GrowthAutomationCapabilities | null;
  onChanged: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [locationId, setLocationId] = useState("");
  const [calendarIds, setCalendarIds] = useState("");
  const [reportDay, setReportDay] = useState(1);
  const [automationEnabled, setAutomationEnabled] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLocationId(connection?.ghl_location_id || "");
    setCalendarIds((connection?.ghl_calendar_ids || []).join("\n"));
    setReportDay(connection?.report_day ?? 1);
    setAutomationEnabled(connection?.automation_enabled ?? true);
  }, [connection]);

  async function save() {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/growth-engine/clients/${clientId}/connection`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ghlLocationId: locationId,
          ghlCalendarIds: calendarIds.split(/[\n,]/).map((value) => value.trim()).filter(Boolean),
          timezone: "Europe/London",
          reportDay,
          automationEnabled,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Connection could not be saved.");
      await onChanged();
      toast("Growth Engine data connection saved");
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/growth-engine/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Draft could not be generated.");
      await onChanged();
      toast(data.unchanged ? "This week’s report is already published" : "Weekly draft generated for review");
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="v2-surface overflow-hidden">
        <header className="border-b border-white/[0.07] px-5 py-5 sm:px-7">
          <div className="v2-eyebrow">Lead and appointment data</div>
          <h2 className="mt-2 v2-section-title">GoHighLevel connection</h2>
          <p className="mt-1 text-xs leading-5 text-text-muted">Use the client’s GHL location and, optionally, limit reporting to specific calendars.</p>
        </header>
        <div className="space-y-5 p-5 sm:p-7">
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.1em] text-text-muted">GHL location ID</span>
            <input value={locationId} onChange={(event) => setLocationId(event.target.value)} placeholder="Location ID" className="min-h-11 w-full rounded-xl border border-white/[0.09] bg-white/[0.03] px-4 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent/45" />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.1em] text-text-muted">Calendar IDs</span>
            <textarea value={calendarIds} onChange={(event) => setCalendarIds(event.target.value)} placeholder="One calendar ID per line. Leave blank to accept every calendar." rows={5} className="w-full resize-y rounded-xl border border-white/[0.09] bg-white/[0.03] px-4 py-3 text-sm leading-6 text-text-primary outline-none placeholder:text-text-muted focus:border-accent/45" />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-bold uppercase tracking-[0.1em] text-text-muted">
              Draft day
              <select value={reportDay} onChange={(event) => setReportDay(Number(event.target.value))} className="mt-2 min-h-11 w-full rounded-xl border border-white/[0.09] bg-[var(--cbb-surface-1)] px-4 text-sm normal-case tracking-normal text-text-primary outline-none">
                {weekdays.map((day, index) => <option key={day} value={index}>{day}</option>)}
              </select>
            </label>
            <label className="flex min-h-11 items-center gap-3 self-end rounded-xl border border-white/[0.09] bg-white/[0.03] px-4 text-sm font-semibold text-text-primary">
              <input type="checkbox" checked={automationEnabled} onChange={(event) => setAutomationEnabled(event.target.checked)} className="h-4 w-4 accent-[var(--cbb-accent)]" />
              Generate weekly drafts
            </label>
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={save} disabled={busy} className="v2-button-primary">{busy ? "Saving…" : "Save data connection"}</button>
          </div>
        </div>
      </section>

      <aside className="space-y-5">
        <section className="v2-surface p-5">
          <div className="v2-eyebrow">End-to-end connections</div>
          <dl className="mt-4 space-y-3 text-sm">
            <Capability label="GHL appointment intake" ready={Boolean(capabilities?.ghlWebhookConfigured)} />
            <Capability label="Automatic report intake" ready={Boolean(capabilities?.reportIntakeConfigured)} />
            <Capability label="Scheduled draft generation" ready={Boolean(capabilities?.scheduledDraftsConfigured)} />
          </dl>
          <p className="mt-4 text-[11px] leading-5 text-text-muted">Incoming reports remain private drafts until you review and publish them.</p>
        </section>
        <section className="v2-surface p-5">
          <div className="v2-eyebrow">Automation status</div>
          <dl className="mt-4 space-y-4 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-text-muted">Last GHL event</dt><dd className="font-semibold text-text-primary">{formatDate(connection?.last_event_at)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-text-muted">Last draft</dt><dd className="font-semibold text-text-primary">{formatDate(connection?.last_draft_at)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-text-muted">Schedule</dt><dd className="font-semibold text-text-primary">{automationEnabled ? weekdays[reportDay] : "Paused"}</dd></div>
          </dl>
        </section>
        <section className="v2-surface p-5">
          <h3 className="text-sm font-black text-text-primary">Create this week’s draft</h3>
          <p className="mt-2 text-xs leading-5 text-text-muted">Builds a private draft from GHL appointments and client-entered sales outcomes. You still review and publish it.</p>
          <button type="button" onClick={generate} disabled={busy} className="mt-4 w-full v2-button-secondary">{busy ? "Generating…" : "Generate draft now"}</button>
        </section>
      </aside>
    </div>
  );
}

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "Not yet";
}

function Capability({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-text-muted">{label}</dt>
      <dd className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] ${ready ? "border-emerald-500/25 bg-emerald-500/8 text-emerald-300" : "border-amber-400/25 bg-amber-400/8 text-amber-300"}`}>
        {ready ? "Ready" : "Not configured"}
      </dd>
    </div>
  );
}
