"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  actionLabels, connectionError, contentNextSteps, sendingState,
  type ConnectionStatus, type PortalActionSwitches,
} from "@/lib/ops/connection-status";
import { fullDate, Icon } from "./WorkspaceUI";

export function ConnectionDetails({ status }: { status: ConnectionStatus }) {
  const actions = sendingState(status.controls);
  return (
    <>
      <p className="ws-caption mt-4">Checked {fullDate(status.checked_at)} · London time. This is a connection check, not a scheduled job.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <section className="ws-connection-card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="ws-detail-heading !mb-0">CRM &amp; social accounts</h3>
            <span className={`ws-chip is-${status.ghl.connected ? "ok" : "attn"}`}>{status.ghl.connected ? "Connected" : "Needs checking"}</span>
          </div>
          <p className="ws-caption mt-3">{status.ghl.connected
            ? `The portal can read ${status.ghl.location.name} and verify Marc’s social accounts.`
            : "The CRM could not be checked. Flowstate needs to check the connection before this information can be used."}</p>
          {status.ghl.connected && <>
            <ul className="mt-3 space-y-2" aria-label="Social account connections">
              {status.ghl.accounts.map((a) => <li key={a.id} className="flex items-start justify-between gap-3 text-sm">
                <span className="min-w-0 break-words"><strong className="capitalize">{a.platform}</strong><span className="block text-text-secondary">{a.name}</span></span>
                <span className={a.available ? "text-[color:var(--ws-ok)]" : "text-[color:var(--ws-attn)]"}>{a.available ? "Connected" : "Reconnect"}</span>
              </li>)}
            </ul>
            {!status.ghl.accounts.length && <p className="ws-caption mt-3">No connected social accounts were returned. Flowstate needs to check this.</p>}
          </>}
          <p className="ws-caption mt-3">This does not check payment reminders or send a post.</p>
        </section>
        <section className="ws-connection-card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="ws-detail-heading !mb-0">Content from Google Drive</h3>
            <span className={`ws-chip is-${status.drive.connected ? "ok" : "attn"}`}>{status.drive.connected ? "Connected" : "Needs checking"}</span>
          </div>
          <p className="ws-caption mt-3">{status.drive.connected
            ? `The portal can read ${status.drive.source.files.length === 1 ? "the shared content file" : `${status.drive.source.files.length} shared content files`}. It cannot edit them or browse Marc’s wider Drive.`
            : "The shared content file could not be read. Flowstate needs to check the connection and file access."}</p>
          <p className="ws-caption mt-3">Checking access does not import a new pack. Imported work still needs review before anything can be scheduled.</p>
        </section>
      </div>
      <section className="ws-connection-card mt-4">
        <h3 className="ws-detail-heading">Content: what happens next</h3>
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-text-secondary">
          {contentNextSteps(status).map((step) => <li key={step}>{step}</li>)}
        </ol>
        <Link className="ws-btn ws-btn-glass mt-4" href="/admin/automation">Review prepared work <Icon name="arrow" size={15} /></Link>
      </section>
      <section className="ws-connection-card mt-4">
        <h3 className="ws-detail-heading">Sending &amp; publishing</h3>
        <p className="ws-caption">{actions === "off" ? "All seven portal action switches are off. Reviewing work or saving an approval sends nothing."
          : actions === "enabled" ? "One or more action switches are on. An enabled switch is not proof that the action is ready or has run."
          : "The complete switch status could not be confirmed. Treat it as unknown."}</p>
        <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {Object.entries(actionLabels).map(([key, label]) => <li key={key} className="flex items-start justify-between gap-3 text-sm">
            <span>{label}</span>
            <strong className={status.controls[key as keyof PortalActionSwitches] ? "text-[color:var(--ws-attn)]" : "text-text-secondary"}>
              {status.controls[key as keyof PortalActionSwitches] === true ? "On" : status.controls[key as keyof PortalActionSwitches] === false ? "Off" : "Unknown"}
            </strong>
          </li>)}
        </ul>
      </section>
      <section className="ws-connection-card mt-4">
        <h3 className="ws-detail-heading">Checks still handled separately</h3>
        <dl className="space-y-4 text-sm leading-relaxed text-text-secondary">
          <div><dt className="font-bold text-text-primary">Payment reminders</dt><dd>Flowstate must verify the WhatsApp templates, both payment accounts and the reminder delivery test. A CRM connection alone does not prove those work.</dd></div>
          <div><dt className="font-bold text-text-primary">Lesson videos</dt><dd>Marc’s Codex handles the Fathom connection. The full video download, edit and review needs its own test. This page cannot verify his Fathom access.</dd></div>
          <div><dt className="font-bold text-text-primary">Scheduled Codex jobs</dt><dd>Managed in Marc’s Codex and intended to remain paused during setup. This portal cannot verify or change their schedules.</dd></div>
        </dl>
      </section>
    </>
  );
}

export function ConnectionChecks() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);

  async function check() {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setStatus(null); // Old success must not remain green during a failed recheck.
    setError("");
    const timeout = setTimeout(() => controller.abort(), 80_000);
    try {
      const response = await fetch("/api/admin/ops/connections", { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error(connectionError(response.status));
      const next = await response.json() as ConnectionStatus;
      if (next.read_only !== true || !next.controls || !next.ghl || !next.drive) throw new Error(connectionError(502));
      setStatus(next);
    } catch (e) {
      setError(controller.signal.aborted ? "The connection check took too long. Nothing was changed. Try again." : e instanceof Error ? e.message : connectionError(502));
    } finally {
      clearTimeout(timeout);
      pending.current = null;
      setBusy(false);
    }
  }

  return (
    <details className="ws-glass ws-connections mt-5">
      <summary className="ws-focus flex cursor-pointer items-center justify-between gap-3 p-5">
        <span><strong className="block text-base">Connections &amp; next steps</strong><span className="ws-caption mt-1 block">See what is connected and what still needs finishing.</span></span>
        <Icon name="chevron" size={18} className="ws-connection-chevron flex-none" />
      </summary>
      <div className="border-t border-[color:var(--ws-edge)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="ws-caption max-w-xl">Check CRM and Drive access here. This does not start an automation, import content or send anything.</p>
          <button type="button" className="ws-btn ws-btn-glass" disabled={busy} onClick={() => void check()}>
            <Icon name="refresh" size={15} className={busy ? "ws-spin" : ""} />{busy ? "Checking connections…" : "Check connections"}
          </button>
        </div>
        <div role="status" aria-live="polite">
          {busy && <p className="ws-caption mt-4">Checking the saved connections. This can take up to a minute.</p>}
          {!status && !busy && !error && <p className="ws-caption mt-4">No connection check has run in this visit.</p>}
        </div>
        {error && <p role="alert" className="ws-notice is-attn mt-4">{error}</p>}
        {status && <ConnectionDetails status={status} />}
      </div>
    </details>
  );
}
