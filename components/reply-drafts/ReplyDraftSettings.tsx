"use client";

import "./reply-drafts.css";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ops/workspace/WorkspaceUI";

type Settings = {
  enabled: boolean;
  pushAvailable?: boolean;
  pushOptIn?: boolean;
  guide?: { content: string; generated_at: string | null; generated_from: { inbox?: number; checkin?: number } | null; approved_at: string | null; updated_at: string } | null;
  stats?: { total: number; decided: number; sentUnchangedPct: number; editedPct: number; discardedPct: number };
};

function day(at: string | null | undefined) {
  return at ? new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
}

/** Admin Settings: Marc's style guide, this month's draft stats (counts only) and the push opt-in. */
export default function ReplyDraftSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState<"build" | "save" | "push" | null>(null);
  const [note, setNote] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  async function load() {
    const res = await fetch("/api/admin/reply-drafts/settings", { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return setSettings({ enabled: false });
    const data = (await res.json()) as Settings;
    setSettings(data);
    setContent(data.guide?.content || "");
  }

  useEffect(() => {
    void load();
  }, []);

  async function post(action: "build" | "save" | "push", extra: Record<string, unknown> = {}) {
    setBusy(action);
    setNote(null);
    try {
      const res = await fetch("/api/admin/reply-drafts/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      if (action === "build") setNote({ tone: "ok", text: "First draft written. Read it, change anything that is not you, then save." });
      if (action === "save") setNote({ tone: "ok", text: "Saved. Reply drafts now use this guide." });
      await load();
    } catch (err) {
      setNote({ tone: "bad", text: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setBusy(null);
    }
  }

  if (!settings?.enabled) return null;
  const guide = settings.guide;
  const stats = settings.stats;
  const unsaved = Boolean(guide) && content.trim() !== (guide?.content || "").trim();

  return (
    <section className="ws-panel" aria-label="Reply drafts">
      <header className="ws-panel-head ws-st-head">
        <h2 className="ws-h2">Reply drafts</h2>
        <p className="ws-caption">
          The portal drafts replies to client messages and check-ins in Marc&apos;s voice. Nothing is sent until an admin presses Send.
        </p>
      </header>

      <div className="ws-st-body">
        <div>
          <div className="ws-label">This month</div>
          <div className="rd-stats">
            <div className="rd-stat"><div className="rd-stat-l">Drafts</div><div className="rd-stat-n">{stats?.total ?? 0}</div></div>
            <div className="rd-stat"><div className="rd-stat-l">Sent unchanged</div><div className="rd-stat-n">{stats?.sentUnchangedPct ?? 0}%</div></div>
            <div className="rd-stat"><div className="rd-stat-l">Edited</div><div className="rd-stat-n">{stats?.editedPct ?? 0}%</div></div>
            <div className="rd-stat"><div className="rd-stat-l">Discarded</div><div className="rd-stat-n">{stats?.discardedPct ?? 0}%</div></div>
          </div>
          <p className="ws-caption mt-1">Percentages are of the {stats?.decided ?? 0} drafts an admin has decided on.</p>
        </div>

        <div>
          <label className="ws-label" htmlFor="rd-guide">
            Marc&apos;s style guide{" "}
            <span>
              {guide?.approved_at
                ? `Saved ${day(guide.approved_at)}`
                : guide
                  ? "Not saved yet. Drafting starts once it is saved."
                  : "Not built yet."}
            </span>
          </label>
          {guide ? (
            <textarea id="rd-guide" className="ws-input rd-guide" value={content} onChange={(e) => setContent(e.target.value)} />
          ) : (
            <p className="ws-caption">
              Build a first draft from Marc&apos;s real replies in the inbox and check-ins, then read it and save it. No drafts are written until it has been saved.
            </p>
          )}
          {guide?.generated_from && (
            <p className="ws-caption mt-1">
              Built {day(guide.generated_at)} from {guide.generated_from.inbox ?? 0} inbox replies and {guide.generated_from.checkin ?? 0} check-in replies.
            </p>
          )}
        </div>

        <div className="ws-st-save" style={{ gap: 8, display: "flex", flexWrap: "wrap" }}>
          <button
            type="button"
            className="ws-btn ws-focus"
            disabled={busy !== null}
            onClick={() => {
              if (guide && !window.confirm("Rebuild the guide from Marc's replies? Your edits will be replaced and it will need saving again.")) return;
              void post("build");
            }}
          >
            <Icon name="sparkle" size={13} />
            {busy === "build" ? "Building, this takes a minute..." : guide ? "Rebuild Marc's style guide" : "Build Marc's style guide"}
          </button>
          {guide && (
            <button
              type="button"
              className="ws-btn ws-btn-primary ws-focus"
              disabled={busy !== null || content.trim().length < 40 || (!unsaved && Boolean(guide.approved_at))}
              onClick={() => void post("save", { content })}
            >
              {busy === "save" ? "Saving..." : guide.approved_at ? "Save changes" : "Save and start drafting"}
            </button>
          )}
        </div>

        {settings.pushAvailable && (
          <label className="rd-toggle">
            <input
              type="checkbox"
              checked={settings.pushOptIn !== false}
              disabled={busy !== null}
              onChange={(e) => void post("push", { enabled: e.target.checked })}
            />
            Send me a notification when a reply is ready to approve
          </label>
        )}

        {note && (
          <div className={`ws-note ${note.tone === "ok" ? "is-ok" : "is-bad"}`} role={note.tone === "ok" ? "status" : "alert"}>
            <Icon name={note.tone === "ok" ? "checkCircle" : "alert"} size={15} />
            <span>{note.text}</span>
          </div>
        )}
      </div>
    </section>
  );
}
