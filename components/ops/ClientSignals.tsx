"use client";
import { useCallback, useEffect, useState } from "react";
type Signals = {
  checkin_prompts_enabled: boolean;
  payment_status: string;
  payment_chase_count: number;
  last_payment_at: string | null;
  onboarding_stage: string;
  onboarding_due_at: string | null;
  next_action: string | null;
  next_action_due: string | null;
};
const deliveryLabels = {
  claimed: "Attempt reserved · confirmation pending",
  accepted: "Accepted by provider",
  partial: "Some devices accepted · check delivery",
  unconfirmed: "Delivery unconfirmed · check before retrying",
  rejected: "Rejected by provider",
  no_destination: "No delivery address or subscribed device",
};
type Reminder = { week_start: string; channel: "email" | "push"; status: keyof typeof deliveryLabels };
const stages = [
  "none",
  "invited",
  "form_received",
  "paid",
  "welcomed",
  "community_added",
  "pack_sent",
  "complete",
];
export default function ClientSignals({ id }: { id: string }) {
  const [s, setS] = useState<Signals | null>(null),
    [reminders, setReminders] = useState<Reminder[] | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/clients/${id}/signals`),
      d = await r.json();
    if (!r.ok) {
      setError(d.error);
      return;
    }
    setS(d.client);
    setReminders(d.reminderHistory ?? null);
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);
  async function save(b: unknown) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/admin/clients/${id}/signals`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(b),
        }),
        d = await r.json();
      if (!r.ok) throw Error(d.error);
      setS(d.client);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="ws-panel min-w-0" aria-label="Payments and onboarding">
      <div className="ws-panel-head">
        <h2 className="ws-h2">Payments and onboarding</h2>
      </div>
      <div className="ws-pad">
      {error && (
        <p role="alert" className="ws-note is-attn mb-3">
          {error}
        </p>
      )}
      {s && (
        <div className="ws-signals">
          <label className="ws-label col-span-full flex items-center gap-3">
            <input type="checkbox" checked={s.checkin_prompts_enabled} disabled={busy}
              onChange={e => void save({ checkin_prompts_enabled: e.target.checked })} />
            <span>Weekly check-in reminders and inactivity follow-ups
              <span className="ws-caption block">Activity history and incoming messages remain available on this profile.</span>
            </span>
          </label>
          <label className="ws-label">
            Payment status
            <select
              className="ws-input mt-1.5"
              value={s.payment_status}
              disabled={busy}
              onChange={(e) => void save({ payment_status: e.target.value })}
            >
              {["current", "failed", "chasing", "paused", "cancelled"].map(
                (x) => (
                  <option key={x}>{x}</option>
                ),
              )}
            </select>
            <span className="ws-caption block mt-1.5" style={{ fontWeight: 400 }}>
              {s.payment_chase_count} reminders · Last paid{" "}
              {s.last_payment_at
                ? new Date(s.last_payment_at).toLocaleDateString("en-GB")
                : "not recorded"}
            </span>
          </label>
          <label className="ws-label">
            Onboarding
            <select
              className="ws-input mt-1.5"
              value={s.onboarding_stage}
              disabled={busy}
              onChange={(e) => void save({ stage: e.target.value })}
            >
              {stages.map((x, i) => (
                <option
                  key={x}
                  value={x}
                  disabled={i < stages.indexOf(s.onboarding_stage)}
                >
                  {x.replaceAll("_", " ")}
                </option>
              ))}
            </select>
            <span className="ws-caption block mt-1.5" style={{ fontWeight: 400 }}>
              Due{" "}
              {s.onboarding_due_at
                ? new Date(s.onboarding_due_at).toLocaleDateString("en-GB")
                : "not set"}
            </span>
          </label>
          <form
            className="ws-signals-form"
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              void save({
                next_action: data.get("next_action"),
                next_action_due: data.get("due")
                  ? new Date(String(data.get("due"))).toISOString()
                  : null,
              });
            }}
          >
            <label className="ws-label flex-1 min-w-40">
              Next action
              <input
                key={s.next_action}
                name="next_action"
                className="ws-input mt-1.5"
                defaultValue={s.next_action || ""}
              />
            </label>
            <label className="ws-label">
              Due
              <input
                name="due"
                type="date"
                className="ws-input mt-1.5"
                defaultValue={s.next_action_due?.slice(0, 10) || ""}
              />
            </label>
            <button
              className="ws-btn ws-btn-primary ws-focus self-end"
              disabled={busy}
            >
              Save action
            </button>
          </form>
          <details className="col-span-full">
            <summary className="ws-label">Weekly check-in reminder history</summary>
            {reminders?.length ? (
              <ul className="mt-2 space-y-1">
                {reminders.map((r) => (
                  <li key={r.week_start + r.channel}>
                    Week of {r.week_start} · {r.channel === "email" ? "Email" : "App notification"} · {deliveryLabels[r.status]}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ws-caption">{reminders ? "No attempts recorded since reminder tracking began." : "Reminder history unavailable."}</p>
            )}
          </details>
        </div>
      )}
      </div>
    </section>
  );
}
