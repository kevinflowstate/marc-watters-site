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
    <div className="ws-ge-data">
      <section className="ws-panel min-w-0">
        <header className="ws-panel-head">
          <div className="min-w-0 ws-ge-head-t">
            <div className="ws-caption">Lead and appointment data</div>
            <h2 className="ws-h2">GoHighLevel connection</h2>
            <p className="ws-caption">Use the client’s GHL location and, optionally, limit reporting to specific calendars.</p>
          </div>
        </header>
        <div className="ws-ge-form">
          <label className="block">
            <span className="ws-label">GHL location ID</span>
            <input value={locationId} onChange={(event) => setLocationId(event.target.value)} placeholder="Location ID" className="ws-input" />
          </label>
          <label className="block">
            <span className="ws-label">Calendar IDs</span>
            <textarea value={calendarIds} onChange={(event) => setCalendarIds(event.target.value)} placeholder="One calendar ID per line. Leave blank to accept every calendar." rows={5} className="ws-input" />
          </label>
          <div className="ws-st-2">
            <label className="ws-label ws-ge-datel">
              Draft day
              <select value={reportDay} onChange={(event) => setReportDay(Number(event.target.value))} className="ws-input">
                {weekdays.map((day, index) => <option key={day} value={index}>{day}</option>)}
              </select>
            </label>
            <label className="ws-check ws-ge-toggle">
              <input type="checkbox" checked={automationEnabled} onChange={(event) => setAutomationEnabled(event.target.checked)} className="" />
              Generate weekly drafts
            </label>
          </div>
          <div className="ws-ge-end">
            <button type="button" onClick={save} disabled={busy} className="ws-btn ws-btn-primary ws-focus">{busy ? "Saving…" : "Save data connection"}</button>
          </div>
        </div>
      </section>

      <aside className="ws-stack">
        <section className="ws-panel">
          <div className="ws-panel-head"><h2 className="ws-h2">End-to-end connections</h2></div>
          <dl className="ws-ge-dl">
            <Capability label="GHL appointment intake" ready={Boolean(capabilities?.ghlWebhookConfigured)} />
            <Capability label="Automatic report intake" ready={Boolean(capabilities?.reportIntakeConfigured)} />
            <Capability label="Scheduled draft generation" ready={Boolean(capabilities?.scheduledDraftsConfigured)} />
          </dl>
          <p className="ws-caption ws-ge-dl-note">Incoming reports remain private drafts until you review and publish them.</p>
        </section>
        <section className="ws-panel">
          <div className="ws-panel-head"><h2 className="ws-h2">Automation status</h2></div>
          <dl className="ws-ge-dl">
            <div className="ws-ge-dl-row"><dt>Last GHL event</dt><dd>{formatDate(connection?.last_event_at)}</dd></div>
            <div className="ws-ge-dl-row"><dt>Last draft</dt><dd>{formatDate(connection?.last_draft_at)}</dd></div>
            <div className="ws-ge-dl-row"><dt>Schedule</dt><dd>{automationEnabled ? weekdays[reportDay] : "Paused"}</dd></div>
          </dl>
        </section>
        <section className="ws-panel ws-pad">
          <h3 className="ws-h2">Create this week’s draft</h3>
          <p className="ws-caption mt-1">Builds a private draft from GHL appointments and client-entered sales outcomes. You still review and publish it.</p>
          <button type="button" onClick={generate} disabled={busy} className="ws-btn ws-focus ws-ge-full">{busy ? "Generating…" : "Generate draft now"}</button>
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
    <div className="ws-ge-dl-row">
      <dt>{label}</dt>
      <dd className={`ws-chip ${ready ? "is-ok" : "is-attn"}`}>
        {ready ? "Ready" : "Not configured"}
      </dd>
    </div>
  );
}
